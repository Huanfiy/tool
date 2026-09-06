/* Optional Chromium regression against a disposable, standard-library static server. */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const root = path.resolve(__dirname, '..');
const output = process.env.STUDIO_TEST_OUTPUT || path.join(root, 'tmp/studio-apps-review');
fs.mkdirSync(output, { recursive: true });
const fixture = spawn(process.env.PYTHON || 'python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let serverError = '';
fixture.stderr.on('data', (chunk) => { serverError = (serverError + chunk).slice(-4096); });
const lines = readline.createInterface({ input: fixture.stdout });
const originPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Static server startup timed out')), 10000);
    lines.on('line', (line) => {
        const match = line.match(/Serving HTTP on 127\.0\.0\.1 port (\d+)/);
        if (match) { clearTimeout(timer); resolve('http://127.0.0.1:' + match[1]); }
    });
    fixture.once('error', (error) => { clearTimeout(timer); reject(error); });
    fixture.once('exit', (code) => { clearTimeout(timer); reject(new Error('Static server exited: ' + code + '\n' + serverError)); });
});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const robotPanel = '.os-app[data-app="robot"]';

async function assertPlaceholder(page) {
    await page.waitForSelector(robotPanel + '.active .robot-placeholder', { visible: true });
    await page.waitForFunction((selector) => Number(getComputedStyle(document.querySelector(selector)).opacity) > .99, {}, robotPanel);
    assert.match(await page.$eval(robotPanel, (el) => el.textContent), /研究中/);
    assert.equal(await page.$eval(robotPanel, (el) => el.querySelectorAll('input, textarea, form, button, [contenteditable]').length), 0);
    assert.equal(await page.evaluate(() => 'StudioRobot' in window || 'StudioRobotConfig' in window || 'RobotApp' in window.StudioApps), false);
    assert.equal(await page.$eval('.robot-placeholder', (el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight + 1), true, 'The whole placeholder must fit inside the monitor');
}

(async () => {
    let browser;
    let page;
    try {
        const origin = await originPromise;
        browser = await puppeteer.launch({ executablePath: process.env.CHROME_BINARY || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
        page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 1000 });
        const requests = [];
        const errors = [];
        const sockets = [];
        page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }));
        page.on('pageerror', (error) => errors.push(error.message));
        const network = await page.createCDPSession();
        await network.send('Network.enable');
        network.on('Network.webSocketCreated', (event) => sockets.push(event.url));
        async function ready() {
            await page.waitForFunction(() => window.StudioOS && window.Studio && document.querySelector('#lab-loader').classList.contains('ready'), { timeout: 60000 });
        }
        await page.goto(origin + '/studio.html', { waitUntil: 'networkidle2', timeout: 60000 });
        await ready();
        const pageCount = (await browser.pages()).length;
        await page.evaluate(() => { Studio.focusMonitor(); StudioOS.open('terminal'); });
        await page.waitForSelector('.xterm-helper-textarea', { timeout: 30000 });
        await pause(1200);
        await page.focus('.xterm-helper-textarea');
        await page.keyboard.type('echo simulation-only'); await page.keyboard.press('Enter');
        await page.keyboard.type('studio motor'); await page.keyboard.press('Enter');
        await page.waitForFunction(() => window.Studio.state.motor !== 'off' && window.Studio.state.motor !== 0);
        const terminal = await page.$('.xterm');
        await page.evaluate(() => { Studio.unfocusMonitor(); Studio.focusMonitor(); StudioOS.open('desktop'); StudioOS.open('terminal'); });
        assert.equal(await page.evaluate((el) => el === document.querySelector('.xterm'), terminal), true);
        for (const cmd of ['constructor', 'sudo bash', 'echo $(id) | sh', 'cat /etc/passwd']) {
            await page.keyboard.type(cmd); await page.keyboard.press('Enter');
        }
        await page.screenshot({ path: path.join(output, 'terminal-desktop.png') });
        await page.click('#term-reset');
        await page.waitForFunction((el) => !el.isConnected && document.querySelector('.xterm'), {}, terminal);
        await page.evaluate(() => StudioOS.open('album'));
        await page.waitForSelector('.album-item');
        await page.evaluate(() => document.querySelector('.album-item').click());
        await page.waitForSelector('#album-viewer.open');
        await page.evaluate(() => { Studio.unfocusMonitor(); Studio.focusMonitor(); });
        assert.equal(await page.$eval('#album-viewer', (el) => el.classList.contains('open')), true);
        await pause(1200);
        await page.screenshot({ path: path.join(output, 'album-desktop.png') });

        // Opening the actual desktop button works without any Robot controller.
        await page.evaluate(() => StudioOS.open('desktop'));
        await page.click('[data-open="robot"]');
        await assertPlaceholder(page);
        const placeholder = await page.$('.robot-placeholder');
        await page.evaluate(() => { Studio.unfocusMonitor(); Studio.focusMonitor(); StudioOS.open('album'); StudioOS.open('robot'); });
        assert.equal(await page.evaluate((el) => el === document.querySelector('.robot-placeholder'), placeholder), true);
        await pause(1200);
        await page.screenshot({ path: path.join(output, 'robot-research-desktop.png') });
        await page.keyboard.press('Escape');
        await page.waitForSelector('.os-desktop.active');
        assert.equal(await page.evaluate(() => Studio.isFocused()), true);
        await page.click('[data-open="robot"]');
        await assertPlaceholder(page);
        await page.setViewport({ width: 390, height: 844 });
        await pause(1200);
        await assertPlaceholder(page);
        await page.screenshot({ path: path.join(output, 'robot-research-mobile.png') });
        for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
            await page.setViewport(viewport);
            await pause(1200);
            await assertPlaceholder(page);
        }
        // Focus changes and refresh must not start a status poll or restore chat.
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await pause(500);
        await page.reload({ waitUntil: 'networkidle2' }); await ready();
        await page.evaluate(() => { Studio.focusMonitor(); StudioOS.open('robot'); });
        await assertPlaceholder(page);
        assert.equal((await browser.pages()).length, pageCount);
        assert.equal(new URL(page.url()).pathname, '/studio.html');
        assert.equal(requests.some((r) => /\/api\/|\/relay\/|\/robot-admin\/|\/chat\/completions|[\/@]marked(?:@|\/)/.test(r.url)), false, 'No API/relay/Markdown activity in the studio');
        assert.equal(requests.some((r) => r.method !== 'GET' && r.method !== 'HEAD'), false);
        assert.deepEqual(sockets, []);
        assert.deepEqual(errors, []);
        await page.close();

        const fallback = await browser.newPage();
        await fallback.setViewport({ width: 390, height: 844 });
        const fallbackRequests = [];
        fallback.on('request', (request) => fallbackRequests.push(request.url()));
        await fallback.evaluateOnNewDocument(() => {
            const getContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return /^webgl|experimental-webgl/.test(kind) ? null : getContext.call(this, kind, ...args); };
        });
        await fallback.goto(origin + '/studio.html', { waitUntil: 'networkidle2' });
        await fallback.waitForFunction(() => window.StudioOS && window.Studio);
        await fallback.evaluate(() => Studio.focusMonitor());
        await fallback.waitForSelector('.is-computer-fallback');
        await fallback.click('[data-open="robot"]');
        await assertPlaceholder(fallback);
        await fallback.screenshot({ path: path.join(output, 'robot-research-fallback.png') });
        await fallback.evaluate(() => StudioOS.open('terminal'));
        await fallback.waitForSelector('.is-computer-fallback .xterm-helper-textarea');
        await fallback.type('.xterm-helper-textarea', 'help'); await fallback.keyboard.press('Enter');
        assert.equal(fallbackRequests.some((url) => /\/api\/|\/relay\/|studio-robot|[\/@]marked(?:@|\/)/.test(url)), false);
        await fallback.close();

        const outdoor = await browser.newPage();
        await outdoor.goto(origin + '/tests/studio-outdoor.html');
        await outdoor.waitForFunction(() => document.querySelector('#results').dataset.status !== 'running', { timeout: 120000 });
        const result = await outdoor.$eval('#results', (el) => ({ status: el.dataset.status, text: el.textContent }));
        fs.writeFileSync(path.join(output, 'outdoor-contracts.txt'), result.text);
        assert.equal(result.status, 'passed', result.text);
        console.log(JSON.stringify({ staticServer: 'pass', researchPlaceholder: 'pass', noBotRequests: 'pass', noTerminalTransport: 'pass', noNewPage: 'pass', cameraAndAppSwitch: 'pass', refresh: 'pass', guestTerminal: 'pass', album: 'pass', mobile: 'pass', fallback: 'pass', outdoor: 'pass', screenshots: output }));
    } catch (error) {
        if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
        throw error;
    } finally {
        try { await browser?.close(); }
        finally {
            lines.close();
            if (fixture.exitCode === null && fixture.signalCode === null && fixture.pid) {
                const exited = once(fixture, 'exit');
                fixture.kill('SIGTERM');
                await exited;
            }
        }
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });
