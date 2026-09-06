/* Browser-only command simulation. No shell interpreter, eval, socket or server command API. */
(function () {
    'use strict';

    function create(term, env) {
        const C = { reset: '\x1b[0m', dim: '\x1b[90m', green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', bold: '\x1b[1m' };
        const prompt = `${C.green}guest@huanfly${C.reset}:${C.cyan}~${C.reset}$ `;
        const clean = (s) => String(s).replace(/[\x00-\x1f\x7f-\x9f]/g, '');
        const files = Object.freeze(Object.assign(Object.create(null), {
            'about.txt': ['你好！我是 Huanfly，嵌入式软件工程师。', '日常围绕 MCU、RTOS 与外设系统做开发，也长期做软硬件协同实践。', '喜欢科技制作：多旋翼飞控、自平衡小摩托、智能聊天终端……'],
            'skills.txt': ['嵌入式软件', '无人机飞控', 'FOC', '工业 3D 建模', 'FDM 3D 打印', 'RT-Thread', 'C / Python / JavaScript'],
            'contact.txt': ['GitHub   https://github.com/Huanfiy', 'Gitee    https://gitee.com/Huanfly', 'Bilibili https://space.bilibili.com/179895513', 'Email    huanfly999@gmail.com'],
            'README.md': ['# huanfly-studio', '', '这是浏览器里的模拟终端，只处理预设命令。', '不连接任何真实终端，不读取电脑或服务器文件，也不存在管理员解锁模式。', '管道、重定向、命令替换和脚本都不会执行。输入 help 查看命令。']
        }));
        const pages = Object.freeze(Object.assign(Object.create(null), { blog: 'blog.html', tools: 'tool.html', tool: 'tool.html', about: 'about.html', home: 'index.html', index: 'index.html' }));
        let disposed = false;
        let busy = false;
        let buffer = '';
        let cursor = 0;
        let historyIndex = -1;
        let posts = null;
        const history = [];
        const write = (s) => { if (!disposed) term.write(s); };
        const line = (s = '') => write(s + '\r\n');
        const redraw = () => {
            write('\r\x1b[K' + prompt + buffer);
            if (buffer.length > cursor) write(`\x1b[${buffer.length - cursor}D`);
        };

        const commands = Object.assign(Object.create(null), {
            help() {
                line(`${C.bold}可用模拟命令${C.reset}`);
                [
                    ['help', '本帮助'], ['ls / cat <file>', '查看预设的虚拟文件'], ['posts / open <编号>', '浏览公开博客'],
                    ['open <blog|tools|about|home>', '跳转站内页面'], ['neofetch', '模拟系统信息'],
                    ['studio <pcb|scope|solder|printer|motor|arm|plant|window>', '操控 3D 场景里的模拟设备'],
                    ['theme', '切换昼夜'], ['date / echo / history', '时间、回显、命令历史'],
                    ['clear', '清屏 (Ctrl+L)'], ['exit', '回到桌面']
                ].forEach(([name, help]) => line(`  ${C.cyan}${name}${C.reset}  ${help}`));
                line(`${C.dim}这里没有真实操作系统、权限升级或命令执行接口。${C.reset}`);
            },
            ls() { line(Object.keys(files).join('  ') + '  posts/  tools/'); },
            cat(args) {
                if (Object.hasOwn(files, args[0])) files[args[0]].forEach((text) => line(text));
                else line(`cat: ${args[0] || '(未指定文件)'}: 没有这个虚拟文件`);
            },
            pwd() { line('/home/guest (simulated)'); },
            whoami() { line('guest (simulated)'); },
            uname() { line('huanfly-os · browser simulation'); },
            date() { line(env.now().toString()); },
            echo(args) { line(args.join(' ')); },
            history() { history.forEach((text, index) => line(`  ${index + 1}  ${text}`)); },
            clear() { term.clear(); },
            sudo() { line('这里没有权限升级功能；所有终端始终是浏览器模拟。'); },
            rm() { line('这里只展示虚拟文件，不执行删除操作。'); },
            cd() { line('这间模拟工作室只有一个房间。'); },
            theme() { env.studio()?.toggleTheme(); line('已切换昼夜。'); },
            neofetch() {
                line(`${C.green}  ┌─ H7 ─┐   huanfly-os${C.reset}`);
                line(' ─┤ LAB  ├─  guest shell · simulated');
                line('  └──────┘   STM32 H7 · T12 · DSO · BLDC');
                line(`             ${env.dark() ? '窗边夜灯' : '午后工作室'}`);
                line('             不连接真实电脑或服务器终端');
            },
            async posts() {
                try {
                    if (!posts) {
                        const result = await env.posts();
                        posts = (Array.isArray(result) ? result : []).filter((p) => p && typeof p.title === 'string' && typeof p.file === 'string').slice(0, 500);
                    }
                    if (!posts.length) line('暂无文章');
                    posts.forEach((post, index) => line(`  ${index + 1}  ${clean(post.date || '')}  ${clean(post.title)}`));
                    line('用 open <编号> 打开文章。');
                } catch (_) { line('读取公开文章清单失败。'); }
            },
            async open(args) {
                const target = (args[0] || '').toLowerCase();
                if (Object.hasOwn(pages, target)) {
                    if (!disposed) env.navigate(pages[target]);
                } else if (/^[1-9]\d{0,3}$/.test(target)) {
                    if (!posts) await commands.posts();
                    const post = posts && posts[Number(target) - 1];
                    if (!post) line('没有这篇文章。');
                    else if (!disposed) env.navigate('blog.html#post=' + encodeURIComponent(post.file));
                } else line('用法: open <编号|blog|tools|about|home>；不能打开任意地址。');
            },
            studio(args) {
                const id = (args[0] || '').toLowerCase();
                if (!['pcb', 'scope', 'solder', 'iron', 'printer', 'motor', 'arm', 'plant', 'window'].includes(id)) {
                    line('用法: studio <pcb|scope|solder|printer|motor|arm|plant|window>');
                } else line(env.studio()?.action(id) ? `已切换 ${id}，退后看看效果。` : '3D 场景尚未就绪。');
            },
            exit() { env.exit(); }
        });
        commands.ll = commands.dir = commands.ls;
        commands.man = commands['?'] = commands.help;
        Object.freeze(commands);

        async function run(input) {
            if (disposed) return;
            const text = clean(input).slice(0, 4096).trim();
            if (!text) return;
            history.push(text);
            if (history.length > 100) history.shift();
            const [name, ...args] = text.split(/\s+/);
            if (!Object.hasOwn(commands, name)) {
                line(`${name}: 未找到模拟命令。输入 help 查看可用命令。`);
                return;
            }
            try { await commands[name](args); }
            catch (_) { line('模拟命令暂时未完成，请重试。'); }
        }

        function splitInput(data) {
            return data.match(/\x1b\[[0-9;?]*[A-Za-z~]|\x1b.|[^\x1b]/gu) || [];
        }

        const inputSubscription = term.onData(async (data) => {
            if (disposed || busy) return;
            for (const ch of splitInput(String(data).slice(0, 16384))) {
                if (disposed) break;
                if (ch === '\r' || ch === '\n') {
                    write('\r\n');
                    const input = buffer;
                    buffer = '';
                    cursor = 0;
                    historyIndex = -1;
                    busy = true;
                    try { await run(input); } finally { busy = false; }
                    write(prompt);
                } else if (ch === '\u007f' || ch === '\b') {
                    if (cursor) { buffer = buffer.slice(0, cursor - 1) + buffer.slice(cursor); cursor--; redraw(); }
                } else if (ch === '\u0003') {
                    write('^C\r\n' + prompt); buffer = ''; cursor = 0;
                } else if (ch === '\u000c') {
                    term.clear(); redraw();
                } else if (ch === '\x1b[A' && history.length) {
                    historyIndex = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
                    buffer = history[historyIndex]; cursor = buffer.length; redraw();
                } else if (ch === '\x1b[B' && historyIndex >= 0) {
                    historyIndex++;
                    buffer = history[historyIndex] || '';
                    if (historyIndex >= history.length) historyIndex = -1;
                    cursor = buffer.length; redraw();
                } else if (ch === '\x1b[C') {
                    if (cursor < buffer.length) { cursor++; write('\x1b[C'); }
                } else if (ch === '\x1b[D') {
                    if (cursor > 0) { cursor--; write('\x1b[D'); }
                } else if (ch === '\x1b[H' || ch === '\x01') {
                    cursor = 0; redraw();
                } else if (ch === '\x1b[F' || ch === '\x05') {
                    cursor = buffer.length; redraw();
                } else if (ch === '\t') {
                    const names = Object.keys(commands).filter((name) => buffer && name.startsWith(buffer));
                    if (names.length === 1) { buffer = names[0] + ' '; cursor = buffer.length; redraw(); }
                    else if (names.length > 1) { write('\r\n' + names.join('  ') + '\r\n'); redraw(); }
                } else if (!ch.startsWith('\x1b') && clean(ch) && buffer.length + ch.length <= 4096) {
                    buffer = buffer.slice(0, cursor) + ch + buffer.slice(cursor);
                    cursor += ch.length;
                    if (cursor === buffer.length) write(ch); else redraw();
                }
            }
        });
        line(`${C.green}  ┌─ H7 ─┐   ${C.bold}huanfly-os${C.reset}`);
        line(' ─┤ LAB  ├─  欢迎来到工作室访客终端');
        line(`  └──────┘   ${C.dim}纯浏览器模拟，不连接真实终端。输入 help 查看命令。${C.reset}`);
        line();
        write(prompt);
        return Object.freeze({ run, dispose() { disposed = true; inputSubscription.dispose(); } });
    }
    globalThis.StudioGuest = Object.freeze({ create });
})();
