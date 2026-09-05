/* =============================================================
 * Huanfly · huanfly-os（显示器聚焦后的应用层）
 * - 桌面 / Dock / 顶栏时钟
 * - 终端：WebSocket 桥接到本机 PTY（server/studio-bridge.py，需密码），
 *         桥接离线时降级为浏览器内「访客终端」
 * - 相册：复用 interests/<类别>/index.json
 * - Robot：OpenAI 兼容流式聊天，配置只存 localStorage
 * 依赖：window.STUDIO_CONFIG（studio.html 内联）、window.Studio（js/studio.js）
 * 对外：window.StudioOS = { open, wake, sleep, handleEscape }
 * ============================================================= */
(function () {
    'use strict';

    const CONFIG = window.STUDIO_CONFIG || {};
    const $ = (id) => document.getElementById(id);
    const focusLayer = $('monitor-focus');
    if (!focusLayer) return;

    /* -------------------------------------------------------------
     * 工具
     * ----------------------------------------------------------- */
    const loadedAssets = new Map();

    function loadScript(src) {
        if (loadedAssets.has(src)) return loadedAssets.get(src);
        const p = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('加载失败: ' + src));
            document.head.appendChild(s);
        });
        loadedAssets.set(src, p);
        return p;
    }

    function loadStyle(href) {
        if (loadedAssets.has(href)) return loadedAssets.get(href);
        const p = new Promise((resolve) => {
            const l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = href;
            l.onload = () => resolve();
            l.onerror = () => resolve();
            document.head.appendChild(l);
        });
        loadedAssets.set(href, p);
        return p;
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function storageGet(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function storageSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    }

    const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    function greeting() {
        const h = new Date().getHours();
        if (h < 5) return '夜深了，保存进度，早点休息 🌙';
        if (h < 9) return '早上好，窗边的光刚刚好 🌿';
        if (h < 12) return '上午好，适合焊点东西 ☀️';
        if (h < 14) return '午安，先吃饭，板子不会跑 🍃';
        if (h < 18) return '下午好，泡杯茶继续 🍵';
        if (h < 22) return '晚上好，窗外的星星亮了 ✨';
        return '夜间工作模式已开启 🌙';
    }

    /* -------------------------------------------------------------
     * OS 骨架
     * ----------------------------------------------------------- */
    const appEls = {};
    focusLayer.querySelectorAll('.os-app').forEach((el) => { appEls[el.dataset.app] = el; });
    const TITLES = { desktop: '桌面', terminal: '终端', album: '相册', robot: 'Robot' };
    const hooks = {};   // appId -> { onOpen, onClose, onEscape }
    let currentApp = 'desktop';
    let awake = false;

    function open(id) {
        if (!appEls[id]) return;
        if (currentApp !== id && hooks[currentApp] && hooks[currentApp].onClose) {
            hooks[currentApp].onClose();
        }
        Object.keys(appEls).forEach((k) => appEls[k].classList.toggle('active', k === id));
        currentApp = id;
        $('os-title').textContent = TITLES[id] || id;
        if (hooks[id] && hooks[id].onOpen) hooks[id].onOpen();
    }

    function tickOsClock() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        $('os-clock').textContent = `${hh}:${mm}`;
        $('os-time').textContent = `${hh}:${mm}`;
        $('os-date').textContent = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${WEEKDAYS[now.getDay()]}`;
        $('os-greet').textContent = greeting();
    }
    tickOsClock();
    setInterval(tickOsClock, 15000);

    focusLayer.querySelectorAll('[data-open]').forEach((btn) => {
        btn.addEventListener('click', () => open(btn.dataset.open));
    });
    $('os-home').addEventListener('click', () => open('desktop'));

    function wake() {
        awake = true;
        tickOsClock();
        open(currentApp || 'desktop');
    }

    function sleep() {
        awake = false;
        if (hooks[currentApp] && hooks[currentApp].onClose) hooks[currentApp].onClose();
    }

    function handleEscape() {
        const h = hooks[currentApp];
        if (h && h.onEscape && h.onEscape()) return true;
        if (currentApp !== 'desktop') {
            open('desktop');
            return true;
        }
        return false;
    }

    window.StudioOS = { open, wake, sleep, handleEscape, isAwake: () => awake };

    /* =============================================================
     * 终端
     * ============================================================= */
    const TerminalApp = (function () {
        const WS_URL = (CONFIG.terminal && CONFIG.terminal.wsUrl) || 'ws://127.0.0.1:7681/';
        const XTERM_CSS = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css';
        const XTERM_JS = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js';
        const FIT_JS = 'https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js';

        const els = {
            lock: $('term-lock'),
            status: $('term-status'),
            form: $('term-form'),
            password: $('term-password'),
            submit: $('term-submit'),
            guest: $('term-guest'),
            body: $('term-body'),
            dot: $('term-dot'),
            mode: $('term-mode-label'),
            relock: $('term-relock')
        };

        let term = null;
        let fitAddon = null;
        let resizeObs = null;
        let ws = null;
        let mode = null;          // null | 'bridge' | 'guest'
        let probing = false;
        let bridgeInfo = null;
        let probeTimer = null;
        let guest = null;
        let lastAuthError = '';

        function setStatus(html, cls) {
            els.status.innerHTML = html;
            els.status.className = 'lock-status' + (cls ? ' ' + cls : '');
        }

        function setMode(m) {
            mode = m;
            els.dot.className = 'dot' + (m === 'bridge' ? ' online' : m === 'guest' ? ' guest' : bridgeInfo === false ? ' offline' : '');
            els.mode.textContent = m === 'bridge'
                ? ('已连接 ' + (bridgeInfo && bridgeInfo.host ? bridgeInfo.host : '宿主机'))
                : m === 'guest' ? '访客模式（模拟）' : (bridgeInfo === false ? '桥接离线' : '未连接');
        }

        async function ensureXterm() {
            if (window.Terminal && window.FitAddon) return;
            await loadStyle(XTERM_CSS);
            await loadScript(XTERM_JS);
            await loadScript(FIT_JS);
        }

        function disposeTerm() {
            if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
            if (term) { term.dispose(); term = null; }
            fitAddon = null;
            els.body.innerHTML = '';
        }

        function createTerm() {
            disposeTerm();
            term = new window.Terminal({
                cursorBlink: true,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Mono', Consolas, 'DejaVu Sans Mono', 'Noto Sans Mono', 'Liberation Mono', monospace",
                fontSize: 14,
                lineHeight: 1.15,
                scrollback: 4000,
                theme: {
                    background: '#0b1210',
                    foreground: '#dcead0',
                    cursor: '#7cc95f',
                    cursorAccent: '#0b1210',
                    selectionBackground: 'rgba(124, 201, 95, 0.32)',
                    black: '#0b1210',
                    red: '#ee9a88',
                    green: '#7cc95f',
                    yellow: '#f2c46e',
                    blue: '#6fa8dc',
                    magenta: '#b39aec',
                    cyan: '#6fd8e2',
                    white: '#dcead0',
                    brightBlack: '#5a6a60',
                    brightRed: '#f7b4a5',
                    brightGreen: '#8fd873',
                    brightYellow: '#ffd98a',
                    brightBlue: '#8fc1ec',
                    brightMagenta: '#c9b4f4',
                    brightCyan: '#7ee3ec',
                    brightWhite: '#f2f8f1'
                }
            });
            fitAddon = new window.FitAddon.FitAddon();
            term.loadAddon(fitAddon);
            term.open(els.body);
            fit();
            resizeObs = new ResizeObserver(() => fit());
            resizeObs.observe(els.body);
        }

        function fit() {
            if (!term || !fitAddon) return;
            try { fitAddon.fit(); } catch (e) { /* 容器未显示时忽略 */ }
            if (mode === 'bridge' && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
            }
        }

        function closeWs() {
            if (ws) {
                ws.onclose = null;
                ws.onmessage = null;
                ws.onerror = null;
                try { ws.close(); } catch (e) { /* ignore */ }
                ws = null;
            }
        }

        function probe() {
            if (probing || mode) return;
            probing = true;
            closeWs();
            bridgeInfo = null;
            if (!lastAuthError) setStatus('<i class="fas fa-spinner fa-spin"></i>正在探测终端桥接…', '');
            els.password.disabled = true;
            els.submit.disabled = true;
            setMode(null);

            let settled = false;
            const finishOffline = (why) => {
                if (settled) return;
                settled = true;
                probing = false;
                bridgeInfo = false;
                setStatus(`<i class="fas fa-plug-circle-xmark"></i>${why || '未检测到桥接服务'} · <button type="button" class="os-btn" data-term-retry>重试</button>`, 'offline');
                setMode(null);
                els.guest.classList.add('primary');
            };

            clearTimeout(probeTimer);
            probeTimer = setTimeout(() => finishOffline('桥接未响应'), 3000);

            let socket;
            try {
                socket = new WebSocket(WS_URL);
            } catch (e) {
                clearTimeout(probeTimer);
                finishOffline('桥接地址无效');
                return;
            }
            ws = socket;

            socket.onopen = () => {
                socket.send(JSON.stringify({ type: 'hello' }));
            };

            socket.onmessage = (ev) => {
                let msg;
                try { msg = JSON.parse(ev.data); } catch (e) { return; }
                if (msg.type === 'hello') {
                    settled = true;
                    probing = false;
                    clearTimeout(probeTimer);
                    bridgeInfo = { host: msg.host || '', shell: msg.shell || '' };
                    if (lastAuthError) {
                        setStatus(`<i class="fas fa-triangle-exclamation"></i>${escapeHtml(lastAuthError)}，请重试`, 'error');
                        lastAuthError = '';
                    } else {
                        setStatus(`<i class="fas fa-plug-circle-check"></i>桥接在线 · ${escapeHtml(bridgeInfo.host || 'localhost')}${bridgeInfo.shell ? ' · ' + escapeHtml(bridgeInfo.shell) : ''}`, 'online');
                    }
                    els.password.disabled = false;
                    els.submit.disabled = false;
                    els.guest.classList.remove('primary');
                    setMode(null);
                    els.password.focus();
                } else if (msg.type === 'auth') {
                    onAuthResult(msg);
                } else if (msg.type === 'output') {
                    if (term) term.write(msg.data);
                } else if (msg.type === 'exit') {
                    if (term) term.write('\r\n\x1b[90m[会话已结束，按「锁定」重新连接]\x1b[0m\r\n');
                }
            };

            socket.onerror = () => { /* onclose 统一处理 */ };

            socket.onclose = () => {
                if (ws !== socket) return;
                ws = null;
                if (!settled) {
                    clearTimeout(probeTimer);
                    finishOffline();
                    return;
                }
                if (mode === 'bridge') {
                    if (term) term.write('\r\n\x1b[90m[连接已断开，按「锁定」重新连接]\x1b[0m\r\n');
                    els.dot.className = 'dot offline';
                    els.mode.textContent = '连接已断开';
                } else if (!mode && currentApp === 'terminal') {
                    // 认证失败后服务端会断开：稍后重新探测以便再次输入
                    setTimeout(probe, 500);
                }
            };
        }

        function onAuthResult(msg) {
            if (msg.ok) {
                enterBridge();
            } else {
                lastAuthError = msg.error || '密码错误';
                setStatus(`<i class="fas fa-triangle-exclamation"></i>${escapeHtml(lastAuthError)}`, 'error');
                els.password.value = '';
                els.password.disabled = false;
                els.submit.disabled = false;
                els.password.focus();
            }
        }

        async function enterBridge() {
            setMode('bridge');
            els.lock.classList.add('hidden');
            try {
                await ensureXterm();
            } catch (e) {
                els.lock.classList.remove('hidden');
                setStatus('<i class="fas fa-triangle-exclamation"></i>xterm.js 加载失败，请检查网络后重试', 'error');
                closeWs();
                mode = null;
                return;
            }
            createTerm();
            term.onData((data) => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'input', data }));
                }
            });
            fit();
            term.focus();
        }

        async function enterGuest() {
            closeWs();
            probing = false;
            setMode('guest');
            els.lock.classList.add('hidden');
            try {
                await ensureXterm();
            } catch (e) {
                els.lock.classList.remove('hidden');
                setStatus('<i class="fas fa-triangle-exclamation"></i>xterm.js 加载失败，请检查网络后重试', 'error');
                mode = null;
                return;
            }
            createTerm();
            guest = createGuestShell(term);
            term.focus();
        }

        function lock() {
            closeWs();
            disposeTerm();
            guest = null;
            mode = null;
            probing = false;
            els.lock.classList.remove('hidden');
            els.password.value = '';
            setMode(null);
            probe();
        }

        els.form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                setStatus('<i class="fas fa-plug-circle-xmark"></i>桥接未连接 · <button type="button" class="os-btn" data-term-retry>重试</button>', 'offline');
                return;
            }
            const pw = els.password.value;
            if (!pw) return;
            els.password.disabled = true;
            els.submit.disabled = true;
            setStatus('<i class="fas fa-spinner fa-spin"></i>验证中…', '');
            ws.send(JSON.stringify({ type: 'auth', password: pw }));
        });

        els.guest.addEventListener('click', enterGuest);
        els.relock.addEventListener('click', lock);
        els.lock.addEventListener('click', (e) => {
            if (e.target.closest('[data-term-retry]')) {
                probing = false;
                probe();
            }
        });

        hooks.terminal = {
            onOpen() {
                if (!mode) {
                    probe();
                } else {
                    requestAnimationFrame(() => { fit(); if (term) term.focus(); });
                }
            },
            onClose() { /* 会话保持，切回时继续 */ },
            onEscape() {
                // 解锁状态下 Esc 交给终端本身（vim 等），用「离开显示器」按钮退出
                return !!(mode && term && document.activeElement && els.body.contains(document.activeElement));
            }
        };

        /* ---------------- 访客模拟 shell ---------------- */
        function createGuestShell(t) {
            const C = {
                reset: '\x1b[0m', dim: '\x1b[90m', green: '\x1b[32m', bgreen: '\x1b[92m', cyan: '\x1b[36m',
                yellow: '\x1b[33m', red: '\x1b[31m', magenta: '\x1b[35m', bold: '\x1b[1m'
            };
            const PROMPT = `${C.bgreen}guest@huanfly${C.reset}:${C.cyan}~${C.reset}$ `;
            let buf = '';
            let cursor = 0;
            const history = [];
            let histIdx = -1;
            let postsCache = null;

            const FILES = {
                'about.txt': [
                    '你好！我是 Huanfly，嵌入式软件工程师。',
                    '日常围绕 MCU、RTOS 与外设系统做开发，也长期做软硬件协同实践。',
                    '目前有一间小工作室，可以做一些小型嵌入式产品的全流程开发。',
                    '喜欢科技制作：多旋翼飞控、自平衡小摩托、智能聊天终端……'
                ],
                'skills.txt': ['嵌入式软件', '无人机飞控', 'FOC', '工业 3D 建模', 'FDM 3D 打印', 'RT-Thread', 'C / Python / JavaScript'],
                'contact.txt': [
                    'GitHub   https://github.com/Huanfiy',
                    'Gitee    https://gitee.com/Huanfly',
                    'Bilibili https://space.bilibili.com/179895513',
                    'Email    huanfly999@gmail.com'
                ],
                'README.md': [
                    '# huanfly-studio',
                    '',
                    '这是一个浏览器内的模拟 shell，不会碰到任何真实文件。',
                    '想用真实终端？在本机运行 `STUDIO_TERM_PASSWORD=… ./run.sh term`，然后回到锁屏输入密码。',
                    '',
                    '输入 `help` 查看可用命令。'
                ]
            };

            const write = (s) => t.write(s);
            const writeln = (s = '') => t.write(s + '\r\n');

            function banner() {
                writeln(`${C.green}  ┌─ H7 ─┐  ${C.reset}${C.bold}huanfly-os${C.reset} ${C.dim}guest shell · v2.0${C.reset}`);
                writeln(`${C.green} ─┤ LAB  ├─ ${C.reset}${C.dim}欢迎来到工作室。这里是模拟终端，随便敲，不伤机器。${C.reset}`);
                writeln(`${C.green}  └──────┘  ${C.reset}${C.dim}输入 ${C.reset}help${C.dim} 查看命令，${C.reset}exit${C.dim} 回到桌面。${C.reset}`);
                writeln();
            }

            const commands = {
                help() {
                    writeln(`${C.bold}可用命令${C.reset}`);
                    const rows = [
                        ['help', '显示本帮助'], ['ls', '列出文件'], ['cat <file>', '查看文件'],
                        ['posts', '列出博客文章'], ['open <n|blog|tools|about|home>', '打开文章或页面'],
                        ['neofetch', '系统信息'], ['studio <pcb|scope|solder|printer|motor|arm|plant|window>', '操控工作室里的物件'],
                        ['theme', '切换昼夜'], ['date', '当前时间'], ['echo <text>', '回显'],
                        ['history', '命令历史'], ['clear', '清屏 (Ctrl+L)'], ['exit', '回到桌面']
                    ];
                    rows.forEach(([c, d]) => writeln(`  ${C.cyan}${c.padEnd(42)}${C.reset}${C.dim}${d}${C.reset}`));
                },
                ls() {
                    writeln(Object.keys(FILES).map((f) => (f.endsWith('.md') ? `${C.yellow}${f}${C.reset}` : f)).join('  ') + `  ${C.bold}${C.cyan}posts/${C.reset}  ${C.bold}${C.cyan}tools/${C.reset}`);
                },
                cat(args) {
                    const f = args[0];
                    if (!f) { writeln(`cat: 需要文件名`); return; }
                    if (FILES[f]) { FILES[f].forEach((l) => writeln(l)); return; }
                    if (f === 'posts/' || f === 'posts') { writeln('cat: posts/: 是一个目录，试试 posts'); return; }
                    writeln(`cat: ${f}: 没有那个文件或目录`);
                },
                pwd() { writeln('/home/guest'); },
                whoami() { writeln('guest'); },
                uname() { writeln('huanfly-os 2.0 studio x86_64 GNU/Lab'); },
                date() { writeln(new Date().toString()); },
                echo(args) { writeln(args.join(' ')); },
                clear() { t.clear(); },
                history() { history.forEach((h, i) => writeln(`  ${String(i + 1).padStart(3)}  ${h}`)); },
                sudo() { writeln(`${C.red}guest: 当前会话没有管理员权限。${C.reset}`); },
                rm() { writeln(`${C.yellow}rm: 这里什么都删不掉，包括黑历史。${C.reset}`); },
                cd() { writeln(`${C.dim}这间工作室只有一个房间。${C.reset}`); },
                theme() {
                    if (window.Studio) window.Studio.toggleTheme();
                    writeln(`${C.dim}已切换昼夜。${C.reset}`);
                },
                neofetch() {
                    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
                    const lines = [
                        `${C.bold}${C.green}guest${C.reset}@${C.bold}${C.green}huanfly-studio${C.reset}`,
                        `${C.dim}-----------------------${C.reset}`,
                        `${C.green}OS${C.reset}       huanfly-os 2.0 (lab edition)`,
                        `${C.green}Host${C.reset}     嵌入式开发台 · 机电实验台`,
                        `${C.green}Kernel${C.reset}   lab 2026.09`,
                        `${C.green}Shell${C.reset}    guest-sh (simulated)`,
                        `${C.green}Theme${C.reset}    ${dark ? '窗边夜灯' : '午后工作室'}`,
                        `${C.green}Bench${C.reset}    STM32 H7 · T12 · DSO · BLDC`,
                        `${C.green}Printer${C.reset}  FDM · ${window.Studio ? window.Studio.state.printer : 'idle'}`,
                        `${C.green}Motion${C.reset}   机械臂 · 无刷电机测试台`
                    ];
                    const art = [
                        `${C.green}  ┌─────────┐ ${C.reset}`,
                        `${C.green} ─┤  H 7    ├─${C.reset}`,
                        `${C.green} ─┤         ├─${C.reset}`,
                        `${C.green} ─┤   LAB   ├─${C.reset}`,
                        `${C.green}  └─────────┘ ${C.reset}`,
                        `              `, `              `, `              `, `              `, `              `
                    ];
                    art.forEach((a, i) => writeln(a + '  ' + (lines[i] || '')));
                },
                async posts() {
                    try {
                        if (!postsCache) {
                            const r = await fetch('posts/posts.json');
                            postsCache = r.ok ? await r.json() : [];
                        }
                        if (!postsCache.length) { writeln('暂无文章'); return; }
                        postsCache.forEach((p, i) => writeln(`  ${C.cyan}${String(i + 1).padStart(2)}${C.reset}  ${C.dim}${p.date || ''}${C.reset}  ${p.title}`));
                        writeln(`${C.dim}用 open <编号> 打开文章${C.reset}`);
                    } catch (e) {
                        writeln(`${C.red}读取 posts.json 失败${C.reset}`);
                    }
                },
                async open(args) {
                    const target = (args[0] || '').toLowerCase();
                    const pages = { blog: 'blog.html', tools: 'tool.html', tool: 'tool.html', about: 'about.html', home: 'index.html', index: 'index.html' };
                    if (pages[target]) { writeln(`${C.dim}正在打开 ${pages[target]} …${C.reset}`); setTimeout(() => { window.location.href = pages[target]; }, 400); return; }
                    const n = parseInt(target, 10);
                    if (!Number.isNaN(n)) {
                        if (!postsCache) await commands.posts();
                        const p = postsCache && postsCache[n - 1];
                        if (!p) { writeln(`open: 没有第 ${n} 篇文章`); return; }
                        writeln(`${C.dim}正在打开《${p.title}》…${C.reset}`);
                        setTimeout(() => { window.location.href = 'blog.html#post=' + encodeURIComponent(p.file); }, 400);
                        return;
                    }
                    writeln('用法: open <编号|blog|tools|about|home>');
                },
                studio(args) {
                    const id = (args[0] || '').toLowerCase();
                    if (!['pcb', 'scope', 'solder', 'iron', 'printer', 'motor', 'arm', 'plant', 'window'].includes(id)) {
                        writeln('用法: studio <pcb|scope|solder|printer|motor|arm|plant|window>'); return;
                    }
                    if (window.Studio && window.Studio.action(id)) {
                        writeln(`${C.dim}已切换 ${id}。退出显示器看看效果。${C.reset}`);
                    } else {
                        writeln('3D 场景尚未就绪。');
                    }
                },
                exit() {
                    writeln(`${C.dim}再见。${C.reset}`);
                    setTimeout(() => open('desktop'), 200);
                }
            };
            commands.ll = commands.ls;
            commands.dir = commands.ls;
            commands.man = commands.help;
            commands['?'] = commands.help;

            async function run(line) {
                const trimmed = line.trim();
                if (!trimmed) return;
                history.push(trimmed);
                const [cmd, ...args] = trimmed.split(/\s+/);
                const fn = commands[cmd];
                if (!fn) {
                    writeln(`${cmd}: 未找到命令。输入 help 查看可用命令。`);
                    return;
                }
                try {
                    await fn(args);
                } catch (e) {
                    writeln(`${C.red}${cmd}: ${e.message}${C.reset}`);
                }
            }

            function redraw() {
                write('\r\x1b[K' + PROMPT + buf);
                const back = buf.length - cursor;
                if (back > 0) write(`\x1b[${back}D`);
            }

            let busy = false;
            t.onData(async (data) => {
                if (busy) return;
                for (const ch of splitInput(data)) {
                    if (ch === '\r') {
                        write('\r\n');
                        const line = buf;
                        buf = '';
                        cursor = 0;
                        histIdx = -1;
                        busy = true;
                        await run(line);
                        busy = false;
                        write(PROMPT);
                    } else if (ch === '\u007f') {
                        if (cursor > 0) {
                            buf = buf.slice(0, cursor - 1) + buf.slice(cursor);
                            cursor -= 1;
                            redraw();
                        }
                    } else if (ch === '\u0003') {
                        write('^C\r\n' + PROMPT);
                        buf = '';
                        cursor = 0;
                    } else if (ch === '\u000c') {
                        t.clear();
                        redraw();
                    } else if (ch === '\x1b[A') {
                        if (!history.length) continue;
                        histIdx = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
                        buf = history[histIdx];
                        cursor = buf.length;
                        redraw();
                    } else if (ch === '\x1b[B') {
                        if (histIdx < 0) continue;
                        histIdx += 1;
                        buf = histIdx >= history.length ? '' : history[histIdx];
                        if (histIdx >= history.length) histIdx = -1;
                        cursor = buf.length;
                        redraw();
                    } else if (ch === '\x1b[C') {
                        if (cursor < buf.length) { cursor += 1; write('\x1b[C'); }
                    } else if (ch === '\x1b[D') {
                        if (cursor > 0) { cursor -= 1; write('\x1b[D'); }
                    } else if (ch === '\x1b[H' || ch === '\x01') {
                        cursor = 0; redraw();
                    } else if (ch === '\x1b[F' || ch === '\x05') {
                        cursor = buf.length; redraw();
                    } else if (ch === '\t') {
                        const names = Object.keys(commands).filter((c) => c.startsWith(buf) && buf);
                        if (names.length === 1) { buf = names[0] + ' '; cursor = buf.length; redraw(); }
                        else if (names.length > 1) { write('\r\n' + names.join('  ') + '\r\n'); redraw(); }
                    } else if (ch.length === 1 && ch >= ' ') {
                        buf = buf.slice(0, cursor) + ch + buf.slice(cursor);
                        cursor += 1;
                        if (cursor === buf.length) write(ch); else redraw();
                    } else if (ch.length > 1 && !ch.startsWith('\x1b')) {
                        // 粘贴 / 多字节输入
                        buf = buf.slice(0, cursor) + ch + buf.slice(cursor);
                        cursor += ch.length;
                        redraw();
                    }
                }
            });

            function splitInput(data) {
                // 把转义序列作为整体，其余按字符拆分
                const out = [];
                let i = 0;
                while (i < data.length) {
                    if (data[i] === '\x1b') {
                        let j = i + 1;
                        while (j < data.length && !/[A-Za-z~]/.test(data[j])) j += 1;
                        out.push(data.slice(i, j + 1));
                        i = j + 1;
                    } else if (data[i] === '\r' || data[i] === '\u007f' || data[i] < ' ') {
                        out.push(data[i]);
                        i += 1;
                    } else {
                        let j = i;
                        while (j < data.length && data[j] !== '\x1b' && data[j] !== '\r' && data[j] !== '\u007f' && data[j] >= ' ') j += 1;
                        out.push(data.slice(i, j));
                        i = j;
                    }
                }
                return out;
            }

            banner();
            write(PROMPT);
            return { run };
        }

        return { lock };
    })();

    /* =============================================================
     * 相册
     * ============================================================= */
    const AlbumApp = (function () {
        const SOURCES = {
            photography: { url: 'interests/photography/index.json', label: '摄影' },
            tech: { url: 'interests/tech/index.json', label: '制作' }
        };
        const grid = $('album-grid');
        const tabs = $('album-tabs');
        const viewer = $('album-viewer');
        const viewerImg = $('album-viewer-img');
        const viewerCaption = $('album-viewer-caption');
        const viewerIndex = $('album-viewer-index');
        const cache = {};
        let current = 'photography';
        let items = [];
        let viewerIdx = -1;
        let loaded = false;
        let loadVersion = 0;

        async function load(key) {
            const version = ++loadVersion;
            closeViewer();
            current = key;
            tabs.querySelectorAll('[data-album]').forEach((b) => {
                const on = b.dataset.album === key;
                b.classList.toggle('primary', on);
                b.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            grid.innerHTML = '<div class="album-empty"><i class="fas fa-spinner fa-spin"></i></div>';
            try {
                if (!cache[key]) {
                    const r = await fetch(SOURCES[key].url);
                    if (!r.ok) throw new Error(r.status);
                    const data = await r.json();
                    cache[key] = (Array.isArray(data) ? data : []).filter((it) => it && it.src && it.type !== 'video');
                }
                if (version !== loadVersion) return;
                items = cache[key];
                render();
            } catch (e) {
                if (version !== loadVersion) return;
                items = [];
                grid.innerHTML = '<div class="album-empty"><i class="fas fa-image"></i><p>相册加载失败</p></div>';
            }
        }

        function render() {
            if (!items.length) {
                grid.innerHTML = '<div class="album-empty"><i class="fas fa-image"></i><p>这个相册还是空的</p></div>';
                return;
            }
            grid.innerHTML = items.map((it, i) => `
                <figure class="album-item" role="button" tabindex="0" data-idx="${i}">
                    <img src="${escapeHtml(it.src)}" alt="${escapeHtml(it.caption || '')}" loading="lazy" decoding="async">
                    <figcaption>${escapeHtml(it.caption || '')}</figcaption>
                </figure>`).join('');
        }

        function openViewer(idx) {
            if (!items[idx]) return;
            viewerIdx = idx;
            viewerImg.src = items[idx].src;
            viewerImg.alt = items[idx].caption || '';
            viewerCaption.textContent = items[idx].caption || '';
            viewerIndex.textContent = `${idx + 1} / ${items.length} · ${SOURCES[current].label}`;
            viewer.classList.add('open');
            viewer.setAttribute('aria-hidden', 'false');
            grid.inert = true;
            if (!viewer.contains(document.activeElement)) $('album-close').focus({ preventScroll: true });
        }

        function closeViewer() {
            const previous = viewerIdx;
            viewer.classList.remove('open');
            viewer.setAttribute('aria-hidden', 'true');
            grid.inert = false;
            viewerIdx = -1;
            if (previous >= 0) grid.querySelector(`[data-idx="${previous}"]`)?.focus({ preventScroll: true });
        }

        function step(d) {
            if (viewerIdx < 0 || !items.length) return;
            openViewer((viewerIdx + d + items.length) % items.length);
        }

        grid.addEventListener('click', (e) => {
            const fig = e.target.closest('.album-item');
            if (fig) openViewer(parseInt(fig.dataset.idx, 10));
        });
        grid.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const fig = e.target.closest('.album-item');
            if (fig) { e.preventDefault(); openViewer(parseInt(fig.dataset.idx, 10)); }
        });
        tabs.addEventListener('click', (e) => {
            const b = e.target.closest('[data-album]');
            if (b && b.dataset.album !== current) load(b.dataset.album);
        });
        $('album-prev').addEventListener('click', () => step(-1));
        $('album-next').addEventListener('click', () => step(1));
        $('album-close').addEventListener('click', closeViewer);
        viewer.addEventListener('click', (e) => {
            if (e.target === viewer || e.target.classList.contains('viewer-stage')) closeViewer();
        });
        document.addEventListener('keydown', (e) => {
            if (!awake || currentApp !== 'album' || viewerIdx < 0) return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
            if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        });

        hooks.album = {
            onOpen() {
                if (!loaded) { loaded = true; load(current); }
            },
            onClose() { closeViewer(); },
            onEscape() {
                if (viewerIdx >= 0) { closeViewer(); return true; }
                return false;
            }
        };

        return { load };
    })();

    /* =============================================================
     * Robot
     * ============================================================= */
    const RobotApp = (function () {
        const SETTINGS_KEY = 'studio.robot.settings';
        const HISTORY_KEY = 'studio.robot.history';
        const MARKED_JS = 'https://cdn.jsdelivr.net/npm/marked@4.0.12/marked.min.js';
        const DEFAULT_SYSTEM = '你是 Huanfly Lab 的工程助手，擅长嵌入式开发、电路设计与原型制作。用简洁友好的中文回答；涉及嵌入式、电路、固件、编程问题时给出准确、可操作的建议，不确定就直说。适度使用 Markdown（代码块、列表），不要长篇大论。';
        const defaults = {
            baseUrl: (CONFIG.robot && CONFIG.robot.baseUrl) || 'https://api.openai.com/v1',
            apiKey: '',
            model: (CONFIG.robot && CONFIG.robot.model) || 'gpt-4o-mini',
            system: DEFAULT_SYSTEM,
            relay: false
        };
        // 本地桥接的 HTTP 地址（ws://127.0.0.1:7681/ → http://127.0.0.1:7681）
        const RELAY_HTTP = String((CONFIG.terminal && CONFIG.terminal.wsUrl) || 'ws://127.0.0.1:7681/')
            .replace(/^ws/i, 'http').replace(/\/+$/, '');

        const els = {
            messages: $('robot-messages'),
            form: $('robot-form'),
            input: $('robot-input'),
            send: $('robot-send'),
            stop: $('robot-stop'),
            clear: $('robot-clear'),
            dot: $('robot-dot'),
            modelLabel: $('robot-model-label'),
            settingsBtn: $('robot-settings-btn'),
            settings: $('robot-settings'),
            settingsForm: $('robot-settings-form'),
            base: $('robot-base'),
            key: $('robot-key'),
            model: $('robot-model'),
            modelList: $('robot-model-list'),
            system: $('robot-system'),
            relay: $('robot-relay'),
            status: $('robot-settings-status'),
            cancel: $('robot-settings-cancel'),
            fetchModels: $('robot-fetch-models')
        };

        let settings = Object.assign({}, defaults, storageGet(SETTINGS_KEY, {}));
        let history = storageGet(HISTORY_KEY, []);
        let controller = null;
        let markedPromise = null;
        let rendered = false;

        function saveSettings() { storageSet(SETTINGS_KEY, settings); }
        function saveHistory() { storageSet(HISTORY_KEY, history.slice(-40)); }

        function baseUrl() { return String(settings.baseUrl || '').replace(/\/+$/, ''); }

        // 组装请求地址与头：直连上游，或经本地桥接 /relay/ 中转
        function buildRequest(path, base, key, useRelay) {
            const cleanBase = String(base || '').replace(/\/+$/, '');
            const headers = { Authorization: 'Bearer ' + key };
            if (useRelay) {
                headers['X-Relay-Base'] = cleanBase;
                return { url: `${RELAY_HTTP}/relay/${path}`, headers };
            }
            return { url: `${cleanBase}/${path}`, headers };
        }

        function refreshHeader() {
            const configured = !!settings.apiKey;
            els.dot.className = 'dot' + (configured ? ' online' : ' offline');
            els.modelLabel.textContent = configured ? settings.model + (settings.relay ? ' · 中转' : '') : '未配置 API';
        }

        function ensureMarked() {
            if (window.marked) return Promise.resolve();
            if (!markedPromise) {
                markedPromise = loadScript(MARKED_JS).then(() => {
                    window.marked.use({
                        mangle: false,
                        headerIds: false,
                        renderer: {
                            html(html) { return escapeHtml(html); },
                            link(href, title, text) {
                                const safe = /^(https?:|mailto:)/i.test(href || '') ? href : '#';
                                return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer"${title ? ` title="${escapeHtml(title)}"` : ''}>${text}</a>`;
                            },
                            image(href, title, text) { return escapeHtml(text || ''); }
                        }
                    });
                }).catch(() => { markedPromise = null; });
            }
            return markedPromise;
        }

        function renderContent(bubble, text, streaming) {
            if (window.marked) {
                try {
                    bubble.innerHTML = window.marked.parse(text || '') + (streaming ? '<span class="cursor"></span>' : '');
                    return;
                } catch (e) { /* fall through */ }
            }
            bubble.textContent = text || '';
            if (streaming) {
                const c = document.createElement('span');
                c.className = 'cursor';
                bubble.appendChild(c);
            }
        }

        function appendMessage(role, content, extraClass) {
            const wrap = document.createElement('div');
            wrap.className = `msg ${role}${extraClass ? ' ' + extraClass : ''}`;
            const avatar = document.createElement('span');
            avatar.className = 'avatar';
            avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-microchip"></i>';
            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            if (role === 'user') {
                bubble.textContent = content;
            } else {
                renderContent(bubble, content, false);
            }
            wrap.appendChild(avatar);
            wrap.appendChild(bubble);
            els.messages.appendChild(wrap);
            scrollToEnd();
            return bubble;
        }

        function scrollToEnd() {
            els.messages.scrollTop = els.messages.scrollHeight;
        }

        function welcome() {
            const configured = !!settings.apiKey;
            const welcome = document.createElement('div');
            welcome.className = 'robot-welcome';
            welcome.innerHTML = `<div class="welcome-avatar"><i class="fas fa-microchip" aria-hidden="true"></i></div>
                <h3>今天，想做点什么？</h3>
                <p>${configured ? '电路、代码，或者一个还没成形的灵感，都可以一起推敲。' : '我是工作室里的工程助手。连接你自己的模型，一起把想法做成实物。'}</p>
                <div class="robot-suggestions">${configured
                    ? ['给我一个周末小制作的灵感', '怎样开始学习嵌入式？'].map((text) => `<button type="button" class="os-btn" data-prompt="${text}">${text}</button>`).join('')
                    : '<button type="button" class="os-btn" data-configure><i class="fas fa-sliders" aria-hidden="true"></i> 设置聊天模型</button>'}</div>`;
            welcome.addEventListener('click', (e) => {
                const prompt = e.target.closest('[data-prompt]');
                if (prompt) { els.input.value = prompt.dataset.prompt; els.input.focus(); }
                if (e.target.closest('[data-configure]')) openSettings();
            });
            els.messages.appendChild(welcome);
        }

        function renderAll() {
            els.messages.innerHTML = '';
            if (!history.length) {
                welcome();
                return;
            }
            history.forEach((m) => appendMessage(m.role, m.content));
        }

        function setBusy(busy) {
            els.send.disabled = busy;
            els.input.disabled = busy;
            els.stop.hidden = !busy;
        }

        async function send(text) {
            if (!settings.apiKey) {
                openSettings('请先填入 API Key');
                return;
            }
            history.push({ role: 'user', content: text });
            els.messages.querySelector('.robot-welcome')?.remove();
            appendMessage('user', text);
            saveHistory();

            const bubble = appendMessage('assistant', '', 'streaming');
            renderContent(bubble, '', true);
            controller = new AbortController();
            setBusy(true);

            let full = '';
            let raf = null;
            const scheduleRender = () => {
                if (raf) return;
                raf = requestAnimationFrame(() => {
                    raf = null;
                    renderContent(bubble, full, true);
                    scrollToEnd();
                });
            };

            try {
                await ensureMarked();
                const req = buildRequest('chat/completions', settings.baseUrl, settings.apiKey, settings.relay);
                const res = await fetch(req.url, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, req.headers),
                    body: JSON.stringify({
                        model: settings.model,
                        stream: true,
                        messages: [
                            { role: 'system', content: settings.system || DEFAULT_SYSTEM },
                            ...history.slice(-20)
                        ]
                    }),
                    signal: controller.signal
                });

                if (!res.ok) {
                    let detail = '';
                    try {
                        const j = await res.json();
                        detail = (j.error && (j.error.message || j.error)) || JSON.stringify(j);
                    } catch (e) {
                        detail = await res.text().catch(() => '');
                    }
                    throw new Error(`HTTP ${res.status}${detail ? ' · ' + String(detail).slice(0, 300) : ''}`);
                }

                const ctype = (res.headers.get('content-type') || '').toLowerCase();
                if (ctype.includes('text/event-stream') || !ctype.includes('application/json')) {
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let pending = '';
                    let done = false;
                    while (!done) {
                        const chunk = await reader.read();
                        done = chunk.done;
                        pending += decoder.decode(chunk.value || new Uint8Array(), { stream: !done });
                        const lines = pending.split(/\r?\n/);
                        pending = done ? '' : lines.pop();
                        for (const raw of lines) {
                            const line = raw.trim();
                            if (!line.startsWith('data:')) continue;
                            const payload = line.slice(5).trim();
                            if (!payload || payload === '[DONE]') continue;
                            try {
                                const j = JSON.parse(payload);
                                const choice = j.choices && j.choices[0];
                                const delta = choice && (choice.delta || choice.message);
                                const piece = delta && typeof delta.content === 'string' ? delta.content : '';
                                if (piece) { full += piece; scheduleRender(); }
                            } catch (e) { /* 忽略半截 JSON */ }
                        }
                    }
                } else {
                    const j = await res.json();
                    const choice = j.choices && j.choices[0];
                    full = (choice && choice.message && choice.message.content) || '';
                }

                if (raf) { cancelAnimationFrame(raf); raf = null; }
                renderContent(bubble, full || '（空回复）', false);
                bubble.parentElement.classList.remove('streaming');
                history.push({ role: 'assistant', content: full });
                saveHistory();
            } catch (err) {
                if (raf) { cancelAnimationFrame(raf); raf = null; }
                if (err.name === 'AbortError') {
                    renderContent(bubble, (full || '') + '\n\n*（已停止）*', false);
                    if (full) { history.push({ role: 'assistant', content: full }); saveHistory(); }
                } else {
                    bubble.parentElement.remove();
                    const corsHint = /failed to fetch|networkerror|load failed/i.test(err.message)
                        ? (settings.relay
                            ? '\n\n看起来本地桥接没有运行：在本机执行 `STUDIO_TERM_PASSWORD=… ./run.sh term` 后重试，或在设置里取消中转。'
                            : '\n\n多半是接口不允许浏览器跨域访问（CORS）。可以在「设置」里勾选「通过本地桥接中转请求」，并在本机运行 `./run.sh term`。')
                        : '\n\n检查 Base URL / API Key / 模型名是否正确。';
                    appendMessage('assistant', `连接失败：${err.message}${corsHint}`, 'error');
                }
            } finally {
                controller = null;
                setBusy(false);
                scrollToEnd();
                if (awake && currentApp === 'robot') els.input.focus();
            }
        }

        function stop() {
            if (controller) controller.abort();
        }

        function openSettings(msg) {
            els.base.value = settings.baseUrl || '';
            els.key.value = settings.apiKey || '';
            els.model.value = settings.model || '';
            els.system.value = settings.system || DEFAULT_SYSTEM;
            els.relay.checked = !!settings.relay;
            els.status.textContent = msg || '';
            els.status.className = 'status' + (msg ? ' err' : '');
            els.settings.classList.add('open');
            focusLayer.querySelector('.robot-body').inert = true;
            setTimeout(() => {
                if (awake && currentApp === 'robot' && els.settings.classList.contains('open')) {
                    (settings.apiKey ? els.model : els.key).focus();
                }
            }, 50);
        }

        function closeSettings() {
            els.settings.classList.remove('open');
            focusLayer.querySelector('.robot-body').inert = false;
            if (awake && currentApp === 'robot') els.settingsBtn.focus();
        }

        async function fetchModels() {
            const base = String(els.base.value || '').replace(/\/+$/, '');
            const key = els.key.value.trim();
            if (!base || !key) {
                els.status.textContent = '先填 Base URL 和 API Key';
                els.status.className = 'status err';
                return;
            }
            els.status.textContent = '正在拉取模型列表…';
            els.status.className = 'status';
            try {
                const req = buildRequest('models', base, key, els.relay.checked);
                const r = await fetch(req.url, { headers: req.headers });
                if (!r.ok) throw new Error('HTTP ' + r.status);
                const j = await r.json();
                const ids = (j.data || []).map((m) => m.id).filter(Boolean).sort();
                els.modelList.innerHTML = ids.map((id) => `<option value="${escapeHtml(id)}"></option>`).join('');
                els.status.textContent = ids.length ? `连接成功，共 ${ids.length} 个模型（在 Model 输入框里可下拉选择）` : '连接成功，但接口没有返回模型列表';
                els.status.className = 'status ok';
                if (!els.model.value && ids.length) els.model.value = ids[0];
            } catch (e) {
                const hint = /failed to fetch|networkerror|load failed/i.test(e.message)
                    ? (els.relay.checked ? '（本地桥接未运行？）' : '（接口可能不支持 CORS，试试勾选下方「通过本地桥接中转」）')
                    : '';
                els.status.textContent = '拉取失败：' + e.message + hint;
                els.status.className = 'status err';
            }
        }

        els.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = els.input.value.trim();
            if (!text || controller) return;
            els.input.value = '';
            autosize();
            send(text);
        });

        els.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                els.form.requestSubmit();
            }
        });

        function autosize() {
            els.input.style.height = 'auto';
            els.input.style.height = Math.min(120, els.input.scrollHeight) + 'px';
        }
        els.input.addEventListener('input', autosize);

        els.stop.addEventListener('click', stop);
        els.clear.addEventListener('click', () => {
            stop();
            history = [];
            saveHistory();
            renderAll();
        });
        els.settingsBtn.addEventListener('click', () => openSettings());
        els.cancel.addEventListener('click', closeSettings);
        els.fetchModels.addEventListener('click', fetchModels);
        els.settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            settings = {
                baseUrl: els.base.value.trim() || defaults.baseUrl,
                apiKey: els.key.value.trim(),
                model: els.model.value.trim() || defaults.model,
                system: els.system.value.trim() || DEFAULT_SYSTEM,
                relay: els.relay.checked
            };
            saveSettings();
            refreshHeader();
            closeSettings();
            if (!history.length) renderAll();
            els.input.focus();
        });

        refreshHeader();

        hooks.robot = {
            onOpen() {
                if (!rendered) {
                    rendered = true;
                    renderAll();
                    // 首次发送可能早于 Markdown 加载完成，保留正在接收回复的节点。
                    ensureMarked().then(() => { if (window.marked && !controller) renderAll(); });
                }
                if (window.matchMedia('(pointer: fine)').matches) {
                    setTimeout(() => {
                        if (awake && currentApp === 'robot' && !els.settings.classList.contains('open')) els.input.focus();
                    }, 60);
                }
            },
            onClose() { /* 流式请求继续在后台完成 */ },
            onEscape() {
                if (els.settings.classList.contains('open')) { closeSettings(); return true; }
                return false;
            }
        };

        return { send, stop };
    })();

    // 供调试使用
    window.StudioApps = { TerminalApp, AlbumApp, RobotApp };
})();
