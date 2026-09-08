/* =============================================================
 * Huanfly · 首页 Hero 景观（仅 index.html）
 * 1. 时段天空：按主题与本地时间写入 .hero[data-daypart]，并推算太阳在弧线上的位置
 * 2. 视差：精细指针设备跟随指针，所有设备跟随滚动；远 / 中 / 近三层与云层位移不同
 * 3. 粒子：白天飘落叶与花瓣、夜晚草间萤火；指针快速移动会起一阵风
 * 4. 小黑：眼神追随指针（无指针时四处张望）、悬停竖耳、点击开心 + 气泡、久不动打瞌睡
 * 渲染循环只在 Hero 可见且标签页前台运行；prefers-reduced-motion 下退化为静态插画，
 * 但小黑仍可点击。脚本失效时 HTML / CSS 本身就是一幅完整的静态插画。
 * ============================================================= */
(function () {
    'use strict';

    const hero = document.getElementById('hero');
    if (!hero) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const layers = {
        far: hero.querySelector('.hero-far'),
        mid: hero.querySelector('.hero-mid'),
        near: hero.querySelector('.hero-near'),
        clouds: hero.querySelector('.hero-clouds')
    };
    const scene = hero.querySelector('.hero-scene');
    const cat = document.getElementById('hero-cat');
    const bubble = document.getElementById('cat-bubble');

    let forcedDaypart = null;
    let daypart = null;
    let heroVisible = true;
    let heroHeight = hero.offsetHeight;
    let rafId = null;
    let lastTick = 0;

    /* ---------------- 时段与太阳 ---------------- */
    function hourOf(now) {
        return now.getHours() + now.getMinutes() / 60;
    }

    function computeDaypart(now) {
        if (forcedDaypart) return forcedDaypart;
        if (document.documentElement.getAttribute('data-theme') === 'dark') return 'night';
        const h = hourOf(now);
        if (h >= 5 && h < 7) return 'dawn';
        if (h >= 17 && h < 19.5) return 'dusk';
        return 'day';
    }

    // 6:00 自左侧山后升起，18:00 落回右侧山后；弧线整体偏右上，避开居中的正文
    function sunPosition(now, dp) {
        const h = hourOf(now);
        let t = (h - 6) / 12;
        if (dp === 'day' && (h < 5 || h >= 19.5)) t = 0.5;
        if (dp === 'dawn') t = 0.04;
        if (dp === 'dusk') t = 0.96;
        t = clamp(t, 0, 1);
        // 窄屏正文占满宽度，弧线再往右让开头像
        const narrow = window.innerWidth < 768;
        const x = narrow ? 76 + 18 * t : 66 + 26 * t;
        return { x, y: 46 - 34 * Math.sin(Math.PI * t) };
    }

    function applyDaypart() {
        const now = new Date();
        const dp = computeDaypart(now);
        const sun = sunPosition(now, dp);
        hero.style.setProperty('--sun-x', sun.x.toFixed(1) + '%');
        hero.style.setProperty('--sun-y', sun.y.toFixed(1) + '%');
        if (dp !== daypart) {
            daypart = dp;
            hero.dataset.daypart = dp;
            particles.setMode(dp === 'night' ? 'fireflies' : 'leaves');
        }
    }

    /* ---------------- 视差 ---------------- */
    const pointer = { tx: 0, ty: 0, x: 0, y: 0 };
    let scrollOffset = 0;

    function setLayer(el, ampX, ampY, scrollFactor, scale) {
        if (!el) return;
        const x = pointer.x * ampX;
        const y = pointer.y * ampY + scrollOffset * scrollFactor;
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)${scale ? ' scale(1.04)' : ''}`;
    }

    function updateParallax() {
        pointer.x += (pointer.tx - pointer.x) * 0.06;
        pointer.y += (pointer.ty - pointer.y) * 0.06;
        setLayer(layers.clouds, 10, 4, 0.22, false);
        setLayer(layers.far, 6, 3, 0.30, true);
        setLayer(layers.mid, 14, 6, 0.16, true);
        setLayer(layers.near, 24, 10, 0, true);
    }

    function resetParallax() {
        Object.values(layers).forEach((el) => {
            if (el) el.style.transform = '';
        });
    }

    /* ---------------- 粒子：落叶 / 萤火 ---------------- */
    const particles = (() => {
        const LEAF_COLORS = ['#7cba5e', '#a8d38a', '#f2b950', '#e8836f', '#d9a14a', '#8fd873'];
        const FIREFLY_COLORS = ['#f2e58a', '#8fd873', '#7ee3ec', '#f2c46e'];
        let canvas = null;
        let ctx = null;
        let width = 0;
        let height = 0;
        let sceneHeight = 0;
        let dpr = 1;
        let mode = 'leaves';
        let items = [];
        let wind = 0;
        let windTarget = 0;

        function ensure() {
            if (canvas || !scene) return;
            canvas = document.createElement('canvas');
            canvas.className = 'hero-particles';
            canvas.setAttribute('aria-hidden', 'true');
            scene.appendChild(canvas);
            ctx = canvas.getContext('2d');
            resize();
        }

        function destroy() {
            if (!canvas) return;
            canvas.remove();
            canvas = null;
            ctx = null;
            items = [];
        }

        function resize() {
            if (!canvas) return;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = hero.clientWidth;
            height = hero.clientHeight;
            sceneHeight = layers.near ? layers.near.getBoundingClientRect().height : height * 0.4;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seed();
        }

        function seed() {
            const narrow = width < 768;
            const count = mode === 'leaves' ? (narrow ? 9 : 22) : (narrow ? 7 : 16);
            items = Array.from({ length: count }, () => spawn(true));
        }

        function spawn(initial) {
            if (mode === 'leaves') {
                return {
                    x: Math.random() * width,
                    y: initial ? Math.random() * height : -24,
                    size: 5 + Math.random() * 7,
                    vy: 0.35 + Math.random() * 0.55,
                    rot: Math.random() * Math.PI * 2,
                    vr: (Math.random() - 0.5) * 0.05,
                    phase: Math.random() * Math.PI * 2,
                    petal: Math.random() < 0.35,
                    alpha: 0.7 + Math.random() * 0.3,
                    color: pick(LEAF_COLORS)
                };
            }
            return {
                x: Math.random() * width,
                y: height * (0.42 + Math.random() * 0.52),
                r: 1.4 + Math.random() * 1.6,
                phase: Math.random() * Math.PI * 2,
                speed: 0.0005 + Math.random() * 0.0007,
                ax: 24 + Math.random() * 46,
                ay: 10 + Math.random() * 22,
                twinkle: 0.0012 + Math.random() * 0.0018,
                color: pick(FIREFLY_COLORS)
            };
        }

        function drawLeaf(p, alpha) {
            const s = p.size;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = alpha * p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            if (p.petal) {
                ctx.ellipse(0, 0, s * 0.55, s * 0.36, 0, 0, Math.PI * 2);
            } else {
                ctx.moveTo(-s, 0);
                ctx.quadraticCurveTo(0, -s * 0.62, s, 0);
                ctx.quadraticCurveTo(0, s * 0.62, -s, 0);
            }
            ctx.fill();
            if (!p.petal && s > 7) {
                ctx.strokeStyle = 'rgba(47, 54, 48, 0.16)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(-s * 0.75, 0);
                ctx.lineTo(s * 0.75, 0);
                ctx.stroke();
            }
            ctx.restore();
        }

        function tick(t, dt) {
            if (!ctx) return;
            const step = dt / 16.7;
            wind += (windTarget - wind) * 0.03;
            windTarget *= 0.985;
            ctx.clearRect(0, 0, width, height);

            if (mode === 'leaves') {
                const ambient = Math.sin(t * 0.0004) * 0.22;
                // 叶子落到前山附近就淡出，像掉进了草丛
                const groundY = height - sceneHeight * 0.5;
                const fadeSpan = Math.max(sceneHeight * 0.3, 20);
                for (let i = 0; i < items.length; i += 1) {
                    const p = items[i];
                    p.y += p.vy * step;
                    p.x += (Math.sin(t * 0.0011 + p.phase) * 0.35 + wind + ambient) * step;
                    p.rot += (p.vr + wind * 0.012) * step;
                    const alpha = p.y > groundY ? clamp(1 - (p.y - groundY) / fadeSpan, 0, 1) : 1;
                    if (alpha <= 0 || p.y > height + 30 || p.x < -40 || p.x > width + 40) {
                        items[i] = spawn(false);
                        continue;
                    }
                    drawLeaf(p, alpha);
                }
                return;
            }

            for (const p of items) {
                const x = p.x + Math.sin(t * p.speed + p.phase) * p.ax + wind * 6;
                const y = p.y + Math.sin(t * p.speed * 1.31 + p.phase * 2) * p.ay;
                const alpha = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * p.twinkle + p.phase * 3));
                const glow = ctx.createRadialGradient(x, y, 0, x, y, p.r * 6);
                glow.addColorStop(0, p.color);
                glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.globalAlpha = alpha * 0.35;
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(x, y, p.r * 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(x, y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        function gust(vx) {
            windTarget = clamp(windTarget + vx * 0.02, -2.4, 2.4);
        }

        function setMode(next) {
            if (next === mode) return;
            mode = next;
            if (canvas) seed();
        }

        return { ensure, destroy, resize, tick, gust, setMode };
    })();

    /* ---------------- 小黑 ---------------- */
    const GREETINGS = {
        dawn: '早呀，露水还没干呢 🌿',
        day: '喵～ 欢迎来我家的山坡坐坐',
        dusk: '晚霞真好看，看一眼再走吧',
        night: '夜深啦，我在等萤火虫出来 ✨'
    };
    const QUIPS = {
        common: ['喵～', '别戳啦，痒痒的', '你的鼠标好好玩', '要去工作室看看吗？', '今天也要好好吃饭哦', '我在这儿看家呢', '嘘——听，有风声', '再摸一下我就要打呼了'],
        dawn: ['清晨的空气凉凉的', '太阳快爬上山啦'],
        day: ['风把叶子吹下来了', '树荫下最适合打盹'],
        dusk: ['天边像被染了颜色', '快到吃晚饭的时候了'],
        night: ['萤火虫提着小灯笼出来了', '星星比昨天多了一颗', '夜里的森林很安静']
    };

    const catCtl = (() => {
        if (!cat) return null;
        const head = cat.querySelector('.cat-head');
        const pupils = cat.querySelectorAll('.cat-pupil');
        const look = { x: 0, y: 0 };
        let lastPointerLookAt = 0;
        let lastLookApply = 0;
        let idleTimer = null;
        let happyTimer = null;
        let sleepTimer = null;
        let bubbleTimer = null;
        let ambientTimer = null;
        let bubbleShown = false;

        function applyLook() {
            pupils.forEach((p) => {
                p.style.transform = `translate(${(look.x * 3.4).toFixed(2)}px, ${(look.y * 3).toFixed(2)}px)`;
            });
            if (head) head.style.transform = `rotate(${(look.x * 4).toFixed(2)}deg)`;
        }

        function lookAt(clientX, clientY) {
            if (!head) return;
            const rect = head.getBoundingClientRect();
            const hx = rect.left + rect.width / 2;
            const hy = rect.top + rect.height / 2;
            look.x = clamp((clientX - hx) / (window.innerWidth * 0.32), -1, 1);
            look.y = clamp((clientY - hy) / (window.innerHeight * 0.32), -1, 1);
            applyLook();
        }

        function onPointerMove(event) {
            const now = performance.now();
            lastPointerLookAt = now;
            if (now - lastLookApply < 48) return;
            lastLookApply = now;
            lookAt(event.clientX, event.clientY);
        }

        // 无指针活动时每隔几秒随意张望一下
        function scheduleIdleLook() {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                if (heroVisible && performance.now() - lastPointerLookAt > 3500 && !cat.classList.contains('is-sleepy')) {
                    look.x = (Math.random() - 0.5) * 1.6;
                    look.y = (Math.random() - 0.5) * 1.2;
                    applyLook();
                }
                scheduleIdleLook();
            }, 2600 + Math.random() * 3000);
        }

        function bubbleAvailable() {
            return bubble && getComputedStyle(bubble).display !== 'none';
        }

        // 气泡挂在小黑耳朵旁：优先放右侧（正文居中，右侧通常空着），放不下再翻到左侧
        function positionBubble() {
            if (!bubble || !head) return;
            const heroRect = hero.getBoundingClientRect();
            const rect = head.getBoundingClientRect();
            const width = bubble.offsetWidth;
            const margin = 12;
            const headLeft = rect.left - heroRect.left;
            const headRight = rect.right - heroRect.left;
            const top = rect.top - heroRect.top + 10;
            let left = headRight + 6;
            let side = 'right';
            if (left + width > heroRect.width - margin) {
                left = Math.max(margin, headLeft - 6 - width);
                side = 'left';
            }
            bubble.style.left = left.toFixed(1) + 'px';
            bubble.style.top = top.toFixed(1) + 'px';
            bubble.dataset.side = side;
        }

        function say(text, duration) {
            if (!bubbleAvailable()) return;
            bubble.textContent = text;
            positionBubble();
            bubble.classList.add('show');
            bubbleShown = true;
            clearTimeout(bubbleTimer);
            bubbleTimer = setTimeout(hush, duration || 3200);
        }

        function hush() {
            if (!bubble) return;
            bubble.classList.remove('show');
            bubbleShown = false;
        }

        function pickQuip() {
            const pool = QUIPS.common.concat(QUIPS[daypart] || []);
            return pick(pool);
        }

        function poke() {
            wake();
            cat.classList.remove('is-happy');
            // 强制一次样式刷新，让开心动画从头重放
            void cat.getBoundingClientRect();
            cat.classList.add('is-happy');
            clearTimeout(happyTimer);
            happyTimer = setTimeout(() => cat.classList.remove('is-happy'), 1500);
            say(pickQuip(), 3200);
        }

        function scheduleSleep() {
            clearTimeout(sleepTimer);
            sleepTimer = setTimeout(() => {
                if (heroVisible && !cat.classList.contains('is-hover')) {
                    cat.classList.add('is-sleepy');
                    hush();
                }
            }, 45000);
        }

        function wake() {
            if (cat.classList.contains('is-sleepy')) {
                cat.classList.remove('is-sleepy');
                applyLook();
            }
            scheduleSleep();
        }

        function scheduleAmbient() {
            clearTimeout(ambientTimer);
            ambientTimer = setTimeout(() => {
                if (heroVisible && !document.hidden && !cat.classList.contains('is-sleepy') && !bubbleShown) {
                    say(pick(QUIPS[daypart] || QUIPS.common), 3600);
                }
                scheduleAmbient();
            }, 40000 + Math.random() * 30000);
        }

        cat.addEventListener('click', poke);
        cat.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                poke();
            }
        });
        if (finePointer.matches) {
            cat.addEventListener('pointerenter', () => {
                cat.classList.add('is-hover');
                wake();
            });
            cat.addEventListener('pointerleave', () => cat.classList.remove('is-hover'));
        }

        // 首次问候：等待入场动画落定后由小黑开口
        setTimeout(() => {
            if (heroVisible && !document.hidden) say(GREETINGS[daypart] || GREETINGS.day, 6500);
        }, 1600);

        scheduleIdleLook();
        scheduleSleep();
        scheduleAmbient();

        return {
            onPointerMove,
            wake,
            poke,
            say,
            tick() {
                if (bubbleShown) positionBubble();
            },
            relayout() {
                if (bubbleShown) positionBubble();
            }
        };
    })();

    /* ---------------- 渲染循环 ---------------- */
    function shouldRun() {
        return heroVisible && !document.hidden && !motionQuery.matches;
    }

    function frame(t) {
        rafId = null;
        if (!shouldRun()) return;
        const dt = lastTick ? Math.min(t - lastTick, 64) : 16.7;
        lastTick = t;
        updateParallax();
        particles.tick(t, dt);
        if (catCtl) catCtl.tick();
        rafId = requestAnimationFrame(frame);
    }

    function start() {
        if (!shouldRun()) return;
        particles.ensure();
        if (!rafId) {
            lastTick = 0;
            rafId = requestAnimationFrame(frame);
        }
    }

    function stop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
    }

    function handleMotionChange() {
        if (motionQuery.matches) {
            stop();
            particles.destroy();
            resetParallax();
        } else {
            start();
        }
    }

    /* ---------------- 事件接线 ---------------- */
    window.addEventListener('pointermove', (event) => {
        if (!finePointer.matches) return;
        pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
        pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
        if (Math.abs(event.movementX) > 18) particles.gust(event.movementX);
        if (catCtl) {
            catCtl.onPointerMove(event);
            catCtl.wake();
        }
    }, { passive: true });

    window.addEventListener('scroll', () => {
        scrollOffset = clamp(window.scrollY, 0, heroHeight);
        if (catCtl) catCtl.wake();
        if (!rafId && shouldRun()) start();
    }, { passive: true });

    window.addEventListener('resize', () => {
        heroHeight = hero.offsetHeight;
        particles.resize();
        applyDaypart();
        if (catCtl) catCtl.relayout();
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop(); else start();
    });

    if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
            heroVisible = entries.some((entry) => entry.isIntersecting);
            if (heroVisible) start(); else stop();
        }, { threshold: 0.02 }).observe(hero);
    }

    if (typeof motionQuery.addEventListener === 'function') {
        motionQuery.addEventListener('change', handleMotionChange);
    } else if (typeof motionQuery.addListener === 'function') {
        motionQuery.addListener(handleMotionChange);
    }

    new MutationObserver(applyDaypart).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
    setInterval(applyDaypart, 60000);

    applyDaypart();
    scrollOffset = clamp(window.scrollY, 0, heroHeight);
    start();

    // 供访客终端 / 诊断使用：手动切换时段或让小黑说话
    window.HeroScene = {
        setDaypart(dp) {
            forcedDaypart = ['dawn', 'day', 'dusk', 'night'].includes(dp) ? dp : null;
            applyDaypart();
        },
        get daypart() { return daypart; },
        poke() { if (catCtl) catCtl.poke(); },
        say(text, ms) { if (catCtl) catCtl.say(text, ms); }
    };
})();
