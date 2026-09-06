const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync('js/studio-guest.js', 'utf8');

function setup() {
    const sandbox = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
    vm.runInContext(source, sandbox);
    let output = '';
    let listener;
    let unsubscribed = false;
    let reads = 0;
    const navigation = [];
    const actions = [];
    const term = { write: (text) => { output += text; }, clear: () => { output = ''; }, onData: (fn) => { listener = fn; return { dispose: () => { unsubscribed = true; } }; } };
    const shell = sandbox.StudioGuest.create(term, {
        now: () => new Date(0), dark: () => false, exit: () => actions.push('exit'),
        studio: () => ({ toggleTheme: () => actions.push('theme'), action: (id) => { actions.push(id); return true; } }),
        navigate: (url) => navigation.push(url), posts: async () => { reads++; return [{ title: 'A post', date: '2026-01-01', file: 'posts/hello.md' }]; }
    });
    return { shell, term, input: (text) => listener(text), output: () => output, navigation, actions, reads: () => reads, unsubscribed: () => unsubscribed };
}

test('all terminals are simulations; command and file prototype properties are unreachable', async () => {
    const s = setup();
    for (const command of ['constructor', '__proto__', 'toString', 'valueOf', '/bin/sh', 'bash', 'python', 'node', 'curl', 'ssh', 'eval', 'cat constructor', 'cat __proto__', 'cat ../../tmp/testkey.txt', 'open javascript:alert(1)', 'open https://evil.example', 'open constructor']) await s.shell.run(command);
    assert.match(s.output(), /未找到模拟命令/);
    assert.match(s.output(), /没有这个虚拟文件/);
    assert.deepEqual(s.actions, []);
    assert.deepEqual(s.navigation, []);
    assert.equal(s.reads(), 0);
});

test('shell metacharacters remain literal text, with no interpreter or substitution', async () => {
    const s = setup();
    await s.shell.run('echo $(touch /tmp/should-not-exist); rm -rf / | sh > file');
    await s.shell.run('echo `whoami` && sudo bash');
    await s.shell.run('sudo -i');
    assert.match(s.output(), /\$\(touch \/tmp\/should-not-exist\); rm -rf \/ \| sh > file/);
    assert.match(s.output(), /`whoami` && sudo bash/);
    assert.match(s.output(), /没有权限升级/);
    assert.deepEqual(s.actions, []);
    assert.equal(s.reads(), 0);
});

test('fixed public posts and page routes, scene simulations, and reset cleanup still work', async () => {
    const s = setup();
    await s.shell.run('help'); await s.shell.run('ls'); await s.shell.run('cat README.md');
    await s.shell.run('studio motor'); await s.shell.run('theme');
    await s.shell.run('open blog'); await s.shell.run('open 1');
    assert.equal(s.reads(), 1);
    assert.deepEqual(s.navigation, ['blog.html', 'blog.html#post=posts%2Fhello.md']);
    assert.deepEqual(s.actions, ['motor', 'theme']);
    s.shell.dispose();
    assert.equal(s.unsubscribed(), true);
    await s.shell.run('studio motor');
    assert.deepEqual(s.actions, ['motor', 'theme']);
});

test('typing, history, tab completion, paste bounds and ANSI control filtering', async () => {
    const s = setup();
    await s.input('whoam\t\r');
    assert.match(s.output(), /guest \(simulated\)/);
    await s.input('echo first\r');
    await s.input('\x1b[A\r');
    assert.ok(s.output().split('first').length >= 3);
    await s.shell.run('echo \x1b]52;c;secret\x07');
    assert.equal(s.output().includes('\x1b]52'), false);
    s.term.clear();
    await s.input('x'.repeat(20000));
    assert.ok(s.output().length <= 4096);
});

test('terminal transport and host execution remain absent', () => {
    const runtime = ['js/studio-apps.js', 'js/studio-guest.js', 'studio.html'].map((path) => fs.readFileSync(path, 'utf8')).join('\n');
    assert.doesNotMatch(runtime, /new\s+WebSocket|STUDIO_TERM_PASSWORD|X-Relay-Base|ws:\/\/127|\/relay\//);
    assert.doesNotMatch(runtime, /\beval\s*\(|new\s+Function\s*\(/);
    assert.doesNotMatch(runtime, /term-password|term-login/);
    assert.equal(fs.existsSync('server/studio-bridge.py'), false);
});

test('Robot is only a static research placeholder, with no backend or chat scripts', () => {
    const html = fs.readFileSync('studio.html', 'utf8');
    const apps = fs.readFileSync('js/studio-apps.js', 'utf8');
    const panel = html.match(/<section[^>]*data-app="robot"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(panel);
    assert.match(html, /data-open="robot"/);
    assert.match(panel, /研究中/);
    assert.doesNotMatch(panel, /<(?:form|input|textarea|button|script)\b|contenteditable/);
    assert.doesNotMatch(html + apps, /StudioRobot|RobotApp|robot-(?:config|input|form|send|stop|messages)|\/api\/robot|studio\.robot\.|marked/);
    for (const path of ['js/studio-robot.js', 'js/studio-robot-config.js', 'server', 'tools/robot']) {
        assert.equal(fs.existsSync(path), false, path);
    }
    assert.doesNotMatch(fs.readFileSync('run.sh', 'utf8'), /do_robot|STUDIO_ROBOT|ROBOT_PYTHON|studio-robot|aiohttp/);
});
