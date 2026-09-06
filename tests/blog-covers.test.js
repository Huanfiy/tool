const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const posts = JSON.parse(fs.readFileSync(path.join(root, 'posts/posts.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'blog.html'), 'utf8');
const coverCode = html.slice(html.indexOf('        const { defaultCover:'), html.indexOf('        // === 动态渲染文章卡片 ==='));
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'js/blog-covers.js'), 'utf8'), context);
vm.runInContext(coverCode, context);
const { themes, getCoverUrl, getCoverAlt, defaultCover } = vm.runInContext('BlogCovers', context);
const { handleCoverError } = context;

test('six category assets have stable names and the review shares the same registry', () => {
    assert.equal(Array.from(themes, theme => theme.name).join(','), '嵌入式,调试,实践,成长,感悟,Linux');
    assert.deepEqual(Array.from(themes, theme => theme.cover), [
        'picture/blog/embedded.svg', 'picture/blog/debug.svg', 'picture/blog/practice.svg',
        'picture/blog/growth.svg', 'picture/blog/insight.svg', 'picture/blog/linux.svg',
    ]);
    assert.equal(new Set(themes.map(theme => theme.cover)).size, themes.length);
    const review = fs.readFileSync(path.join(root, 'tests/blog-covers.html'), 'utf8');
    assert.match(review, /src="\.\.\/js\/blog-covers\.js"/);
    assert.match(review, /BlogCovers\.themes/);
    assert.doesNotMatch(review, /posts\/posts\.json/);
    assert.match(html, /src="js\/blog-covers\.js"/);
    const shipped = fs.readdirSync(path.join(root, 'picture/blog')).filter(name => name.endsWith('.svg')).sort();
    assert.deepEqual(shipped, [...Array.from(themes, theme => path.basename(theme.cover)), path.basename(defaultCover)].sort());
});

test('retired bitmap covers are removed while site identity icons remain available', () => {
    const retired = ['embedded', 'debug', 'practice', 'growth', 'insight'].flatMap(theme => [
        `icon-${theme}-cover.webp`, `icon-${theme}.png`,
    ]).concat(['icon-linux.png', 'tmux-logo-medium.png']);
    for (const name of retired) {
        assert.equal(fs.existsSync(path.join(root, 'picture', name)), false, name + ' must remain retired');
    }
    for (const name of ['icon.png', 'icon-192.png', 'icon-512.png']) {
        assert.ok(fs.existsSync(path.join(root, 'picture', name)), name + ' is still used by the site');
    }
});

test('published cover metadata matches front matter, including omitted category defaults', () => {
    for (const post of posts) {
        const markdown = fs.readFileSync(path.join(root, post.file), 'utf8');
        const frontMatter = markdown.split(/^---\s*$/m)[1];
        const sourceCover = frontMatter.match(/^cover:[ \t]*([^\r\n]*)$/m)?.[1].trim() || '';
        assert.equal(post.cover, sourceCover);
        const cover = getCoverUrl(post);
        if (!sourceCover) assert.match(cover, /^picture\/blog\/[a-z-]+\.svg$/);
        if (cover.startsWith('picture/')) assert.ok(fs.existsSync(path.join(root, cover)), cover);
    }
});

test('different and future articles in a category reuse exactly the same cover and alt text', () => {
    for (const theme of themes) {
        const original = { tag: theme.tags[0], title: '原有文章', file: 'posts/original.md', summary: '一种具体方法' };
        const future = { tag: theme.tags[0], title: '完全不同的新文章', file: 'posts/new.md', summary: '另一项技术或生活经历' };
        assert.equal(getCoverUrl(original), theme.cover);
        assert.equal(getCoverUrl(future), theme.cover);
        assert.equal(getCoverUrl({ ...future, cover: '' }), theme.cover);
        assert.equal(getCoverAlt(original), theme.name + '主题封面');
        assert.equal(getCoverAlt(future), getCoverAlt(original));
    }
});

test('practice aliases and case-insensitive Linux tags reuse their categories', () => {
    for (const tag of ['实践', '工程实践', ' 工程实践 ']) {
        assert.equal(getCoverUrl({ tag }), 'picture/blog/practice.svg');
    }
    for (const tag of ['Linux', 'linux', 'LINUX', ' Linux ']) {
        assert.equal(getCoverUrl({ tag }), 'picture/blog/linux.svg');
    }
});

test('SVG assets are small, self-contained, accessible and theme-aware', () => {
    for (const cover of [...themes.map(theme => theme.cover), defaultCover]) {
        const svg = fs.readFileSync(path.join(root, cover), 'utf8');
        assert.ok(Buffer.byteLength(svg) < 8 * 1024, cover + ' must stay below 8 KiB');
        assert.match(svg, /viewBox="0 0 480 320"/);
        assert.match(svg, /role="img" aria-labelledby="title desc"/);
        assert.match(svg, /<title id="title">[^<]+<\/title>/);
        assert.match(svg, /<desc id="desc">[^<]+<\/desc>/);
        assert.match(svg, /@media\s*\(prefers-color-scheme: dark\)/);
        assert.doesNotMatch(svg, /<(?:image|script|foreignObject|text|filter|animate|set)\b|\bhref=|\bon\w+=|@import|@font-face|url\(/i);
    }
});

test('explicit custom covers take priority; unknown tags use the generic fallback', () => {
    const custom = { cover: 'picture/custom.png', tag: 'Linux', title: '自定义图片的文章' };
    assert.equal(getCoverUrl(custom), custom.cover);
    assert.equal(getCoverAlt(custom), custom.title);
    for (const tag of [undefined, '', '新标签', '__proto__', 'constructor', '<svg onload=alert(1)>']) {
        assert.equal(getCoverUrl({ tag }), defaultCover);
        assert.equal(getCoverAlt({ tag }), '通用笔记封面');
    }
});

test('broken images fall back once, updating alt text and removing contain padding', () => {
    const image = { onerror() {}, className: 'contain', src: 'missing.png', alt: '旧图片说明' };
    handleCoverError(image);
    assert.equal(image.onerror, null);
    assert.equal(image.className, 'illustrated');
    assert.equal(image.src, defaultCover);
    assert.equal(image.alt, '通用笔记封面');
});

test('regenerating the index preserves automatic category selection without changing the worktree', () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'huanfly-blog-covers-'));
    try {
        fs.copyFileSync(path.join(root, 'run.sh'), path.join(temporary, 'run.sh'));
        fs.cpSync(path.join(root, 'posts'), path.join(temporary, 'posts'), { recursive: true });
        execFileSync('bash', [path.join(temporary, 'run.sh'), 'gen'], { cwd: temporary });
        const generated = JSON.parse(fs.readFileSync(path.join(temporary, 'posts/posts.json'), 'utf8'));
        assert.deepEqual(generated, posts);
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }
});
