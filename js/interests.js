/**
 * 兴趣爱好详情视图：摄影、科技制作、阅读
 * 与 about.html 配合使用
 */
(function () {
    'use strict';

    const CONFIG = {
        photography: 'interests/photography/index.json',
        tech: 'interests/tech/index.json',
        reading: 'interests/reading/books.json'
    };

    const listView = document.getElementById('interest-list-view');
    const photoView = document.getElementById('interest-photography-view');
    const techView = document.getElementById('interest-tech-view');
    const readingView = document.getElementById('interest-reading-view');

    window.showInterest = function (type) {
        if (!listView) return;
        listView.style.display = 'none';
        photoView.style.display = 'none';
        techView.style.display = 'none';
        readingView.style.display = 'none';

        if (type === 'photography') {
            photoView.style.display = 'block';
            fetch(CONFIG.photography)
                .then(r => r.ok ? r.json() : Promise.reject(new Error('加载失败')))
                .then(items => renderPhotoGallery(items))
                .catch(err => renderError(document.getElementById('photo-gallery'), err));
        } else if (type === 'tech') {
            techView.style.display = 'block';
            fetch(CONFIG.tech)
                .then(r => r.ok ? r.json() : Promise.reject(new Error('加载失败')))
                .then(items => renderTechGallery(items))
                .catch(err => renderError(document.getElementById('tech-gallery'), err));
        } else if (type === 'reading') {
            readingView.style.display = 'block';
            fetch(CONFIG.reading)
                .then(r => r.ok ? r.json() : Promise.reject(new Error('加载失败')))
                .then(data => {
                    renderReading(data);
                })
                .catch(err => {
                    renderError(document.getElementById('books-list'), err);
                    document.getElementById('platforms-list').innerHTML = '';
                });
        }
        window.scrollTo(0, document.getElementById('interest-section').offsetTop - 80);
    };

    window.hideInterest = function () {
        if (listView) listView.style.display = 'grid';
        if (photoView) photoView.style.display = 'none';
        if (techView) techView.style.display = 'none';
        if (readingView) readingView.style.display = 'none';
    };

    function renderError(el, err) {
        if (!el) return;
        el.innerHTML = '<div class="interest-empty"><i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #e74c3c;"></i><p>加载失败：' + (err.message || '未知错误') + '</p><p style="font-size: 0.9rem; color: var(--light-text);">请检查网络或 JSON 配置后刷新</p></div>';
    }

    function renderPhotoGallery(items) {
        const gallery = document.getElementById('photo-gallery');
        if (!gallery) return;
        if (!items || !items.length) {
            gallery.innerHTML = '<div class="interest-empty"><i class="fas fa-images" style="font-size: 2rem; color: var(--light-text);"></i><p>暂无可展示的摄影作品</p><p style="font-size: 0.9rem; color: var(--light-text);">将图片放入 interests/photography/ 并在 index.json 中追加条目</p></div>';
            return;
        }
        gallery.innerHTML = items.map(function (item) {
            return renderImageCard(item);
        }).join('');
    }

    function renderTechGallery(items) {
        const gallery = document.getElementById('tech-gallery');
        if (!gallery) return;
        if (!items || !items.length) {
            gallery.innerHTML = '<div class="interest-empty"><i class="fas fa-tools" style="font-size: 2rem; color: var(--light-text);"></i><p>暂无可展示的科技制作项目</p><p style="font-size: 0.9rem; color: var(--light-text);">将图片或视频放入 interests/tech/ 并在 index.json 中追加条目</p></div>';
            return;
        }
        gallery.innerHTML = items.map(function (item) {
            const type = (item.type || 'image').toLowerCase();
            const src = item.src || '';
            const cap = item.caption || '';
            if (type === 'video') {
                return '<div class="interest-media-card interest-video-card"><div class="interest-media-frame"><video src="' + src + '" controls preload="metadata"></video></div><p class="interest-caption">' + cap + '</p></div>';
            }
            return renderImageCard(item);
        }).join('');
    }

    function renderImageCard(item) {
        const src = item.src || '';
        const cap = item.caption || '';
        const objectPosition = normalizeObjectPosition(item.position);
        return '<div class="interest-media-card" role="button" tabindex="0" aria-label="放大查看：' + escapeHtml(cap) + '" onclick="openLightbox(\'' + escapeJsString(src) + '\', \'' + escapeJsString(cap) + '\')"><div class="interest-media-frame"><img src="' + src + '" alt="' + escapeHtml(cap) + '" loading="lazy" decoding="async" style="object-position: ' + objectPosition + ';"></div><p class="interest-caption">' + escapeHtml(cap) + '</p></div>';
    }

    function normalizeObjectPosition(value) {
        const cleaned = String(value || '').replace(/[^0-9a-zA-Z.%\s-]/g, '').trim();
        return cleaned || 'center center';
    }

    function escapeJsString(value) {
        return String(value || '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'");
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderReading(data) {
        const booksEl = document.getElementById('books-list');
        const platformsEl = document.getElementById('platforms-list');
        if (!booksEl || !platformsEl) return;

        const books = (data && data.books) ? data.books : [];
        const platforms = (data && data.platforms) ? data.platforms : [];

        if (!books.length) {
            booksEl.innerHTML = '<div class="interest-empty"><i class="fas fa-book" style="font-size: 2rem; color: var(--light-text);"></i><p>暂无推荐书籍</p><p style="font-size: 0.9rem; color: var(--light-text);">编辑 interests/reading/books.json 添加书籍与书评</p></div>';
        } else {
            booksEl.innerHTML = books.map(function (b) {
                const cover = b.cover || 'picture/icon.png';
                return '<div class="interest-book-card"><img src="' + cover + '" alt="' + (b.title || '') + '"><div class="interest-book-info"><h4>' + (b.title || '未知') + '</h4><p class="interest-book-author">' + (b.author || '') + '</p><p class="interest-book-review">' + (b.review || '') + '</p></div></div>';
            }).join('');
        }

        if (!platforms.length) {
            platformsEl.innerHTML = '<div class="interest-empty"><p>暂无平台链接</p></div>';
        } else {
            platformsEl.innerHTML = platforms.map(function (p) {
                return '<a href="' + (p.url || '#') + '" target="_blank" rel="noopener" class="interest-platform-card"><span class="platform-row"><i class="fas fa-external-link-alt"></i><span class="platform-name">' + (p.name || '') + '</span></span><span class="platform-desc">' + (p.desc || '') + '</span></a>';
            }).join('');
        }
    }

    let lightboxOpener = null;

    window.openLightbox = function (src, caption) {
        const lb = document.getElementById('lightbox');
        const img = document.getElementById('lightbox-img');
        const capEl = document.getElementById('lightbox-caption');
        if (lb && img) {
            lightboxOpener = document.activeElement;
            img.src = src;
            if (capEl) capEl.textContent = caption || '';
            lb.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            const closeBtn = lb.querySelector('.lightbox-close');
            if (closeBtn) closeBtn.focus();
        }
    };

    // Esc 关闭灯箱
    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        const lb = document.getElementById('lightbox');
        if (lb && lb.style.display !== 'none') window.closeLightbox();
    });

    window.showToast = function (msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = msg || '当前还没内容哦~';

        clearTimeout(toast._hideTimer);
        clearTimeout(toast._cleanupTimer);

        toast.classList.remove('toast-show', 'toast-hide');

        // Force reflow so repeated taps can replay fade animation on mobile browsers.
        void toast.offsetWidth;

        toast.classList.add('toast-show');

        toast._hideTimer = setTimeout(function () {
            toast.classList.remove('toast-show');
            toast.classList.add('toast-hide');

            toast._cleanupTimer = setTimeout(function () {
                toast.classList.remove('toast-hide');
            }, 340);
        }, 1800);
    };

    window.closeLightbox = function (event) {
        if (event && event.target !== event.currentTarget && !event.target.closest('.lightbox-close')) return;
        const lb = document.getElementById('lightbox');
        if (lb) {
            lb.style.display = 'none';
            document.body.style.overflow = '';
        }
        if (lightboxOpener && typeof lightboxOpener.focus === 'function') lightboxOpener.focus();
        lightboxOpener = null;
    };
})();
