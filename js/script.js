/* =============================================================
 * Huanfly · 手绘森林主题交互
 * 1. 点击灵气迸发（绿/青色粒子）
 * 2. 全屏漂浮萤火灵气（缓慢上浮的发光点）
 * 3. 主题切换 / 移动端菜单 / 键盘可达性
 * 4. 首页问候与动态时间线 / 不蒜子统计 / 滚动浮现
 * ============================================================= */

const SPIRIT_BURST_CONFIG = {
    burstParticleCount: 18,
    ringParticleCount: 8,
    maxParticles: 300,
    maxFlashes: 40,
    clickCooldownMs: 90,
    gravity: -0.012,   // 灵气轻微上浮
    drag: 0.965,
    lifeMin: 28,
    lifeMax: 50,
    speedMin: 1.2,
    speedMax: 3.4,
    ringSpeed: 1.8,
    centerFlashLife: 14,
    colors: ['#6ab04c', '#8fd873', '#4fc4cf', '#7ee3ec', '#b8f0f5', '#f2c46e']
};

function initSpiritBurstEffect() {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = motionQuery.matches;
    let lastBurstAt = 0;

    let canvas = null;
    let ctx = null;
    let rafId = null;
    let dpr = 1;
    const particles = [];
    const flashes = [];

    const randomBetween = (min, max) => min + Math.random() * (max - min);
    const pickColor = () => SPIRIT_BURST_CONFIG.colors[Math.floor(Math.random() * SPIRIT_BURST_CONFIG.colors.length)];

    function ensureCanvas() {
        if (canvas || prefersReducedMotion) return;
        canvas = document.createElement('canvas');
        canvas.className = 'burst-layer';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        resizeCanvas();
    }

    function removeCanvas() {
        if (!canvas) return;
        cancelAnimationFrame(rafId);
        rafId = null;
        particles.length = 0;
        flashes.length = 0;
        canvas.remove();
        canvas = null;
        ctx = null;
    }

    function resizeCanvas() {
        if (!canvas || !ctx) return;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createReducedMotionPulse(x, y) {
        const pulse = document.createElement('span');
        pulse.className = 'reduced-motion-click';
        pulse.style.left = x + 'px';
        pulse.style.top = y + 'px';
        document.body.appendChild(pulse);
        pulse.addEventListener('animationend', () => pulse.remove(), { once: true });
    }

    function spawnParticle(x, y, speed, angle, color, sizeScale = 1) {
        const life = Math.floor(randomBetween(SPIRIT_BURST_CONFIG.lifeMin, SPIRIT_BURST_CONFIG.lifeMax));
        particles.push({
            x,
            y,
            prevX: x,
            prevY: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            drag: randomBetween(SPIRIT_BURST_CONFIG.drag - 0.02, SPIRIT_BURST_CONFIG.drag + 0.01),
            gravity: SPIRIT_BURST_CONFIG.gravity + randomBetween(-0.008, 0.008),
            life,
            maxLife: life,
            color,
            size: randomBetween(1.4, 2.6) * sizeScale
        });
    }

    function spawnBurst(x, y) {
        if (prefersReducedMotion) {
            createReducedMotionPulse(x, y);
            return;
        }

        ensureCanvas();
        if (!ctx) return;

        const now = performance.now();
        if (now - lastBurstAt < SPIRIT_BURST_CONFIG.clickCooldownMs) return;
        lastBurstAt = now;

        for (let i = 0; i < SPIRIT_BURST_CONFIG.burstParticleCount; i += 1) {
            const angle = randomBetween(0, Math.PI * 2);
            const speed = randomBetween(SPIRIT_BURST_CONFIG.speedMin, SPIRIT_BURST_CONFIG.speedMax);
            spawnParticle(x, y, speed, angle, pickColor(), 1);
        }

        for (let i = 0; i < SPIRIT_BURST_CONFIG.ringParticleCount; i += 1) {
            const angle = (Math.PI * 2 / SPIRIT_BURST_CONFIG.ringParticleCount) * i;
            const speed = SPIRIT_BURST_CONFIG.ringSpeed + randomBetween(-0.3, 0.3);
            spawnParticle(x, y, speed, angle, pickColor(), 1.2);
        }

        flashes.push({
            x,
            y,
            life: SPIRIT_BURST_CONFIG.centerFlashLife,
            maxLife: SPIRIT_BURST_CONFIG.centerFlashLife
        });

        if (particles.length > SPIRIT_BURST_CONFIG.maxParticles) {
            particles.splice(0, particles.length - SPIRIT_BURST_CONFIG.maxParticles);
        }
        if (flashes.length > SPIRIT_BURST_CONFIG.maxFlashes) {
            flashes.splice(0, flashes.length - SPIRIT_BURST_CONFIG.maxFlashes);
        }

        if (!rafId) {
            rafId = requestAnimationFrame(tick);
        }
    }

    function tick() {
        if (!ctx || !canvas) {
            rafId = null;
            return;
        }

        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.globalCompositeOperation = 'lighter';

        for (let i = particles.length - 1; i >= 0; i -= 1) {
            const particle = particles[i];
            particle.prevX = particle.x;
            particle.prevY = particle.y;

            particle.vx *= particle.drag;
            particle.vy = particle.vy * particle.drag + particle.gravity;
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= 1;

            const alpha = Math.max(particle.life / particle.maxLife, 0);
            ctx.globalAlpha = alpha * 0.9;
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = Math.max(particle.size * 0.6, 0.8);
            ctx.beginPath();
            ctx.moveTo(particle.prevX, particle.prevY);
            ctx.lineTo(particle.x, particle.y);
            ctx.stroke();

            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();

            if (particle.life <= 0 || alpha <= 0) {
                particles.splice(i, 1);
            }
        }

        for (let i = flashes.length - 1; i >= 0; i -= 1) {
            const flash = flashes[i];
            flash.life -= 1;
            const alpha = Math.max(flash.life / flash.maxLife, 0);
            const radius = 6 + (1 - alpha) * 26;

            const gradient = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, radius);
            gradient.addColorStop(0, `rgba(216, 255, 226, ${0.55 * alpha})`);
            gradient.addColorStop(0.45, `rgba(126, 227, 236, ${0.3 * alpha})`);
            gradient.addColorStop(1, 'rgba(106, 176, 76, 0)');

            ctx.globalAlpha = 1;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
            ctx.fill();

            if (flash.life <= 0) {
                flashes.splice(i, 1);
            }
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        if (particles.length > 0 || flashes.length > 0) {
            rafId = requestAnimationFrame(tick);
        } else {
            rafId = null;
        }
    }

    function handlePointerDown(event) {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        spawnBurst(event.clientX, event.clientY);
    }

    function handleMotionChange(event) {
        prefersReducedMotion = event.matches;
        if (prefersReducedMotion) {
            removeCanvas();
        }
    }

    if (!prefersReducedMotion) {
        ensureCanvas();
    }

    window.addEventListener('resize', resizeCanvas, { passive: true });
    document.addEventListener('pointerdown', handlePointerDown);

    if (typeof motionQuery.addEventListener === 'function') {
        motionQuery.addEventListener('change', handleMotionChange);
    } else if (typeof motionQuery.addListener === 'function') {
        motionQuery.addListener(handleMotionChange);
    }
}

/* =============================================================
 * 漂浮萤火灵气：缓慢上浮、左右摇曳的发光点
 * ============================================================= */
function initAmbientSpirits() {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return;

    const COLORS = ['#8fd873', '#7ee3ec', '#b8f0f5', '#f2c46e'];
    const canvas = document.createElement('canvas');
    canvas.className = 'spirit-layer';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let dpr = 1;
    let width = 0;
    let height = 0;
    let rafId = null;
    let spirits = [];

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        seed();
    }

    function seed() {
        const count = width < 768 ? 10 : 20;
        spirits = Array.from({ length: count }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            r: 1 + Math.random() * 2.2,
            rise: 0.12 + Math.random() * 0.22,
            swayAmp: 16 + Math.random() * 28,
            swaySpeed: 0.0006 + Math.random() * 0.0009,
            phase: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.0012 + Math.random() * 0.0018,
            color: COLORS[Math.floor(Math.random() * COLORS.length)]
        }));
    }

    function tick(t) {
        ctx.clearRect(0, 0, width, height);
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const baseAlpha = isDark ? 0.55 : 0.32;

        for (const s of spirits) {
            s.y -= s.rise;
            if (s.y < -10) {
                s.y = height + 10;
                s.x = Math.random() * width;
            }
            const x = s.x + Math.sin(t * s.swaySpeed + s.phase) * s.swayAmp;
            const twinkle = 0.6 + 0.4 * Math.sin(t * s.twinkleSpeed + s.phase * 2);
            const alpha = baseAlpha * twinkle;

            const glow = ctx.createRadialGradient(x, s.y, 0, x, s.y, s.r * 5);
            glow.addColorStop(0, s.color);
            glow.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.globalAlpha = alpha * 0.35;
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(x, s.y, s.r * 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = alpha;
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        rafId = requestAnimationFrame(tick);
    }

    function start() {
        if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function stop() {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    function destroy() {
        stop();
        canvas.remove();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stop();
        } else if (!motionQuery.matches) {
            start();
        }
    });

    const onMotionChange = (event) => {
        if (event.matches) destroy();
    };
    if (typeof motionQuery.addEventListener === 'function') {
        motionQuery.addEventListener('change', onMotionChange);
    } else if (typeof motionQuery.addListener === 'function') {
        motionQuery.addListener(onMotionChange);
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();
    start();
}

/* =============================================================
 * 时间感知问候语：按时段输出森林世界观文案（仅首页）
 * ============================================================= */
function initTimeGreeting() {
    const el = document.getElementById('hero-greeting');
    if (!el) return;

    const hour = new Date().getHours();
    let text;
    if (hour >= 5 && hour < 7) {
        text = '清晨的森林刚醒，露水还挂在叶尖上。你来得真早 🌿';
    } else if (hour < 11) {
        text = '上午好！阳光穿过树叶洒下来，是个适合折腾的日子 ☀️';
    } else if (hour < 13) {
        text = '晌午了，小黑趴在树荫下打盹。记得吃饭休息哦 🍃';
    } else if (hour < 17) {
        text = '下午的风带着草木香，泡杯茶慢慢逛吧 🍵';
    } else if (hour < 19) {
        text = '夕阳把山丘染成了橘子色，今天过得怎么样？🌄';
    } else if (hour < 23) {
        text = '夜幕降临，萤火虫提着小灯笼出来巡山了 ✨';
    } else {
        text = '夜深了，连小黑都睡着了。早点休息，梦里也有森林 🌙';
    }
    el.textContent = text;
}

/* =============================================================
 * 最新动态时间线：posts.json（文章）+ activity.json（站事）合流（仅首页）
 * ============================================================= */
function initActivityTimeline() {
    const box = document.getElementById('activity-timeline');
    if (!box) return;

    const TYPE_BADGE = {
        post: { label: '文章', tone: 'tone-green', icon: 'fa-pen-nib' },
        tool: { label: '工具', tone: 'tone-teal', icon: 'fa-toolbox' },
        site: { label: '站点', tone: 'tone-amber', icon: 'fa-seedling' }
    };

    function relativeTime(dateStr) {
        const days = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00')) / 86400000);
        if (days <= 0) return '今天';
        if (days < 30) return days + ' 天前';
        if (days < 365) return Math.floor(days / 30) + ' 个月前';
        return Math.floor(days / 365) + ' 年前';
    }

    Promise.all([
        fetch('posts/posts.json').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('activity.json').then(r => r.ok ? r.json() : []).catch(() => [])
    ]).then(([posts, activities]) => {
        const items = [
            ...posts.map(p => ({
                type: 'post',
                date: p.date,
                title: p.title,
                link: 'blog.html#post=' + encodeURIComponent(p.file)
            })),
            ...activities
        ].filter(item => item.date && item.title)
         .sort((a, b) => b.date.localeCompare(a.date))
         .slice(0, 6);

        if (!items.length) {
            box.closest('section')?.remove();
            return;
        }

        box.innerHTML = items.map(item => {
            const badge = TYPE_BADGE[item.type] || TYPE_BADGE.site;
            const title = item.link
                ? `<a href="${item.link}">${item.title}</a>`
                : item.title;
            return `<div class="activity-item ${badge.tone}">
                <span class="timeline-dot"></span>
                <div class="activity-body">
                    <span class="activity-badge"><i class="fas ${badge.icon}"></i> ${badge.label}</span>
                    <span class="activity-title">${title}</span>
                    <time class="activity-time" datetime="${item.date}" title="${item.date}">${relativeTime(item.date)}</time>
                </div>
            </div>`;
        }).join('');
    }).catch(() => {
        box.closest('section')?.remove();
    });
}

/* =============================================================
 * 不蒜子访问统计：等待其脚本回填后再展示，失败则保持隐藏
 * ============================================================= */
function initBusuanzi() {
    const box = document.getElementById('site-stats');
    if (!box) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
    script.onerror = () => box.remove();
    document.body.appendChild(script);

    // 轮询等待不蒜子回填数字（其脚本无加载完成事件）
    let tries = 0;
    const timer = setInterval(() => {
        const pv = document.getElementById('busuanzi_value_site_pv');
        tries += 1;
        if (pv && pv.textContent.trim() !== '') {
            box.classList.add('visible');
            clearInterval(timer);
        } else if (tries > 40) {
            box.remove();
            clearInterval(timer);
        }
    }, 250);
}

/* =============================================================
 * 滚动浮现（替代 AOS）：进入视口后播放入场动画
 * 动态渲染的内容（如博客卡片）插入后调用 observeReveal(容器) 登记
 * ============================================================= */
const revealObserver = ('IntersectionObserver' in window)
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { rootMargin: '0px 0px -100px 0px' })
    : null;

window.observeReveal = root => {
    (root || document).querySelectorAll('[data-reveal]:not(.revealed)').forEach(el => {
        if (revealObserver) {
            revealObserver.observe(el);
        } else {
            el.classList.add('revealed');
        }
    });
};

/* =============================================================
 * 基础交互：主题切换 / 移动端菜单 / 键盘可达性
 * 首帧主题由各页 <head> 内联脚本写入 data-theme，这里只负责图标同步与切换。
 * 页内锚点交给浏览器原生处理：style.css 的 scroll-behavior / scroll-padding-top 负责
 * 平滑滚动与避开吸顶导航，博客与工具页的 #hash 视图路由也因此不会被拦截。
 * ============================================================= */
document.addEventListener('DOMContentLoaded', () => {
    observeReveal(document);
    initSpiritBurstEffect();
    initAmbientSpirits();
    initTimeGreeting();
    initActivityTimeline();
    initBusuanzi();

    // --- 主题切换 ---
    const themeToggles = document.querySelectorAll('.theme-toggle');

    function updateThemeIcons(theme) {
        themeToggles.forEach(toggle => {
            const icon = toggle.querySelector('i');
            if (!icon) return;
            icon.classList.toggle('fa-sun', theme === 'dark');
            icon.classList.toggle('fa-moon', theme !== 'dark');
        });
    }

    updateThemeIcons(document.documentElement.getAttribute('data-theme'));

    themeToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            try { localStorage.setItem('theme', newTheme); } catch (error) { /* 隐私模式下忽略 */ }
            updateThemeIcons(newTheme);
        });
    });

    // --- 移动端菜单 ---
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    function setMenuOpen(open) {
        if (!menuToggle || !navLinks) return;
        navLinks.classList.toggle('active', open);
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
        const icon = menuToggle.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-times', open);
            icon.classList.toggle('fa-bars', !open);
        }
    }

    if (menuToggle && navLinks) {
        setMenuOpen(false);
        menuToggle.addEventListener('click', () => setMenuOpen(!navLinks.classList.contains('active')));

        // 点击菜单外、选中任一导航链接或按 Esc 都收起菜单
        document.addEventListener('click', (e) => {
            if (!navLinks.classList.contains('active')) return;
            if (e.target.closest('a') && navLinks.contains(e.target)) {
                setMenuOpen(false);
            } else if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
                setMenuOpen(false);
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navLinks.classList.contains('active')) {
                setMenuOpen(false);
                menuToggle.focus();
            }
        });
    }

    // --- 键盘可达性：带 role="button" 的可点击卡片支持 Enter / 空格 ---
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const target = e.target;
        if (!(target instanceof HTMLElement) || target.getAttribute('role') !== 'button') return;
        if (target.matches('button, a, input, select, textarea')) return;
        e.preventDefault();
        target.click();
    });
});
