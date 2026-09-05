/* Huanfly Lab: device controls, camera navigation and the HTML computer. */
const $ = id => document.getElementById(id);
const root = $('studio');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {
    printer: 'idle', printProgress: 0, iron: false, fan: false,
    scope: 'sine', scopeRunning: true, frequency: 2.0,
    firmware: 'idle', flashProgress: 0, boardExploded: false,
    motor: false, rpm: 2400, arm: false, armStarted: false,
    breeze: true, soilMoisture: 42, watering: false, waterProgress: 0
};
const devices = {
    monitor: { n: '01', label: '工作站', title: '思考的主屏幕', category: 'WORKSTATION / HUANFLY-OS', description: '写代码，也收集灵感。直接点击屏幕上的终端、相册或 AI 助手；靠近时，仍然是同一块屏幕。' },
    pcb: { n: '02', label: '开发板', title: '从一行代码开始', category: 'DEVELOPMENT / STM32 H743', description: '给开发板烧录一份固件，观察状态灯和板载 OLED 的反馈。展开电路板，看看芯片、排针与 PCB 的层次。' },
    scope: { n: '03', label: '示波器', title: '让信号有迹可循', category: 'MEASUREMENT / DIGITAL OSCILLOSCOPE', description: '正弦波、方波、锯齿波。在屏幕上观察信号，调节频率，或者暂停捕获这一瞬间。' },
    solder: { n: '04', label: '焊接台', title: '把想法焊在一起', category: 'REWORK / T12 SOLDERING STATION', description: '打开焊台，烙铁进入工作状态，排烟风扇随之启动。工作结束后，记得让它休息。' },
    printer: { n: '05', label: '3D 打印', title: '一层一层，成为实物', category: 'FABRICATION / FDM PRINTER', description: '从空白热床开始，打印一个六角原型外壳。看喷头沿导轨移动，零件逐层长出来。' },
    motor: { n: '06', label: '电机测试', title: '让代码转起来', category: 'MOTION / BRUSHLESS MOTOR', description: '启动无刷电机测试台，调节目标转速。转子平滑加速，转速读数同步更新。' },
    arm: { n: '07', label: '机械臂', title: '重复的事，交给机械', category: 'ROBOTICS / PICK & PLACE', description: '让机械臂执行一轮又一轮的取放装配。底座、肩部、肘部与夹爪协同完成运动。' },
    plant: { n: '08', label: '绿植与传感器', title: '也照顾一下小小的绿意', category: 'LITTLE GARDEN / SOIL SENSOR', description: '给桌边绿植浇一点水，观察模拟土壤湿度的变化。开发板烧录完成后，OLED 也会显示它的读数。' }
};
const views = { overview: '窗边工作室', bench: '木头工作桌', fabrication: '打印角', robotics: '窗边的小实验', panorama: '房间全景' };
let room = null, selected = null, focused = false, night = false, labelsVisible = false;
let tourIndex = -1, returnFocus = null, booted = false;
let currentRPM = 0, armPhase = 0;
const tour = ['pcb', 'scope', 'solder', 'printer', 'motor', 'arm', 'plant', 'monitor'];
const markerEls = new Map();
function setText(el, value) { if (el.textContent !== String(value)) el.textContent = value; }
function announce(message) { setText($('lab-log-text'), message); setText($('lab-announcement'), message); }
function updateClock() {
    const t = new Date();
    $('lab-clock').textContent = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}
updateClock(); setInterval(updateClock, 15000);

