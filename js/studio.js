/* =============================================================
 * Huanfly · 工作室场景交互（studio.html）
 * 1. 悬停 / 触摸 / 键盘聚焦 → 手绘说明卡
 * 2. 物件互动：焊台、热风枪、风扇、元件柜、示波器、打印机、小黑…
 * 3. 显示器聚焦：以屏幕为中心推近，展开自适应 huanfly-os
 * 4. 待机屏时钟、昼夜（主题）联动、全景与显示器聚焦
 * 依赖：js/script.js（站点主题初始化）
 * 对外：window.Studio = { focusMonitor, unfocusMonitor, toggleTheme, isFocused }
 * ============================================================= */
(function () {
    'use strict';

    const root = document.getElementById('studio');
    const stage = document.getElementById('studio-stage');
    const scene = document.getElementById('studio-scene');
    if (!root || !stage || !scene) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const $ = (id) => document.getElementById(id);

    const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

    /* -------------------------------------------------------------
     * 说明卡
     * ----------------------------------------------------------- */
    const tip = $('studio-tip');
    const tipTitle = tip.querySelector('.tip-title');
    const tipText = tip.querySelector('.tip-text');
    const tipAction = tip.querySelector('.tip-action');
    let activeHotspot = null;
    let touchedHotspot = null;

    function positionTip(x, y) {
        const margin = 12;
        const rect = tip.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // 默认显示在指针上方；空间不足时翻到下方
        let top = y - rect.height - 18;
        let flip = false;
        if (top < margin + 60) {
            top = y + 24;
            flip = true;
        }
        if (top + rect.height > vh - margin) top = vh - margin - rect.height;
        let left = x;
        const half = rect.width / 2;
        if (left - half < margin) left = margin + half;
        if (left + half > vw - margin) left = vw - margin - half;
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
        tip.classList.toggle('flip', flip);
    }

    function showTip(hotspot, x, y) {
        activeHotspot = hotspot;
        tipTitle.textContent = hotspot.dataset.tipTitle || '';
        tipText.textContent = hotspot.dataset.tip || '';
        const action = hotspot.dataset.tipAction || '';
        tipAction.textContent = action;
        tipAction.style.display = action ? 'inline-block' : 'none';
        tip.setAttribute('aria-hidden', 'false');
        positionTip(x, y);
        tip.classList.add('show');
    }

    function hideTip() {
        activeHotspot = null;
        tip.classList.remove('show');
        tip.setAttribute('aria-hidden', 'true');
    }

    function hotspotCenter(hotspot) {
        const r = hotspot.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height * 0.25 };
    }

    scene.addEventListener('pointerover', (e) => {
        if (e.pointerType === 'touch') return;
        const hs = e.target.closest('.hotspot');
        if (!hs || hs === activeHotspot) return;
        showTip(hs, e.clientX, e.clientY);
    });

    scene.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch' || !activeHotspot) return;
        positionTip(e.clientX, e.clientY);
    });

    scene.addEventListener('pointerout', (e) => {
        const hs = e.target.closest('.hotspot');
        if (!hs || hs !== activeHotspot) return;
        if (e.relatedTarget && hs.contains(e.relatedTarget)) return;
        hideTip();
    });

    // 触屏：首次点按只显示说明，再次点按才触发动作
    scene.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch') return;
        const hs = e.target.closest('.hotspot');
        if (!hs) {
            clearTouched();
            hideTip();
            return;
        }
        if (touchedHotspot !== hs) {
            clearTouched();
            touchedHotspot = hs;
            hs.classList.add('is-touched');
            const c = hotspotCenter(hs);
            showTip(hs, c.x, c.y);
            hs.dataset.touchArmed = '0';
        } else {
            hs.dataset.touchArmed = '1';
        }
    });

    function clearTouched() {
        if (touchedHotspot) {
            touchedHotspot.classList.remove('is-touched');
            delete touchedHotspot.dataset.touchArmed;
            touchedHotspot = null;
        }
    }

    scene.addEventListener('focusin', (e) => {
        const hs = e.target.closest('.hotspot');
        if (!hs) return;
        const c = hotspotCenter(hs);
        showTip(hs, c.x, c.y);
    });

    scene.addEventListener('focusout', (e) => {
        const hs = e.target.closest('.hotspot');
        if (hs && hs === activeHotspot) hideTip();
    });

    /* -------------------------------------------------------------
     * 物件状态
     * ----------------------------------------------------------- */
    const state = {
        iron: false,
        gun: false,
        fan: false,
        fanManual: null,      // 用户手动指定风扇开关后不再自动跟随
        drawer: false,
        scope: 'sine',
        printer: 'idle',      // idle | printing | done
        printProgress: 0,
        printTimer: null
    };

    const SCOPE_WAVES = {
        sine: 'M411 497 q5 -13 10 0 t10 0 t10 0 t10 0',
        square: 'M411 505 h5 v-16 h5 v16 h5 v-16 h5 v16 h5 v-16 h5 v16 h5 v-16 h5 v16',
        tri: 'M411 505 l5 -16 l5 16 l5 -16 l5 16 l5 -16 l5 16 l5 -16 l5 16'
    };
    const SCOPE_ORDER = ['sine', 'square', 'tri'];

    const CAT_LINES = ['喵～', '别摸尾巴', '板子冒烟了', 'zzZ…', '该喂罐头了', '踩个键盘', '今天焊啥？'];

    function syncFan() {
        const auto = state.iron || state.gun;
        const on = state.fanManual === null ? auto : state.fanManual;
        state.fan = on;
        $('fan').classList.toggle('on', on);
    }

    function setIron(on) {
        state.iron = on;
        $('iron-station').classList.toggle('on', on);
        $('iron-temp').textContent = on ? '350°' : 'OFF';
        syncFan();
    }

    function setGun(on) {
        state.gun = on;
        $('gun-station').classList.toggle('on', on);
        $('gun-temp').textContent = on ? '380°' : 'OFF';
        syncFan();
    }

    /* ---- 3D 打印机 ---- */
    const PRINT_MAX_H = 50;
    const PRINT_DURATION = 42000;

    function renderPrinter() {
        const h = (state.printProgress / 100) * PRINT_MAX_H;
        const obj = $('printer-object');
        obj.setAttribute('height', h.toFixed(2));
        obj.setAttribute('y', (758 - h).toFixed(2));
        $('printer-gantry').style.transform = `translateY(${(-h).toFixed(2)}px)`;
        const lcd = $('printer-lcd');
        if (state.printer === 'printing') {
            lcd.textContent = Math.round(state.printProgress) + '%';
        } else if (state.printer === 'done') {
            lcd.textContent = 'DONE';
        } else {
            lcd.textContent = 'READY';
        }
    }

    function stopPrintTimer() {
        if (state.printTimer) {
            cancelAnimationFrame(state.printTimer);
            state.printTimer = null;
        }
    }

    function startPrint() {
        state.printer = 'printing';
        const printer = $('printer');
        printer.classList.remove('done');
        printer.classList.add('printing');
        const startProgress = state.printProgress;
        const startAt = performance.now();
        const remain = (1 - startProgress / 100) * PRINT_DURATION;
        const step = (now) => {
            const t = Math.min(1, (now - startAt) / remain);
            state.printProgress = startProgress + (100 - startProgress) * t;
            renderPrinter();
            if (t < 1) {
                state.printTimer = requestAnimationFrame(step);
            } else {
                finishPrint();
            }
        };
        state.printTimer = requestAnimationFrame(step);
        renderPrinter();
    }

    function pausePrint() {
        stopPrintTimer();
        state.printer = 'idle';
        $('printer').classList.remove('printing');
        renderPrinter();
        $('printer-lcd').textContent = 'PAUSE';
    }

    function finishPrint() {
        stopPrintTimer();
        state.printer = 'done';
        state.printProgress = 100;
        const printer = $('printer');
        printer.classList.remove('printing');
        printer.classList.add('done');
        renderPrinter();
    }

    function resetPrint() {
        stopPrintTimer();
        state.printer = 'idle';
        state.printProgress = 0;
        $('printer').classList.remove('printing', 'done');
        $('printer-head').style.transform = '';
        renderPrinter();
    }

    function togglePrinter() {
        if (state.printer === 'printing') {
            pausePrint();
        } else if (state.printer === 'done') {
            resetPrint();
        } else {
            startPrint();
        }
    }

    /* ---- 小黑 ---- */
    let bubbleTimer = null;
    function pokeCat() {
        const cat = $('cat');
        const bubble = $('cat-bubble');
        const text = $('cat-bubble-text');
        text.textContent = CAT_LINES[Math.floor(Math.random() * CAT_LINES.length)];
        bubble.classList.remove('show');
        // 重新触发动画
        void bubble.getBoundingClientRect();
        bubble.classList.add('show');
        cat.classList.add('excited');
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(() => {
            bubble.classList.remove('show');
            cat.classList.remove('excited');
        }, 1800);
    }

    /* ---- 主题（昼夜） ---- */
    function toggleTheme() {
        const btn = document.querySelector('.theme-toggle');
        if (btn) {
            btn.click();
            return;
        }
        const next = isDark() ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) { /* ignore */ }
    }

    function syncThemeControls() {
        const dark = isDark();
        const control = $('studio-daynight');
        control.querySelector('i').className = dark ? 'fas fa-sun' : 'fas fa-moon';
        control.setAttribute('aria-label', dark ? '切换到日间工作室' : '切换到夜间工作室');
        control.title = control.getAttribute('aria-label');
    }

    const themeObserver = new MutationObserver(() => {
        syncThemeControls();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    /* ---- 点击分发 ---- */
    const actions = {
        monitor: () => focusMonitor(),
        mouse: () => focusMonitor(),
        keyboard: () => {
            const kb = $('keyboard');
            kb.classList.remove('wave');
            void kb.getBoundingClientRect();
            kb.classList.add('wave');
            setTimeout(() => { window.location.href = 'tools/keyboard.html'; }, 650);
        },
        mug: () => $('mug').classList.toggle('on'),
        cat: () => pokeCat(),
        window: () => toggleTheme(),
        toolbox: () => {
            state.drawer = !state.drawer;
            $('toolbox').classList.toggle('open', state.drawer);
        },
        scope: () => {
            const idx = (SCOPE_ORDER.indexOf(state.scope) + 1) % SCOPE_ORDER.length;
            state.scope = SCOPE_ORDER[idx];
            $('scope-wave').setAttribute('d', SCOPE_WAVES[state.scope]);
        },
        fan: () => {
            state.fanManual = !state.fan;
            syncFan();
        },
        iron: () => setIron(!state.iron),
        gun: () => setGun(!state.gun),
        printer: () => togglePrinter(),
        board: () => $('board').classList.toggle('alt')
    };

    scene.addEventListener('click', (e) => {
        const hs = e.target.closest('.hotspot');
        if (!hs) return;
        // 触屏：第一次点按只看说明
        if (hs.dataset.touchArmed === '0') {
            hs.dataset.touchArmed = '1';
            return;
        }
        hideTip();
        const fn = actions[hs.dataset.id];
        if (fn) fn(hs, e);
    });

    scene.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const hs = e.target.closest('.hotspot');
        if (!hs) return;
        e.preventDefault();
        const fn = actions[hs.dataset.id];
        if (fn) fn(hs, e);
    });

    /* -------------------------------------------------------------
     * 待机屏时钟
     * ----------------------------------------------------------- */
    const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    function tickClock() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const clock = $('screen-clock');
        const date = $('screen-date');
        if (clock) clock.textContent = `${hh}:${mm}`;
        if (date) date.textContent = `${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${WEEKDAYS[now.getDay()]}`;
    }
    tickClock();
    setInterval(tickClock, 15000);

    /* -------------------------------------------------------------
     * 显示器聚焦
     * ----------------------------------------------------------- */
    const mfScreen = $('mf-screen');
    const mfExit = $('mf-exit');
    const mfDim = $('mf-dim');
    const focusLayer = $('monitor-focus');
    const background = [stage, $('studio-leave'), $('studio-toolbar')];
    let focused = false;
    let focusTransitionTimer = null;
    let returnFocus = null;

    function computeFocusTransform() {
        // 同一任务内先去掉 transform 再测量，中间不会绘制帧，不会闪
        const prevTransform = scene.style.transform;
        scene.style.transition = 'none';
        scene.style.transform = 'none';
        const src = $('screen-glass').getBoundingClientRect();
        const box = scene.getBoundingClientRect();
        const dst = mfScreen.getBoundingClientRect();
        scene.style.transform = prevTransform;
        void scene.getBoundingClientRect();
        scene.style.transition = '';

        // transform-origin 为 0 0：p' = box.TL + (p - box.TL) * s + t
        const s = dst.width / src.width;
        const tx = dst.left + dst.width / 2 - box.left - (src.left + src.width / 2 - box.left) * s;
        const ty = dst.top + dst.height / 2 - box.top - (src.top + src.height / 2 - box.top) * s;
        return { s, tx, ty };
    }

    function applyFocusTransform(animate) {
        const { s, tx, ty } = computeFocusTransform();
        if (!animate) scene.style.transition = 'none';
        scene.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
        if (!animate) {
            void scene.getBoundingClientRect();
            scene.style.transition = '';
        }
    }

    function focusMonitor() {
        if (focused) return;
        returnFocus = document.activeElement;
        focused = true;
        hideTip();
        dismissHint();
        clearTouched();
        root.classList.add('is-focused');
        document.body.classList.add('is-focused');
        background.forEach((el) => { el.inert = true; });
        applyFocusTransform(!reducedMotion);
        const done = () => {
            if (!focused) return;
            root.classList.add('is-focused-ready');
            focusLayer.inert = false;
            mfExit.inert = false;
            mfScreen.focus({ preventScroll: true });
            if (window.StudioOS && typeof window.StudioOS.wake === 'function') {
                window.StudioOS.wake();
            }
        };
        clearTimeout(focusTransitionTimer);
        focusTransitionTimer = setTimeout(done, reducedMotion ? 30 : 1000);
    }

    function unfocusMonitor() {
        if (!focused) return;
        focused = false;
        clearTimeout(focusTransitionTimer);
        focusLayer.inert = true;
        mfExit.inert = true;
        if (window.StudioOS && typeof window.StudioOS.sleep === 'function') {
            window.StudioOS.sleep();
        }
        root.classList.remove('is-focused-ready');
        scene.style.transform = '';
        focusTransitionTimer = setTimeout(() => {
            root.classList.remove('is-focused');
            document.body.classList.remove('is-focused');
            background.forEach((el) => { el.inert = false; });
            if (returnFocus && returnFocus !== document.body && returnFocus.isConnected) {
                returnFocus.focus({ preventScroll: true });
            } else {
                $('studio-enter').focus({ preventScroll: true });
            }
        }, reducedMotion ? 30 : 700);
    }

    mfExit.addEventListener('click', unfocusMonitor);
    mfDim.addEventListener('click', unfocusMonitor);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && focused) {
            const controls = [...focusLayer.querySelectorAll('button, input, textarea, select, a[href], summary, [tabindex="0"]')]
                .filter((el) => !el.disabled && !el.closest('[inert]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
            if (!controls.length) { e.preventDefault(); return; }
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (e.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
                e.preventDefault(); first.focus();
            }
            return;
        }
        if (e.key !== 'Escape' || !focused) return;
        if (window.StudioOS && typeof window.StudioOS.handleEscape === 'function' && window.StudioOS.handleEscape()) {
            return;
        }
        unfocusMonitor();
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (focused) {
                applyFocusTransform(false);
            }
            hideTip();
        }, 80);
    }, { passive: true });

    /* -------------------------------------------------------------
     * 入场 / 引导 / 全屏
     * ----------------------------------------------------------- */
    const hint = $('studio-hint');
    let hintTimer = null;

    function dismissHint() {
        clearTimeout(hintTimer);
        hint.classList.add('is-dismissed');
    }

    $('studio-enter').addEventListener('click', focusMonitor);
    $('studio-daynight').addEventListener('click', toggleTheme);
    $('studio-guides').addEventListener('click', (e) => {
        const visible = root.classList.toggle('show-guides');
        e.currentTarget.setAttribute('aria-pressed', String(visible));
    });

    const fullscreenButton = $('studio-fullscreen');
    fullscreenButton.hidden = !document.fullscreenEnabled;
    fullscreenButton.addEventListener('click', async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await document.documentElement.requestFullscreen();
            }
        } catch (error) {
            hint.textContent = '浏览器暂时无法进入全屏，仍可在当前窗口探索。';
            hint.classList.remove('is-dismissed');
            hintTimer = setTimeout(dismissHint, 6000);
        }
    });
    document.addEventListener('fullscreenchange', () => {
        const fullscreen = !!document.fullscreenElement;
        fullscreenButton.setAttribute('aria-pressed', String(fullscreen));
        fullscreenButton.setAttribute('aria-label', fullscreen ? '退出全屏' : '全屏查看工作室');
        fullscreenButton.title = fullscreenButton.getAttribute('aria-label');
        fullscreenButton.querySelector('i').className = fullscreen ? 'fas fa-compress' : 'fas fa-expand';
    });

    $('studio-toolbar').addEventListener('click', dismissHint);
    stage.addEventListener('pointerdown', dismissHint, { passive: true });
    stage.addEventListener('keydown', dismissHint);
    scene.addEventListener('pointercancel', () => { clearTouched(); hideTip(); });

    function init() {
        hint.textContent = window.matchMedia('(pointer: coarse)').matches
            ? '轻点查看，再点互动 · 点击显示器进入电脑'
            : '点击物件探索 · 点击显示器进入电脑';
        syncThemeControls();
        renderPrinter();
        requestAnimationFrame(() => {
            root.classList.add('is-ready');
        });
        hintTimer = setTimeout(dismissHint, 6000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.Studio = {
        focusMonitor,
        unfocusMonitor,
        toggleTheme,
        isFocused: () => focused,
        state
    };
})();
