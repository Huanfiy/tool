/* huanfly-os: browser-only guest terminal, album, and a static Robot placeholder. */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const focusLayer = $('monitor-focus');
    if (!focusLayer) return;
    const loadedAssets = new Map();

    function loadScript(src) {
        if (loadedAssets.has(src)) return loadedAssets.get(src);
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => { script.remove(); reject(new Error('资源加载失败')); };
            document.head.appendChild(script);
        }).catch((error) => { loadedAssets.delete(src); throw error; });
        loadedAssets.set(src, promise);
        return promise;
    }

    function loadStyle(href) {
        if (loadedAssets.has(href)) return loadedAssets.get(href);
        const promise = new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = () => { link.remove(); reject(new Error('样式加载失败')); };
            document.head.appendChild(link);
        }).catch((error) => { loadedAssets.delete(href); throw error; });
        loadedAssets.set(href, promise);
        return promise;
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

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

    const appEls = Object.create(null);
    focusLayer.querySelectorAll('.os-app').forEach((el) => { appEls[el.dataset.app] = el; });
    const titles = { desktop: '桌面', terminal: '终端', album: '相册', robot: 'Robot' };
    const hooks = Object.create(null);
    let currentApp = 'desktop';
    let awake = false;

    function open(id) {
        if (!Object.hasOwn(appEls, id)) return;
        if (currentApp !== id) hooks[currentApp]?.onClose?.();
        Object.keys(appEls).forEach((key) => appEls[key].classList.toggle('active', key === id));
        currentApp = id;
        $('os-title').textContent = titles[id] || id;
        hooks[id]?.onOpen?.();
    }

    function tickOsClock() {
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        $('os-clock').textContent = $('os-time').textContent = time;
        $('os-date').textContent = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]}`;
        $('os-greet').textContent = greeting();
    }
    tickOsClock();
    setInterval(tickOsClock, 15000);
    focusLayer.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => open(button.dataset.open)));
    $('os-home').addEventListener('click', () => open('desktop'));
    function wake() { awake = true; tickOsClock(); open(currentApp); }
    function sleep() { awake = false; hooks[currentApp]?.onClose?.(); }
    function handleEscape() {
        if (hooks[currentApp]?.onEscape?.()) return true;
        if (currentApp !== 'desktop') { open('desktop'); return true; }
        return false;
    }
    window.StudioOS = { open, wake, sleep, handleEscape, isAwake: () => awake };

    const TerminalApp = (function () {
        const body = $('term-body');
        const loading = $('term-loading');
        const status = $('term-status');
        const retry = $('term-retry');
        let term = null;
        let shell = null;
        let fitAddon = null;
        let observer = null;
        let pending = null;
        function fit() { try { fitAddon?.fit(); } catch (_) { /* hidden container */ } }
        function dispose() {
            observer?.disconnect(); shell?.dispose(); term?.dispose();
            observer = shell = term = fitAddon = null;
            body.replaceChildren();
        }
        async function initialize() {
            if (term) { fit(); if (awake && currentApp === 'terminal') term.focus(); return; }
            if (pending) return pending;
            loading.hidden = false;
            retry.hidden = true;
            status.textContent = '正在加载模拟终端…';
            pending = (async () => {
                await loadStyle('https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css');
                await loadScript('https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js');
                await loadScript('https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js');
                term = new window.Terminal({ cursorBlink: true, fontSize: 14, lineHeight: 1.15, scrollback: 4000,
                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'DejaVu Sans Mono', monospace",
                    theme: { background: '#0b1210', foreground: '#dcead0', cursor: '#7cc95f', selectionBackground: 'rgba(124, 201, 95, 0.32)' } });
                fitAddon = new window.FitAddon.FitAddon();
                term.loadAddon(fitAddon);
                term.open(body);
                shell = window.StudioGuest.create(term, {
                    now: () => new Date(), dark: () => document.documentElement.dataset.theme === 'dark', studio: () => window.Studio,
                    navigate: (url) => { window.location.href = url; }, exit: () => open('desktop'),
                    posts: async () => { const response = await fetch('posts/posts.json'); if (!response.ok) throw new Error(); return response.json(); }
                });
                observer = new ResizeObserver(fit);
                observer.observe(body);
                loading.hidden = true;
                fit();
                if (awake && currentApp === 'terminal') term.focus();
            })().catch(() => {
                dispose();
                loading.hidden = false;
                status.textContent = '模拟终端资源加载失败，请检查网络后重试。无需安装本地程序。';
                retry.hidden = false;
            }).finally(() => { pending = null; });
            return pending;
        }
        async function reset() { if (pending) await pending; dispose(); return initialize(); }
        retry.addEventListener('click', initialize);
        $('term-reset').addEventListener('click', reset);
        hooks.terminal = {
            onOpen: initialize,
            onClose() { /* Camera/app changes preserve the simulated session. */ },
            onEscape() { return !!(term && body.contains(document.activeElement)); }
        };
        return { reset };
    })();

    const AlbumApp = (function () {
        const sources = {
            photography: { url: 'interests/photography/index.json', label: '摄影' },
            tech: { url: 'interests/tech/index.json', label: '制作' }
        };
        const grid = $('album-grid');
        const tabs = $('album-tabs');
        const viewer = $('album-viewer');
        const cache = {};
        let current = 'photography';
        let items = [];
        let viewerIndex = -1;
        let loaded = false;
        let loadVersion = 0;
        async function load(key) {
            if (!Object.hasOwn(sources, key)) return;
            const version = ++loadVersion;
            closeViewer(); current = key;
            tabs.querySelectorAll('[data-album]').forEach((button) => {
                const on = button.dataset.album === key;
                button.classList.toggle('primary', on);
                button.setAttribute('aria-selected', String(on));
            });
            grid.innerHTML = '<div class="album-empty"><i class="fas fa-spinner fa-spin"></i></div>';
            try {
                if (!cache[key]) {
                    const response = await fetch(sources[key].url);
                    if (!response.ok) throw new Error();
                    const data = await response.json();
                    cache[key] = (Array.isArray(data) ? data : []).filter((item) => item && item.src && item.type !== 'video');
                }
                if (version !== loadVersion) return;
                items = cache[key];
                grid.innerHTML = items.length ? items.map((item, index) => `<figure class="album-item" role="button" tabindex="0" data-idx="${index}"><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.caption || '')}" loading="lazy" decoding="async"><figcaption>${escapeHtml(item.caption || '')}</figcaption></figure>`).join('') : '<div class="album-empty"><i class="fas fa-image"></i><p>这个相册还是空的</p></div>';
            } catch (_) {
                if (version !== loadVersion) return;
                items = [];
                grid.innerHTML = '<div class="album-empty"><i class="fas fa-image"></i><p>相册加载失败</p></div>';
            }
        }
        function openViewer(index) {
            if (!items[index]) return;
            viewerIndex = index;
            $('album-viewer-img').src = items[index].src;
            $('album-viewer-img').alt = items[index].caption || '';
            $('album-viewer-caption').textContent = items[index].caption || '';
            $('album-viewer-index').textContent = `${index + 1} / ${items.length} · ${sources[current].label}`;
            viewer.classList.add('open'); viewer.setAttribute('aria-hidden', 'false'); grid.inert = true;
            if (!viewer.contains(document.activeElement)) $('album-close').focus({ preventScroll: true });
        }
        function closeViewer() {
            const previous = viewerIndex;
            viewer.classList.remove('open'); viewer.setAttribute('aria-hidden', 'true'); grid.inert = false;
            viewerIndex = -1;
            if (previous >= 0) grid.querySelector(`[data-idx="${previous}"]`)?.focus({ preventScroll: true });
        }
        function step(delta) { if (viewerIndex >= 0 && items.length) openViewer((viewerIndex + delta + items.length) % items.length); }
        grid.addEventListener('click', (event) => { const figure = event.target.closest('.album-item'); if (figure) openViewer(Number(figure.dataset.idx)); });
        grid.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const figure = event.target.closest('.album-item');
            if (figure) { event.preventDefault(); openViewer(Number(figure.dataset.idx)); }
        });
        tabs.addEventListener('click', (event) => { const button = event.target.closest('[data-album]'); if (button && button.dataset.album !== current) load(button.dataset.album); });
        $('album-prev').addEventListener('click', () => step(-1));
        $('album-next').addEventListener('click', () => step(1));
        $('album-close').addEventListener('click', closeViewer);
        viewer.addEventListener('click', (event) => { if (event.target === viewer || event.target.classList.contains('viewer-stage')) closeViewer(); });
        document.addEventListener('keydown', (event) => {
            if (!awake || currentApp !== 'album' || viewerIndex < 0) return;
            if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
            if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
        });
        hooks.album = {
            onOpen() { if (!loaded) { loaded = true; load(current); } }, onClose: closeViewer,
            onEscape() { if (viewerIndex >= 0) { closeViewer(); return true; } return false; }
        };
        return { load };
    })();

    window.StudioApps = { TerminalApp, AlbumApp };
})();