function updatePanel() {
    if (!selected) return;
    let status = '', value = '', action = '', secondary = '', progress = null;
    switch (selected) {
        case 'monitor': status = '工作站已就绪'; value = 'ONLINE'; action = '靠近屏幕 ↗'; break;
        case 'pcb':
            status = state.firmware === 'flashing' ? '正在写入固件' : state.firmware === 'done' ? '固件运行中' : 'ST-LINK 已连接';
            value = state.firmware === 'flashing' ? `${Math.round(state.flashProgress)}%` : '480 MHz';
            action = state.firmware === 'flashing' ? '烧录中…' : state.firmware === 'done' ? '重新烧录固件 ↻' : '烧录固件 →';
            secondary = state.boardExploded ? '合上电路板' : '展开电路板';
            if (state.firmware === 'flashing') progress = state.flashProgress;
            break;
        case 'scope':
            status = state.scopeRunning ? '信号采集中' : '采集已暂停';
            value = { sine: 'SINE', square: 'PWM', saw: 'SAW' }[state.scope];
            action = '切换信号波形 ↻'; secondary = state.scopeRunning ? '暂停采集' : '继续采集'; break;
        case 'solder': status = state.iron ? '加热中 · 排烟已开启' : '焊台待机'; value = state.iron ? '350 °C' : 'OFF'; action = state.iron ? '关闭焊台' : '开启焊台 →'; break;
        case 'printer':
            status = { idle: '热床已就绪', printing: '正在逐层打印', paused: '打印已暂停', done: '原型打印完成' }[state.printer];
            value = `${Math.round(state.printProgress)}%`;
            action = { idle: '开始打印 →', printing: '暂停打印', paused: '继续打印 →', done: '打印新零件 ↻' }[state.printer];
            secondary = state.printProgress > 0 ? '重置' : ''; progress = state.printProgress; break;
        case 'motor': status = state.motor ? '电机运行中' : currentRPM > 10 ? '转子减速中' : '测试台待机'; value = `${currentRPM} RPM`; action = state.motor ? '停止电机' : '启动电机 →'; break;
        case 'arm': status = state.arm ? '取放装配循环中' : state.armStarted ? '装配已暂停' : '机械臂待机'; value = state.armStarted ? `CYCLE ${armPhase}%` : 'READY'; action = state.arm ? '暂停装配' : state.armStarted ? '继续装配 →' : '运行取放装配 →'; break;
        case 'plant':
            status = state.watering ? '水慢慢渗进土壤' : state.soilMoisture >= 70 ? '水分充足，慢慢生长' : '土壤有些干了';
            value = `${Math.round(state.soilMoisture)}%`; action = state.watering ? '正在浇水…' : state.soilMoisture >= 70 ? '已经喝饱了 ✓' : '浇一点水 ↗';
            secondary = state.soilMoisture >= 70 ? '重置实验' : ''; break;
    }
    setText($('device-status'), status); setText($('device-value'), value); setText($('device-action'), action);
    $('device-action').disabled = (selected === 'pcb' && state.firmware === 'flashing') || (selected === 'plant' && (state.watering || state.soilMoisture >= 70));
    $('device-secondary').hidden = !secondary; setText($('device-secondary'), secondary);
    $('device-progress').hidden = progress === null;
    if (progress !== null) $('device-progress-bar').style.width = `${progress}%`;
    const output = $('device-range-value');
    if (output) setText(output, selected === 'scope' ? `${state.frequency.toFixed(1)} kHz` : `${state.rpm} RPM`);
}
function buildOptions(id) {
    $('device-options').replaceChildren();
    if (id !== 'scope' && id !== 'motor') return;
    const label = document.createElement('label'); label.htmlFor = 'device-range';
    label.textContent = id === 'scope' ? '信号频率' : '目标转速';
    const output = document.createElement('output'); output.id = 'device-range-value'; output.htmlFor = 'device-range'; label.append(output);
    const range = document.createElement('input'); range.type = 'range'; range.id = 'device-range';
    range.min = id === 'scope' ? '.5' : '300'; range.max = id === 'scope' ? '5' : '6000'; range.step = id === 'scope' ? '.1' : '100';
    range.value = id === 'scope' ? state.frequency : state.rpm;
    range.addEventListener('input', () => { if (id === 'scope') state.frequency = Number(range.value); else state.rpm = Number(range.value); updatePanel(); });
    range.addEventListener('change', () => announce(id === 'scope' ? `信号频率设为 ${state.frequency.toFixed(1)} kHz。` : `目标转速设为 ${state.rpm} RPM。`));
    $('device-options').append(label, range);
}
function selectDevice(id, fromTour = false) {
    if (id === 'window') { toggleWindow(); return; }
    if (!room || !devices[id]) return;
    if (id === 'monitor') { focusMonitor(); return; }
    leaveMonitorView();
    if (!fromTour) tourIndex = -1;
    closeDeviceList();
    selected = id;
    const device = devices[id];
    setText($('device-number'), `工作室笔记 · ${device.n}`); setText($('device-category'), device.category);
    setText($('device-title'), device.title); setText($('device-description'), device.description);
    setText($('device-index'), `${device.n} / ${String(Object.keys(devices).length).padStart(2, '0')}`);
    $('lab-inspector').hidden = false; root.classList.add('has-selection');
    root.classList.remove('is-close-view');
    $('lab-intro').inert = true;
    buildOptions(id); updatePanel();
    $('tour-navigation').hidden = tourIndex < 0;
    if (tourIndex >= 0) { setText($('tour-step'), `探索 ${tourIndex + 1} / ${tour.length}`); setText($('tour-next'), tourIndex === tour.length - 1 ? '完成探索 ✓' : '下一站 →'); }
    markerEls.forEach((el, key) => { el.classList.toggle('selected', key === id); el.setAttribute('aria-pressed', String(key === id)); });
    room.select(id); setText($('lab-view-name'), device.label);
    document.querySelectorAll('[data-view]').forEach(btn => { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); });
    announce(`已靠近${device.label}。${device.description}`);
}
function closePanel(reset = true) {
    const hadFocus = $('lab-inspector').contains(document.activeElement);
    selected = null; tourIndex = -1; $('lab-inspector').hidden = true; root.classList.remove('has-selection'); $('lab-intro').inert = false;
    markerEls.forEach(el => { el.classList.remove('selected'); el.setAttribute('aria-pressed', 'false'); });
    if (reset) setView('overview');
    if (hadFocus) document.querySelector('[data-view="overview"]').focus({ preventScroll: true });
}
function setView(name) {
    if (!room) return;
    leaveMonitorView();
    closeDeviceList();
    closePanel(false); room.setView(name);
    root.classList.toggle('is-close-view', name !== 'overview');
    $('lab-intro').inert = name !== 'overview';
    document.querySelectorAll('[data-view]').forEach(btn => { const active = btn.dataset.view === name; btn.classList.toggle('active', active); btn.setAttribute('aria-pressed', String(active)); });
    setText($('lab-view-name'), views[name]);
}
function act(id = selected, secondary = false) {
    if (!room) return false;
    if (id === 'iron' || id === 'fan' || id === 'gun') id = 'solder';
    if (id === 'window') { toggleWindow(); return true; }
    switch (id) {
        case 'monitor': focusMonitor(); break;
        case 'pcb':
            if (secondary) { state.boardExploded = !state.boardExploded; announce(state.boardExploded ? '电路板已展开：PCB、芯片与连接器。' : '电路板已合上。'); }
            else if (state.firmware !== 'flashing') { state.firmware = 'flashing'; state.flashProgress = 0; announce('ST-LINK 已连接，开始写入固件。'); }
            break;
        case 'scope':
            if (secondary) { state.scopeRunning = !state.scopeRunning; announce(state.scopeRunning ? '示波器继续采集信号。' : '示波器已暂停采集。'); }
            else { const waves = ['sine', 'square', 'saw']; state.scope = waves[(waves.indexOf(state.scope) + 1) % waves.length]; announce(`信号已切换为${{ sine: '正弦波', square: '方波', saw: '锯齿波' }[state.scope]}。`); }
            break;
        case 'solder': state.iron = !state.iron; state.fan = state.iron; announce(state.iron ? '焊台已开启 · 350 °C · 排烟风扇运行。' : '焊台与排烟风扇已关闭。'); break;
        case 'printer':
            if (secondary) { state.printer = 'idle'; state.printProgress = 0; announce('热床已清空，可以开始新的打印。'); }
            else if (state.printer === 'printing') { state.printer = 'paused'; announce('打印已暂停。'); }
            else { if (state.printer === 'done') state.printProgress = 0; state.printer = 'printing'; announce('FDM 打印已开始，正在制造六角外壳。'); }
            break;
        case 'motor': state.motor = !state.motor; announce(state.motor ? `电机已启动，目标 ${state.rpm} RPM。` : '电机正在平滑减速。'); break;
        case 'arm': state.arm = !state.arm; state.armStarted = true; announce(state.arm ? '机械臂开始执行取放装配循环。' : '机械臂已暂停。'); break;
        case 'plant':
            if (secondary && !state.watering) { state.soilMoisture = 42; state.waterProgress = 0; announce('传感器实验已重置，可以重新观察浇水后的变化。'); }
            else if (!state.watering && state.soilMoisture < 70) { state.watering = true; state.waterProgress = 0; announce('给小植物浇一点水，留意旁边的湿度读数。'); }
            break;
        default: return false;
    }
    updatePanel(); return true;
}
function toggleTheme() {
    night = !night; document.documentElement.setAttribute('data-theme', night ? 'dark' : 'light');
    room?.setNight(night);
    document.querySelector('meta[name="theme-color"]').content = night ? '#344840' : '#eee5d2';
    $('lab-theme').setAttribute('aria-label', night ? '切换日间灯光' : '切换夜间灯光'); $('lab-theme').title = $('lab-theme').getAttribute('aria-label');
    announce(night ? '窗外入夜了，架子下的暖光亮了起来。' : '午后的阳光，又照进了房间。');
}
function toggleLabels() {
    labelsVisible = !labelsVisible; $('lab-labels').setAttribute('aria-pressed', String(labelsVisible));
}
function closeDeviceList() { $('lab-device-list').hidden = true; $('lab-devices').setAttribute('aria-expanded', 'false'); }

