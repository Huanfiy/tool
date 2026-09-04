#!/usr/bin/env python3
"""
studio-bridge · 工作室终端桥接（WebSocket ⇄ PTY）

为 studio.html 的「终端」App 提供真实 shell。只用 Python 标准库，无第三方依赖。

安全边界
  - 默认只监听 127.0.0.1，浏览器里的站点只能连到访问者自己机器上的桥接；
  - 必须通过环境变量 STUDIO_TERM_PASSWORD 设置密码，未设置直接拒绝启动；
  - 校验 Origin：只允许 localhost / 127.0.0.1 与 STUDIO_TERM_ORIGINS 里的来源（默认含 https://huanfly.com）；
  - 认证失败延时响应并断开，同一来源连续失败会被临时锁定；
  - 本文件被 .gitattributes 标记为 export-ignore，不会随部署产物发布。

附带能力：HTTP 中转 /relay/<path>
  Robot App 的上游接口若不支持 CORS，可让浏览器改请求 http://127.0.0.1:7681/relay/chat/completions，
  并用请求头 X-Relay-Base 指明上游 Base URL；桥接原样转发方法、Authorization、正文并流式回传，
  同时补上 CORS 头。仍受 Origin 白名单约束，密钥始终只在浏览器与上游之间传递。

协议（JSON 文本帧）
  C→S {"type":"hello"}                      S→C {"type":"hello","host":"…","shell":"…","relay":true}
  C→S {"type":"auth","password":"…"}        S→C {"type":"auth","ok":true} | {"type":"auth","ok":false,"error":"…"}（随后断开）
  C→S {"type":"input","data":"…"}
  C→S {"type":"resize","cols":N,"rows":N}
  S→C {"type":"output","data":"…"}
  S→C {"type":"exit","code":N}

用法
  STUDIO_TERM_PASSWORD='…' python3 server/studio-bridge.py [--host 127.0.0.1] [--port 7681] [--shell /bin/zsh]
  或：STUDIO_TERM_PASSWORD='…' ./run.sh term [port]

环境变量
  STUDIO_TERM_PASSWORD  必填，终端密码
  STUDIO_TERM_HOST      监听地址（默认 127.0.0.1；改成 0.0.0.0 前请确认你知道自己在做什么）
  STUDIO_TERM_PORT      监听端口（默认 7681）
  STUDIO_TERM_SHELL     要启动的 shell（默认 $SHELL 或 /bin/bash）
  STUDIO_TERM_ORIGINS   额外允许的 Origin，逗号分隔
"""

import argparse
import asyncio
import base64
import codecs
import fcntl
import hashlib
import hmac
import json
import logging
import os
import pty
import signal
import socket
import ssl
import struct
import sys
import termios
import time
from urllib.parse import urlparse

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MAX_FRAME = 1 << 20
RELAY_PREFIX = "/relay/"
RELAY_MAX_BODY = 2 << 20
RELAY_TIMEOUT = 120
CORS_HEADERS = (
    "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
    "Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Relay-Base\r\n"
    "Access-Control-Max-Age: 600\r\n"
)
AUTH_TIMEOUT = 600          # 未认证连接的最长存活时间（秒）
FAIL_LIMIT = 5              # 连续失败次数
FAIL_LOCK_SECONDS = 60
DEFAULT_ORIGINS = {"https://huanfly.com", "https://www.huanfly.com"}

log = logging.getLogger("studio-bridge")


class WSError(Exception):
    pass


# ---------------------------------------------------------------------------
# WebSocket 基础
# ---------------------------------------------------------------------------
def encode_frame(payload, opcode=0x1):
    if isinstance(payload, str):
        payload = payload.encode("utf-8")
    header = bytearray([0x80 | opcode])
    n = len(payload)
    if n < 126:
        header.append(n)
    elif n < 65536:
        header.append(126)
        header += struct.pack(">H", n)
    else:
        header.append(127)
        header += struct.pack(">Q", n)
    return bytes(header) + payload


