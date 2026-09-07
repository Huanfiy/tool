/* The desk spirit's speech bubble: one paper note in the UI layer that follows a
   projected 3D anchor. It accepts a promise so a slow provider can show "…" first. */
export function createSpiritBubble({ host, minDuration = 3400, perCharacter = 75, maxDuration = 8500, thinkingDelay = 160 }) {
    const element = document.createElement('div');
    element.className = 'spirit-bubble';
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.hidden = true;
    const text = document.createElement('p');
    element.append(text);
    host.append(element);
    let hideTimer = 0, thinkingTimer = 0, ticket = 0, open = false;

    function clearTimers() { clearTimeout(hideTimer); clearTimeout(thinkingTimer); }
    function present(content, thinking) {
        text.textContent = content;
        element.classList.toggle('thinking', thinking);
        element.hidden = false;
        open = true;
        // Restart the pop-in so a second poke visibly answers again.
        element.classList.remove('visible');
        void element.offsetWidth;
        element.classList.add('visible');
    }
    function hide() {
        clearTimers();
        open = false;
        element.classList.remove('visible', 'thinking');
        element.hidden = true;
    }
    /** Latest call wins; earlier pending replies are dropped when they resolve. */
    async function speak(reply) {
        const mine = ++ticket;
        clearTimers();
        thinkingTimer = setTimeout(() => { if (mine === ticket) present('…', true); }, thinkingDelay);
        let line = null;
        try { line = await reply; } catch { line = null; }
        if (mine !== ticket) return;
        clearTimeout(thinkingTimer);
        const content = (typeof line === 'string' ? line : line?.text)?.trim();
        if (!content) { hide(); return; }
        present(content, false);
        hideTimer = setTimeout(hide, Math.min(maxDuration, minDuration + content.length * perCharacter));
    }
    /** Screen-space anchor from the room's projection; `visible` is the anchor's own test. */
    function place({ x, y, visible }) {
        const shown = open && visible;
        element.style.visibility = shown ? '' : 'hidden';
        if (!shown) return;
        const half = element.offsetWidth / 2 + 10;
        const clamped = Math.max(half, Math.min(innerWidth - half, x));
        element.style.left = `${clamped}px`;
        element.style.top = `${Math.max(element.offsetHeight + 24, y)}px`;
        element.style.setProperty('--tail-x', `${Math.round(x - clamped)}px`);
    }
    return { element, speak, hide, place, isOpen: () => open, dispose() { hide(); element.remove(); } };
}