// Moving closer never replaces the desktop or interrupts a running application.
function focusMonitor() {
    if (focused) return;
    returnFocus = document.activeElement; focused = true;
    closeDeviceList(); closePanel(false);
    root.classList.add('is-at-monitor');
    $('lab-intro').inert = true;
    $('mf-exit').hidden = false; $('studio-enter').hidden = true;
    if (room) {
        room.focusMonitor();
        setText($('lab-view-name'), '屏幕前');
        document.querySelectorAll('[data-view]').forEach(btn => { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); });
        announce('可以直接操作屏幕。点击「退后看看」或拖动屏幕外的空白处环视。');
    } else {
        root.classList.add('is-computer-fallback');
        $('monitor-focus').inert = false;
        $('monitor-focus').setAttribute('role', 'dialog');
        $('monitor-focus').setAttribute('aria-modal', 'true');
        $('lab-ui').inert = true;
        $('mf-screen').focus({ preventScroll: true });
    }
    if (!window.StudioOS?.isAwake()) window.StudioOS?.wake();
}
function leaveMonitorView() {
    focused = false;
    root.classList.remove('is-at-monitor', 'is-computer-fallback');
    $('mf-exit').hidden = true; $('studio-enter').hidden = false;
    $('lab-ui').inert = false; $('lab-intro').inert = false;
    $('monitor-focus').setAttribute('role', 'region');
    $('monitor-focus').removeAttribute('aria-modal');
}
function unfocusMonitor() {
    if (!focused) return;
    leaveMonitorView();
    if (room) setView('overview');
    else $('monitor-focus').inert = true;
    if (returnFocus?.isConnected && !returnFocus.closest('[hidden]') && !returnFocus.closest('#monitor-focus') && returnFocus !== document.body) returnFocus.focus({ preventScroll: true });
    else $('studio-enter').focus({ preventScroll: true });
}
function toggleWindow() {
    if (!room) return;
    state.breeze = !state.breeze; $('lab-breeze').setAttribute('aria-pressed', String(state.breeze));
    $('lab-breeze').setAttribute('aria-label', state.breeze ? '关上窗，暂停微风' : '打开窗，让微风进来');
    $('lab-breeze').querySelector('span').textContent = state.breeze ? '微风入室' : '窗已关上';
    announce(state.breeze ? '窗扇向外打开，让森林里的微风进来。' : '窗扇已合上，窗外的风景还在。');
}
window.Studio = { focusMonitor, unfocusMonitor, toggleTheme, isFocused: () => focused, state, action: act, select: selectDevice, setView, getStats: () => room?.getStats() };
$('studio-enter').addEventListener('click', focusMonitor);
$('mf-exit').addEventListener('click', unfocusMonitor);
$('device-close').addEventListener('click', () => closePanel());
$('device-action').addEventListener('click', () => act()); $('device-secondary').addEventListener('click', () => act(selected, true));
$('lab-theme').addEventListener('click', toggleTheme); $('lab-labels').addEventListener('click', toggleLabels);
$('lab-breeze').addEventListener('click', toggleWindow);
$('lab-devices').addEventListener('click', () => { const open = $('lab-device-list').hidden; $('lab-device-list').hidden = !open; $('lab-devices').setAttribute('aria-expanded', String(open)); });
document.addEventListener('pointerdown', e => { if (!e.target.closest('#lab-device-list, #lab-devices')) closeDeviceList(); });
document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
$('lab-tour').addEventListener('click', () => { tourIndex = 0; selectDevice(tour[0], true); });
$('tour-next').addEventListener('click', () => { tourIndex++; if (tourIndex >= tour.length) { closePanel(); announce('探索完成。现在，试着把几台设备一起运行起来。'); } else selectDevice(tour[tourIndex], true); });
$('loader-retry').addEventListener('click', () => location.reload());
const full = $('lab-fullscreen'); full.hidden = !document.fullscreenEnabled;
full.addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { announce('浏览器暂时无法进入全屏，可继续在当前窗口探索。'); }
});
document.addEventListener('fullscreenchange', () => { const active = !!document.fullscreenElement; full.setAttribute('aria-label', active ? '退出全屏' : '进入全屏'); full.title = full.getAttribute('aria-label'); });
document.addEventListener('keydown', e => {
    if (e.key === 'Tab' && root.classList.contains('is-computer-fallback')) {
        const controls = [...$('monitor-focus').querySelectorAll('button,input,textarea,select,a[href],summary,[tabindex="0"]'), $('mf-exit')].filter(el => !el.disabled && !el.closest('[inert]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
        if (!controls.length) { e.preventDefault(); return; }
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { e.preventDefault(); first.focus(); }
        return;
    }
    if (e.key === 'Escape') {
        if (!$('lab-device-list').hidden) { closeDeviceList(); $('lab-devices').focus(); return; }
        if (focused || $('monitor-focus').contains(document.activeElement)) { if (!window.StudioOS?.handleEscape()) { if (focused) unfocusMonitor(); else document.activeElement.blur(); } }
        else if (selected) closePanel();
    }
    if (e.defaultPrevented || $('monitor-focus').contains(document.activeElement) || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    const view = { '1': 'overview', '2': 'bench', '3': 'fabrication', '4': 'robotics' }[e.key];
    if (view) setView(view);
});
if (matchMedia('(pointer: coarse)').matches) $('lab-gesture').innerHTML = '拖动环视 <span>·</span> 双指缩放 <span>·</span> 轻点设备';
function showError(message) {
    booted = false; clearTimeout(loadingMessage);
    const wasFocused = focused;
    room?.dispose(); room = null; leaveMonitorView();
    if (wasFocused) focusMonitor();
    const loader = $('lab-loader'); loader.classList.remove('ready'); loader.classList.add('error');
    $('loader-title').textContent = '工作室暂时未能启动'; $('loader-detail').textContent = message || '请检查网络与浏览器的图形支持。仍可从右上角打开桌面。'; $('loader-retry').hidden = false;
    document.querySelectorAll('[data-needs-room]').forEach(el => { el.disabled = true; });
    $('studio-enter').innerHTML = '<span>↗</span> 打开桌面';
    announce('3D 场景未能启动，仍可从右上角打开桌面。');
}
const loadingMessage = setTimeout(() => { if (!booted) $('loader-detail').textContent = '首次加载需要连接场景资源，请稍候。也可以先从右上角打开桌面。'; }, 12000);
try {
    const { createStudioRoom } = await import('./studio-room.js');
    for (const [id, device] of Object.entries(devices)) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'lab-marker'; button.dataset.device = id;
        button.setAttribute('aria-label', `查看${device.label}并控制设备`); button.setAttribute('aria-pressed', 'false');
        button.innerHTML = `<span class="marker-dot" aria-hidden="true">·</span><span class="marker-label">${device.label}</span>`;
        button.addEventListener('click', () => selectDevice(id)); $('lab-markers').append(button); markerEls.set(id, button);
        button.addEventListener('pointerenter', () => room?.setHovered(id)); button.addEventListener('pointerleave', () => room?.setHovered(null));
        const picker = document.createElement('button'); picker.type = 'button'; picker.dataset.pick = id;
        picker.innerHTML = `<span>${device.n}</span>${device.label} ↗`; picker.addEventListener('click', () => selectDevice(id)); $('lab-device-list').append(picker);
    }
    room = createStudioRoom({ container: $('studio-stage'), state, reducedMotion, onSelect: selectDevice, onEvent: announce, onError: showError, onWindowToggle: toggleWindow,
        onReady: () => {
            booted = true; clearTimeout(loadingMessage);
            document.querySelectorAll('[data-needs-room]').forEach(el => { el.disabled = false; });
            $('lab-loader').classList.add('ready');
        },
        onFrame: ({ markers, rpm, armPhase: phase, update }) => {
            currentRPM = rpm; armPhase = phase;
            const compact = innerWidth <= 700;
            const occupied = [];
            const panelTop = compact && selected ? $('lab-inspector').offsetTop : Infinity;
            const widths = new Map([...markerEls].map(([id, el]) => [id, el.offsetWidth]));
            for (const marker of markers) {
                const el = markerEls.get(marker.id);
                let visible = marker.visible && !focused && (labelsVisible || marker.hovered || marker.id === selected);
                if (selected) visible = visible && marker.id === selected;
                if (!selected && compact && room?.getView() === 'overview' && ['solder', 'scope'].includes(marker.id)) visible = false;
                // Prevent labels from covering the mobile header, intro or device controls.
                if (compact && marker.y < (selected || room?.getView() !== 'overview' ? 75 : 212)) visible = false;
                if (compact && selected && marker.y > panelTop - 26) visible = false;
                el.classList.toggle('visible', visible); el.tabIndex = visible ? 0 : -1; el.setAttribute('aria-hidden', String(!visible));
                if (!visible) continue;
                const half = widths.get(marker.id) / 2;
                let x = Math.max(half + 10, Math.min(innerWidth - half - 10, marker.x)), y = marker.y;
                // Keep every visible control clickable when device labels approach each other.
                for (const [dx, dy] of [[0, 0], [0, -35], [0, 35], [-48, 0], [48, 0], [-48, -35], [48, 35]]) {
                    const cx = Math.max(half + 10, Math.min(innerWidth - half - 10, marker.x + dx)), cy = marker.y + dy;
                    if (occupied.every(r => cx + half < r.left || cx - half > r.right || cy + 17 < r.top || cy - 17 > r.bottom)) { x = cx; y = cy; break; }
                }
                occupied.push({ left: x - half - 3, right: x + half + 3, top: y - 17, bottom: y + 17 });
                el.style.left = `${x}px`; el.style.top = `${y}px`;
            }
            if (update) updatePanel();
        }
    });
    room.setNight(night);
    root.classList.remove('is-computer-fallback'); $('lab-ui').inert = false;
    $('monitor-focus').setAttribute('role', 'region'); $('monitor-focus').removeAttribute('aria-modal');
    if (focused) room.focusMonitor();
    if (!window.StudioOS?.isAwake()) window.StudioOS?.wake();
} catch (error) {
    clearTimeout(loadingMessage); console.error('Studio scene failed to start:', error);
    room?.dispose(); room = null; showError('场景资源未能加载，或浏览器未开启 WebGL。请重试，也可直接打开桌面。');
}