def unmask(payload, mask):
    n = len(payload)
    if n == 0:
        return b""
    full_mask = (mask * (n // 4 + 1))[:n]
    return (int.from_bytes(payload, "big") ^ int.from_bytes(full_mask, "big")).to_bytes(n, "big")


async def read_frame(reader):
    """返回 (opcode, payload)。数据帧会自动拼接分片；控制帧原样返回。"""
    message = b""
    message_opcode = None
    while True:
        b1, b2 = await reader.readexactly(2)
        fin = b1 & 0x80
        opcode = b1 & 0x0F
        masked = b2 & 0x80
        length = b2 & 0x7F
        if length == 126:
            length = struct.unpack(">H", await reader.readexactly(2))[0]
        elif length == 127:
            length = struct.unpack(">Q", await reader.readexactly(8))[0]
        if length > MAX_FRAME:
            raise WSError("frame too large")
        mask = await reader.readexactly(4) if masked else None
        payload = await reader.readexactly(length)
        if mask:
            payload = unmask(payload, mask)
        if opcode >= 0x8:
            return opcode, payload
        if opcode == 0x0:
            message += payload
        else:
            message_opcode = opcode
            message = payload
        if fin:
            return message_opcode, message


async def read_http_request(reader):
    raw = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=10)
    if len(raw) > 16384:
        raise WSError("header too large")
    lines = raw.decode("latin-1").split("\r\n")
    headers = {}
    for line in lines[1:]:
        if not line:
            continue
        key, _, value = line.partition(":")
        headers[key.strip().lower()] = value.strip()
    return lines[0], headers


def origin_allowed(origin, allowed_origins):
    if not origin:
        # 非浏览器客户端不带 Origin；浏览器一定带，所以这里放行不会削弱对网页的保护
        return True
    try:
        parsed = urlparse(origin)
    except ValueError:
        return False
    host = (parsed.hostname or "").lower()
    if host in ("localhost", "127.0.0.1", "::1"):
        return True
    return origin.lower() in allowed_origins


# ---------------------------------------------------------------------------
# 会话
# ---------------------------------------------------------------------------
class FailureTracker:
    def __init__(self):
        self._records = {}

    def locked(self, key):
        count, until = self._records.get(key, (0, 0))
        if count >= FAIL_LIMIT and time.monotonic() < until:
            return True
        if count >= FAIL_LIMIT:
            self._records.pop(key, None)
        return False

    def record_failure(self, key):
        count, _ = self._records.get(key, (0, 0))
        count += 1
        self._records[key] = (count, time.monotonic() + FAIL_LOCK_SECONDS)
        return count

    def reset(self, key):
        self._records.pop(key, None)


class Session:
    def __init__(self, reader, writer, config, failures):
        self.reader = reader
        self.writer = writer
        self.config = config
        self.failures = failures
        self.peer = writer.get_extra_info("peername")
        self.peer_key = self.peer[0] if self.peer else "?"
        self.outbox = asyncio.Queue()
        self.authed = False
        self.pid = None
        self.fd = None
        self.decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        self.closed = False

    # ----- 发送 -----
    def send_json(self, obj):
        if not self.closed:
            self.outbox.put_nowait(encode_frame(json.dumps(obj, ensure_ascii=False)))

    def send_raw(self, frame):
        if not self.closed:
            self.outbox.put_nowait(frame)

    async def sender(self):
        try:
            while True:
                frame = await self.outbox.get()
                if frame is None:
                    break
                self.writer.write(frame)
                await self.writer.drain()
        except (ConnectionError, asyncio.CancelledError):
            pass

    # ----- 握手 -----
    async def handshake(self):
        request_line, headers = await read_http_request(self.reader)
        parts = request_line.split(" ")
        method = parts[0] if parts else ""
        path = parts[1] if len(parts) > 1 else "/"
        origin = headers.get("origin", "")
        if not origin_allowed(origin, self.config.origins):
            log.warning("拒绝来源 %s (%s)", origin, self.peer_key)
            await self.reject(403, "Origin not allowed", origin)
            return False

        if path.startswith(RELAY_PREFIX):
            await self.relay(method, path, headers, origin)
            return False

        if method != "GET":
            await self.reject(405, "Method Not Allowed", origin)
            return False
        if headers.get("upgrade", "").lower() != "websocket" or "upgrade" not in headers.get("connection", "").lower():
            await self.reject(400, "WebSocket upgrade required", origin)
            return False
        key = headers.get("sec-websocket-key")
        if not key:
            await self.reject(400, "Missing Sec-WebSocket-Key", origin)
            return False
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
        self.writer.write(
            (
                "HTTP/1.1 101 Switching Protocols\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
            ).encode()
        )
        await self.writer.drain()
        return True

    @staticmethod
    def cors_block(origin):
        if not origin:
            return ""
        return f"Access-Control-Allow-Origin: {origin}\r\nVary: Origin\r\n" + CORS_HEADERS

    async def reject(self, status, reason, origin=""):
        body = reason.encode()
        self.writer.write(
            (
                f"HTTP/1.1 {status} {reason}\r\n"
                "Content-Type: text/plain; charset=utf-8\r\n"
                f"Content-Length: {len(body)}\r\n"
                f"{self.cors_block(origin)}"
                "Connection: close\r\n\r\n"
            ).encode()
            + body
        )
        await self.writer.drain()

    # ----- HTTP 中转（给 Robot App 解决上游不支持 CORS 的问题） -----
    async def relay(self, method, path, headers, origin):
        if method == "OPTIONS":
            self.writer.write(
                ("HTTP/1.1 204 No Content\r\n" f"{self.cors_block(origin)}" "Content-Length: 0\r\nConnection: close\r\n\r\n").encode()
            )
            await self.writer.drain()
            return

        if method not in ("GET", "POST"):
            await self.reject(405, "Method Not Allowed", origin)
            return

        base = headers.get("x-relay-base", "").strip()
        target = urlparse(base)
        if target.scheme not in ("http", "https") or not target.hostname:
            await self.reject(400, "X-Relay-Base must be an http(s) URL", origin)
            return

        try:
            length = int(headers.get("content-length", "0") or 0)
        except ValueError:
            length = 0
        if length < 0 or length > RELAY_MAX_BODY:
            await self.reject(413, "Body too large", origin)
            return
        body = await self.reader.readexactly(length) if length else b""

        upstream_path = target.path.rstrip("/") + "/" + path[len(RELAY_PREFIX):]
        port = target.port or (443 if target.scheme == "https" else 80)
        host_header = target.hostname if port in (80, 443) else f"{target.hostname}:{port}"

        forward = [
            f"{method} {upstream_path} HTTP/1.1",
            f"Host: {host_header}",
            "Connection: close",
            "Accept-Encoding: identity",
            "User-Agent: studio-bridge/1.0",
        ]
        for name in ("authorization", "content-type", "accept"):
            if name in headers:
                forward.append(f"{name.title()}: {headers[name]}")
        forward.append(f"Content-Length: {len(body)}")
        request = ("\r\n".join(forward) + "\r\n\r\n").encode("latin-1") + body

        log.info("中转 %s %s → %s%s", self.peer_key, method, target.netloc, upstream_path)
        up_reader = up_writer = None
        try:
            ssl_ctx = ssl.create_default_context() if target.scheme == "https" else None
            up_reader, up_writer = await asyncio.wait_for(
                asyncio.open_connection(target.hostname, port, ssl=ssl_ctx, server_hostname=target.hostname if ssl_ctx else None),
                timeout=20,
            )
            up_writer.write(request)
            await up_writer.drain()

            head = await asyncio.wait_for(up_reader.readuntil(b"\r\n\r\n"), timeout=RELAY_TIMEOUT)
            lines = head.decode("latin-1").split("\r\n")
            status_line = lines[0] if lines else "HTTP/1.1 502 Bad Gateway"
            passthrough = []
            for line in lines[1:]:
                if not line:
                    continue
                key = line.split(":", 1)[0].strip().lower()
                if key in ("connection", "keep-alive", "transfer-encoding", "content-length") or key.startswith("access-control-"):
                    continue
                passthrough.append(line)
            # 统一按「读到 EOF 即结束」的方式回传：去掉上游分块/长度头，改为 Connection: close
            self.writer.write(
                (
                    status_line + "\r\n" + "\r\n".join(passthrough) + ("\r\n" if passthrough else "")
                    + self.cors_block(origin) + "Connection: close\r\n\r\n"
                ).encode("latin-1")
            )
            await self.writer.drain()

            chunked = any(l.lower().startswith("transfer-encoding:") and "chunked" in l.lower() for l in lines[1:])
            if chunked:
                await self.relay_chunked(up_reader)
            else:
                while True:
                    chunk = await asyncio.wait_for(up_reader.read(65536), timeout=RELAY_TIMEOUT)
                    if not chunk:
                        break
                    self.writer.write(chunk)
                    await self.writer.drain()
        except (asyncio.TimeoutError, OSError, ssl.SSLError, asyncio.IncompleteReadError) as exc:
            log.warning("中转失败 %s: %r", self.peer_key, exc)
            try:
                await self.reject(502, f"Relay failed: {exc.__class__.__name__}", origin)
            except Exception:
                pass
        finally:
            if up_writer is not None:
                up_writer.close()

    async def relay_chunked(self, up_reader):
        """解开上游的 chunked 编码，把纯正文流式写给浏览器。"""
        while True:
            size_line = await asyncio.wait_for(up_reader.readline(), timeout=RELAY_TIMEOUT)
            if not size_line:
                return
            try:
                size = int(size_line.split(b";")[0].strip() or b"0", 16)
            except ValueError:
                return
            if size == 0:
                return
            remaining = size
            while remaining > 0:
                chunk = await up_reader.read(min(65536, remaining))
                if not chunk:
                    return
                remaining -= len(chunk)
                self.writer.write(chunk)
                await self.writer.drain()
            await up_reader.readexactly(2)  # 每个 chunk 后面的 CRLF

    # ----- 主循环 -----
    async def run(self):
        sender_task = None
        try:
            if not await self.handshake():
                return
            sender_task = asyncio.create_task(self.sender())
            log.info("连接 %s", self.peer_key)
            deadline = time.monotonic() + AUTH_TIMEOUT
            while not self.closed:
                timeout = None if self.authed else max(1, deadline - time.monotonic())
                try:
                    opcode, payload = await asyncio.wait_for(read_frame(self.reader), timeout=timeout)
                except asyncio.TimeoutError:
                    log.info("未认证连接超时 %s", self.peer_key)
                    break
                if opcode == 0x8:
                    break
                if opcode == 0x9:
                    self.send_raw(encode_frame(payload, 0xA))
                    continue
                if opcode == 0xA:
                    continue
                try:
                    msg = json.loads(payload.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    continue
                if not isinstance(msg, dict):
                    continue
                if not await self.handle(msg):
                    break
        except (asyncio.IncompleteReadError, ConnectionError, WSError, asyncio.TimeoutError) as exc:
            log.debug("连接结束 %s: %r", self.peer_key, exc)
        except Exception:
            log.exception("会话异常 %s", self.peer_key)
        finally:
            await self.cleanup(sender_task)

    async def handle(self, msg):
        kind = msg.get("type")
        if kind == "hello":
            self.send_json({"type": "hello", "host": socket.gethostname(), "shell": os.path.basename(self.config.shell), "relay": True})
            return True

        if kind == "auth":
            if self.authed:
                return True
            if self.failures.locked(self.peer_key):
                await asyncio.sleep(1.0)
                self.send_json({"type": "auth", "ok": False, "error": "失败次数过多，请稍后再试"})
                await self.flush()
                return False
            password = str(msg.get("password", ""))
            if hmac.compare_digest(password.encode(), self.config.password.encode()):
                self.authed = True
                self.failures.reset(self.peer_key)
                self.send_json({"type": "auth", "ok": True})
                self.spawn_shell()
                log.info("认证成功 %s，pid=%s", self.peer_key, self.pid)
                return True
            count = self.failures.record_failure(self.peer_key)
            log.warning("认证失败 %s（第 %d 次）", self.peer_key, count)
            await asyncio.sleep(1.0)
            self.send_json({"type": "auth", "ok": False, "error": "密码错误"})
            await self.flush()
            return False

        if not self.authed:
            self.send_json({"type": "auth", "ok": False, "error": "未认证"})
            await self.flush()
            return False

        if kind == "input":
            data = msg.get("data", "")
            if isinstance(data, str) and self.fd is not None:
                try:
                    os.write(self.fd, data.encode("utf-8"))
                except OSError:
                    return False
            return True

        if kind == "resize":
            self.set_winsize(msg.get("rows"), msg.get("cols"))
            return True

        return True

    async def flush(self):
        # 让 sender 把队列里的消息发完再断开
        for _ in range(50):
            if self.outbox.empty():
                break
            await asyncio.sleep(0.02)

    # ----- PTY -----
    def spawn_shell(self):
        pid, fd = pty.fork()
        if pid == 0:  # 子进程
            env = dict(os.environ)
            env["TERM"] = "xterm-256color"
            env["COLORTERM"] = "truecolor"
            env["STUDIO_BRIDGE"] = "1"
            env["LANG"] = env.get("LANG") or "C.UTF-8"
            try:
                os.chdir(os.path.expanduser("~"))
            except OSError:
                pass
            shell = self.config.shell
            argv = [shell, "-l"] if os.path.basename(shell) in ("bash", "zsh", "fish", "sh") else [shell]
            try:
                os.execvpe(shell, argv, env)
            except OSError as exc:
                sys.stderr.write(f"无法启动 shell {shell}: {exc}\n")
                os._exit(127)

        self.pid = pid
        self.fd = fd
        os.set_blocking(fd, False)
        self.set_winsize(24, 80)
        asyncio.get_running_loop().add_reader(fd, self.on_pty_readable)

    def set_winsize(self, rows, cols):
        if self.fd is None:
            return
        try:
            rows = max(2, min(500, int(rows or 24)))
            cols = max(2, min(1000, int(cols or 80)))
            fcntl.ioctl(self.fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
        except (OSError, ValueError, TypeError):
            pass

    def on_pty_readable(self):
        try:
            data = os.read(self.fd, 65536)
        except BlockingIOError:
            return
        except OSError:
            data = b""
        if not data:
            self.on_shell_exit()
            return
        self.send_json({"type": "output", "data": self.decoder.decode(data)})

    def on_shell_exit(self):
        loop = asyncio.get_running_loop()
        if self.fd is not None:
            try:
                loop.remove_reader(self.fd)
            except (ValueError, OSError):
                pass
        code = self.reap()
        self.send_json({"type": "exit", "code": code})
        # 稍后关闭连接，给 sender 一点时间
        loop.call_later(0.3, self.close)

    def reap(self):
        if self.pid is None:
            return None
        try:
            _, status = os.waitpid(self.pid, os.WNOHANG)
            if status:
                return os.waitstatus_to_exitcode(status)
        except ChildProcessError:
            return None
        return None

    def close(self):
        if self.closed:
            return
        self.closed = True
        self.outbox.put_nowait(None)
        try:
            self.writer.close()
        except Exception:
            pass

    async def cleanup(self, sender_task):
        loop = asyncio.get_running_loop()
        if self.fd is not None:
            try:
                loop.remove_reader(self.fd)
            except (ValueError, OSError):
                pass
            try:
                os.close(self.fd)
            except OSError:
                pass
            self.fd = None
        if self.pid is not None:
            for sig in (signal.SIGHUP, signal.SIGTERM, signal.SIGKILL):
                try:
                    os.kill(self.pid, sig)
                except ProcessLookupError:
                    break
                for _ in range(20):
                    try:
                        pid, _ = os.waitpid(self.pid, os.WNOHANG)
                    except ChildProcessError:
                        pid = self.pid
                    if pid:
                        break
                    await asyncio.sleep(0.05)
                else:
                    continue
                break
            self.pid = None
        self.close()
        if sender_task:
            try:
                await asyncio.wait_for(sender_task, timeout=1)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                sender_task.cancel()
        try:
            await self.writer.wait_closed()
        except Exception:
            pass
        log.info("断开 %s", self.peer_key)


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------
class Config:
    def __init__(self, host, port, shell, password, origins):
        self.host = host
        self.port = port
        self.shell = shell
        self.password = password
        self.origins = origins


def build_config(argv=None):
    parser = argparse.ArgumentParser(description="studio.html 终端桥接（WebSocket ⇄ PTY）")
    parser.add_argument("--host", default=os.environ.get("STUDIO_TERM_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("STUDIO_TERM_PORT", "7681")))
    parser.add_argument("--shell", default=os.environ.get("STUDIO_TERM_SHELL") or os.environ.get("SHELL") or "/bin/bash")
    parser.add_argument("--origins", default=os.environ.get("STUDIO_TERM_ORIGINS", ""), help="额外允许的 Origin，逗号分隔")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    password = os.environ.get("STUDIO_TERM_PASSWORD", "")
    if not password:
        parser.error("必须通过环境变量 STUDIO_TERM_PASSWORD 设置密码")
    if len(password) < 6:
        log.warning("密码太短，建议至少 6 位")

    origins = set(o.lower() for o in DEFAULT_ORIGINS)
    origins.update(o.strip().lower() for o in args.origins.split(",") if o.strip())

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )
    return Config(args.host, args.port, args.shell, password, origins)


async def serve(config):
    failures = FailureTracker()

    async def on_connect(reader, writer):
        await Session(reader, writer, config, failures).run()

    server = await asyncio.start_server(on_connect, config.host, config.port, reuse_address=True)
    addrs = ", ".join(str(s.getsockname()[:2]) for s in server.sockets or [])
    log.info("studio-bridge 监听 %s · shell=%s", addrs, config.shell)
    if config.host not in ("127.0.0.1", "localhost", "::1"):
        log.warning("监听地址不是 localhost —— 请确保前面有 TLS 反向代理并且密码足够强")
    log.info("在 studio.html 的终端锁屏输入密码即可进入；Ctrl+C 停止")
    async with server:
        await server.serve_forever()


def main():
    config = build_config()
    try:
        asyncio.run(serve(config))
    except KeyboardInterrupt:
        log.info("已停止")


if __name__ == "__main__":
    main()
