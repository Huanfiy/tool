/* Optional Chromium review; use an existing puppeteer-core, no project dependencies. */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const root = path.resolve(__dirname, '..');
const output = process.env.BLOG_TEST_OUTPUT || path.join(root, 'tmp/blog-covers-review');
const posts = JSON.parse(fs.readFileSync(path.join(root, 'posts/posts.json'), 'utf8'));
fs.mkdirSync(output, { recursive: true });
const fixture = spawn(process.env.PYTHON || 'python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
const lines = readline.createInterface({ input: fixture.stdout });
let serverError = '';
fixture.stderr.on('data', chunk => { serverError = (serverError + chunk).slice(-4096); });
const originPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Static server startup timed out')), 10000);
    lines.on('line', line => {
        const match = line.match(/Serving HTTP on 127\.0\.0\.1 port (\d+)/);
        if (match) { clearTimeout(timer); resolve('http://127.0.0.1:' + match[1]); }
    });
    fixture.once('error', error => { clearTimeout(timer); reject(error); });
    fixture.once('exit', code => { clearTimeout(timer); reject(new Error('Static server exited: ' + code + '\n' + serverError)); });
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function decodeCovers(page, selector = '.blog-thumb img') {
    for (const image of await page.$$(selector)) {
        await image.evaluate(async element => {
            element.scrollIntoView({ block: 'center', behavior: 'instant' });
            await element.decode();
        });
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await pause(200);
}

async function screenshot(page, filename) {
    // Full-page captures do not scroll: explicitly paint offscreen content-visibility cards.
    // Layout assertions above/below still run with the production CSS unchanged.
    const style = await page.addStyleTag({ content: '.blog-card { content-visibility: visible !important; }' });
    try {
        await pause(100);
        await page.screenshot({ path: path.join(output, filename), fullPage: true });
    } finally {
        await style.evaluate(element => element.remove());
    }
}

async function assertLayout(page) {
    const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        images: [...document.querySelectorAll('.blog-thumb img')].map(image => {
            const bounds = image.getBoundingClientRect();
            const style = getComputedStyle(image);
            return { complete: image.complete && image.naturalWidth === 480 && image.naturalHeight === 320,
                fit: style.objectFit, padding: style.padding, width: bounds.width, height: bounds.height,
                inside: bounds.left >= 0 && bounds.right <= innerWidth,
                scheme: style.colorScheme };
        })
    }));
    assert.equal(result.overflow, false, 'No horizontal overflow');
    assert.equal(result.images.length, posts.length);
    for (const image of result.images) {
        assert.equal(image.complete, true);
        assert.equal(image.fit, 'contain', 'Never crop illustration subjects');
        assert.equal(image.padding, '0px');
        assert.equal(image.inside, true);
        assert.ok(image.width >= 180 && image.height >= 120);
    }
    return result;
}

