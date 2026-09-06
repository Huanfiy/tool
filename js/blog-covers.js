// Shared by the blog and its review sheet: category artwork, never article-specific.
const BlogCovers = (() => {
    const defaultCover = 'picture/blog/field-notes.svg';
    const themes = [
        { name: '嵌入式', tags: ['嵌入式'], cover: 'picture/blog/embedded.svg', description: '芯片、电路板与接口 · 软硬件相连的世界' },
        { name: '调试', tags: ['调试'], cover: 'picture/blog/debug.svg', description: '放大镜与程序错误符号 · 观察、追踪与排查' },
        { name: '实践', tags: ['实践', '工程实践'], cover: 'picture/blog/practice.svg', description: '扳手与螺丝刀 · 动手尝试，把想法变成现实' },
        { name: '成长', tags: ['成长'], cover: 'picture/blog/growth.svg', description: '幼芽到植株 · 积累、进步与持续生长' },
        { name: '感悟', tags: ['感悟'], cover: 'picture/blog/insight.svg', description: '思绪与亮起的灯 · 观察生活，获得领悟' },
        { name: 'Linux', tags: ['Linux'], cover: 'picture/blog/linux.svg', description: '企鹅与命令行 · Linux 系统、开源与终端环境' },
    ].map(theme => Object.freeze({ ...theme, tags: Object.freeze(theme.tags) }));
    const normalizeTag = tag => typeof tag === 'string' ? tag.trim().toLowerCase() : '';
    const byTag = new Map(themes.flatMap(theme => theme.tags.map(tag => [normalizeTag(tag), theme])));
    const byCover = new Map(themes.map(theme => [theme.cover, theme]));

    function getCoverUrl(post = {}) {
        return post.cover || byTag.get(normalizeTag(post.tag))?.cover || defaultCover;
    }

    function getCoverAlt(post = {}) {
        const cover = getCoverUrl(post);
        const theme = byCover.get(cover);
        if (theme) return theme.name + '主题封面';
        if (cover === defaultCover) return '通用笔记封面';
        return post.title || post.tag || '文章封面';
    }

    return Object.freeze({ themes: Object.freeze(themes), defaultCover, getCoverUrl, getCoverAlt });
})();