(async () => {
    let browser;
    let page;
    try {
        const origin = await originPromise;
        browser = await puppeteer.launch({ executablePath: process.env.CHROME_BINARY || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
        page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 1100 });
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }]);
        await page.evaluateOnNewDocument(() => localStorage.setItem('theme', 'light'));
        const errors = [];
        const coverRequests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error' && /<svg>|<path>|<rect>|attribute|parsererror/i.test(message.text())) errors.push(message.text()); });
        page.on('request', request => { if (/\/picture\//.test(request.url())) coverRequests.push(request.url()); });
        // Stats are unrelated to cover review. All visual assets and Marked.js load normally.
        await page.setRequestInterception(true);
        page.on('request', request => /busuanzi|google-analytics/.test(request.url()) ? request.abort() : request.continue());
        await page.goto(origin + '/blog.html', { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForSelector('.blog-card');
        await decodeCovers(page);
        const light = await assertLayout(page);
        assert.ok(light.images.every(image => image.scheme === 'light'), 'Saved site theme must override dark OS preference');
        await screenshot(page, 'blog-desktop-light.png');
        const sampleChip = () => page.$eval('.blog-thumb img', image => {
            const canvas = document.createElement('canvas');
            canvas.width = 480; canvas.height = 320;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, 480, 320);
            return [...context.getImageData(210, 111, 1, 1).data];
        });
        const lightPixel = await sampleChip();
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' }]);
        await page.click('.theme-toggle');
        await pause(500);
        const dark = await assertLayout(page);
        assert.ok(dark.images.every(image => image.scheme === 'dark'), 'Manual dark theme must override light OS preference');
        const darkPixel = await sampleChip();
        assert.deepEqual(lightPixel, [127, 165, 114, 255], 'SVG itself must render its daylight palette');
        assert.deepEqual(darkPixel, [152, 190, 136, 255], 'SVG itself must change palette, not just the surrounding frame');
        await screenshot(page, 'blog-desktop-dark.png');

        for (const width of [320, 390, 768]) {
            await page.setViewport({ width, height: 844 });
            for (const theme of ['light', 'dark']) {
                await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
                await decodeCovers(page);
                await assertLayout(page);
                if (width === 390) await screenshot(page, `blog-mobile-${theme}.png`);
            }
        }
        await page.setViewport({ width: 1440, height: 1100 });
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
        await page.click('[data-tag="Linux"]');
        assert.equal(await page.$$eval('.blog-card', cards => cards.length), 1);
        assert.ok((await page.$eval('.blog-thumb img', image => image.src)).endsWith('/linux.svg'));
        await page.click('[data-tag="全部"]');
        await page.type('#blog-search-input', '不存在的文章');
        assert.equal(await page.$$eval('.blog-card', cards => cards.length), 0);
        await page.$eval('#blog-search-input', input => { input.value = 'Cortex'; input.dispatchEvent(new Event('input')); });
        assert.equal(await page.$$eval('.blog-card', cards => cards.length), 1);
        await page.click('.blog-card');
        await page.waitForSelector('#markdown-content h1');
        assert.match(await page.$eval('#markdown-content h1', heading => heading.textContent), /Cortex-M/);
        await page.click('.btn-back');
        await page.waitForSelector('#blog-list-view', { visible: true });
        await page.$eval('#blog-search-input', input => { input.value = ''; input.dispatchEvent(new Event('input')); });
        await decodeCovers(page);
        // Future posts and aliases must reuse category assets, regardless of title or file.
        for (const category of await page.evaluate(() => BlogCovers.themes)) {
            await page.evaluate(theme => {
                const base = { date: '2026-09-06', summary: '', tag: theme.tags[0], cover: '' };
                renderBlogCards([
                    { ...base, title: '分类内的第一篇文章', file: 'posts/example-a.md' },
                    { ...base, title: '内容完全不同的新文章', tag: theme.tags[theme.tags.length - 1], file: 'posts/example-b.md' },
                ]);
            }, category);
            await decodeCovers(page);
            const sources = await page.$$eval('.blog-thumb img', images => images.map(image => ({ src: image.getAttribute('src'), alt: image.alt })));
            assert.deepEqual(sources, [
                { src: category.cover, alt: category.name + '主题封面' },
                { src: category.cover, alt: category.name + '主题封面' },
            ]);
        }
        await page.evaluate(() => applyFilters());
        await decodeCovers(page);
        const beforeFallback = coverRequests.length;
        await page.$eval('.blog-thumb img', image => { image.src = 'picture/blog/not-found.svg'; });
        await page.waitForFunction(() => {
            const image = document.querySelector('.blog-thumb img');
            return image.src.endsWith('/field-notes.svg') && image.complete && image.naturalWidth === 480;
        });
        assert.equal(await page.$eval('.blog-thumb img', image => image.onerror === null), true);
        assert.ok(coverRequests.length - beforeFallback <= 2, 'Broken cover must not create a request loop');
        assert.equal(coverRequests.some(url => /icon-(?:embedded|debug|practice|growth|insight|linux)(?:-cover)?\.|tmux-logo/.test(url)), false, 'Old covers must never be requested');

        assert.equal(coverRequests.some(url => /(?:cortex-fault|debug-loop|code-quality|weekly-review|attention-shield|tmux-panes)\.svg/.test(url)), false, 'Rejected article-specific drafts must not be requested');
        const reviewRequests = [];
        const recordReviewRequest = request => reviewRequests.push(request.url());
        page.on('request', recordReviewRequest);
        await page.goto(origin + '/tests/blog-covers.html', { waitUntil: 'networkidle0' });
        await page.waitForSelector('.review-card');
        await decodeCovers(page, '.review-pair img');
        const parseErrors = await page.evaluate(async () => {
            const sources = [...new Set([...document.images].map(image => image.src))];
            const errors = [];
            for (const source of sources) {
                const response = await fetch(source);
                const xml = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
                if (!response.ok || xml.querySelector('parsererror')) errors.push(source);
            }
            return errors;
        });
        assert.deepEqual(parseErrors, []);
        assert.deepEqual(await page.$$eval('.review-copy h2', headings => headings.map(heading => heading.textContent)), ['嵌入式', '调试', '实践', '成长', '感悟', 'Linux', '通用回退']);
        assert.equal(reviewRequests.some(url => url.endsWith('/posts/posts.json')), false, 'Theme review must not depend on the article list');
        page.off('request', recordReviewRequest);
        await page.screenshot({ path: path.join(output, 'cover-review-sheet.png'), fullPage: true });
        assert.deepEqual(errors, [], 'No page or SVG parsing errors');
        console.log(JSON.stringify({ categories: 6, categoryReuse: 'pass', articleIndependentReview: 'pass', xml: 'pass', themePixels: { light: lightPixel, dark: darkPixel }, viewports: [320, 390, 768, 1440], searchAndFilters: 'pass', articleNavigation: 'pass', fallback: 'pass', noLegacyRequests: 'pass', screenshots: output }, null, 2));
    } catch (error) {
        if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
        throw error;
    } finally {
        if (browser) await browser.close();
        lines.close();
        if (fixture.exitCode === null) {
            const exited = once(fixture, 'exit');
            fixture.kill();
            await exited;
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
