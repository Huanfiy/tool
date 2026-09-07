/* Deterministic, world-oriented countryside painting. No scene or animation loop. */
export function landscapeRandom(seed = 741) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

export function createLandscapeArt(width, height) {
    const canvas = document.createElement('canvas'), layer = document.createElement('canvas');
    canvas.width = layer.width = width;
    canvas.height = layer.height = height;
    const ctx = canvas.getContext('2d'), ink = layer.getContext('2d');
    if (!ctx || !ink) throw new Error('Landscape canvas is unavailable');

    function draw(palette, layout) {
        const { paper, sky, haze, hills, night } = palette;
        const w = width, h = height, horizon = layout.background.horizonUV * h;
        const random = landscapeRandom();
        ctx.fillStyle = paper; ctx.fillRect(0, 0, w, h);
        ink.clearRect(0, 0, w, h);
        // Sphere longitude .5 faces -X; image y=.5 is world elevation zero.
        // Unlike the former window-height UV, these angles do not depend on a camera.
        const wash = ink.createLinearGradient(0, h * .10, 0, horizon);
        wash.addColorStop(0, sky); wash.addColorStop(.72, haze); wash.addColorStop(1, paper);
        ink.fillStyle = wash; ink.fillRect(0, 0, w, horizon);
        const [sx, sy, sz] = layout.sunDirection;
        const sunX = w * (.5 + Math.atan2(sz, -sx) / (Math.PI * 2));
        const sunY = horizon - h * Math.atan2(sy, Math.hypot(sx, sz)) / Math.PI;
        const halo = ink.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * .065);
        halo.addColorStop(0, night ? '#f1e2b451' : '#fff0b58a');
        halo.addColorStop(1, '#fff0b500');
        ink.fillStyle = halo; ink.fillRect(sunX - h * .07, sunY - h * .07, h * .14, h * .14);
        ink.fillStyle = night ? '#e5e8d0' : '#ffedb2';
        ink.beginPath(); ink.arc(sunX, sunY, h * .015, 0, Math.PI * 2); ink.fill();
        if (night) {
            ink.fillStyle = sky;
            ink.beginPath(); ink.arc(sunX + h * .008, sunY - h * .005, h * .014, 0, Math.PI * 2); ink.fill();
            ink.fillStyle = '#d8e2cb';
            for (let i = 0; i < 46; i++) {
                const x = w * (.27 + random() * .46), y = h * (.16 + random() * .26);
                ink.globalAlpha = .25 + random() * .40;
                ink.beginPath(); ink.arc(x, y, Math.max(.55, w / 2300), 0, Math.PI * 2); ink.fill();
            }
            ink.globalAlpha = 1;
        }
        // Low fields occupy only the outward-facing horizon, not a 360° colour band.
        for (let row = 0; row < 3; row++) {
            ink.fillStyle = hills[row];
            ink.beginPath(); ink.moveTo(w * .22, horizon);
            for (let i = 0; i <= 140; i++) {
                const u = .22 + i / 140 * .56;
                const envelope = Math.sin((u - .22) / .56 * Math.PI);
                const rise = (.018 + .016 * Math.sin(u * 31 + row * 1.8) + (2 - row) * .015) * envelope;
                ink.lineTo(w * u, horizon - h * Math.max(.001, rise));
            }
            ink.lineTo(w * .78, horizon); ink.closePath(); ink.fill();
        }
        // Orchard silhouettes, fine field rows and a tiny distant cottage.
        for (let i = 0; i < 32; i++) {
            const u = .34 + random() * .34, x = w * u;
            const y = horizon - h * (.008 + random() * .010), s = h * (.002 + random() * .003);
            ink.fillStyle = hills[2];
            ink.fillRect(x - s * .12, y, s * .24, s * 1.6);
            ink.beginPath(); ink.ellipse(x, y - s * .6, s, s * 1.4, 0, 0, Math.PI * 2); ink.fill();
        }
        // Longitude .485 (almost straight out from the window wall) keeps the cottage
        // clear of the overview frame's left edge and header.
        const x = w * .485, y = horizon - h * .009, cw = w * .013, ch = h * .015;
        ink.fillStyle = night ? '#6b7064' : '#d9ba87'; ink.fillRect(x, y - ch, cw, ch);
        ink.fillStyle = night ? '#525c60' : '#a88165';
        ink.beginPath(); ink.moveTo(x - cw * .15, y - ch); ink.lineTo(x + cw * .5, y - ch * 1.65); ink.lineTo(x + cw * 1.15, y - ch); ink.fill();
        ink.fillStyle = night ? '#dac68b' : '#eee3b5'; ink.fillRect(x + cw * .58, y - ch * .69, cw * .19, ch * .34);
        ink.strokeStyle = night ? '#a4b89a22' : '#ebdfae55'; ink.lineWidth = Math.max(.7, w / 1700);
        for (let i = 0; i < 4; i++) {
            ink.beginPath(); ink.moveTo(w * .36, horizon - h * (.002 + i * .002));
            ink.quadraticCurveTo(w * .53, horizon - h * (.008 + i * .002), w * .68, horizon - h * .003); ink.stroke();
        }
        // Wide longitude and elevation feathering. The seam, poles and lower
        // hemisphere are exactly paper, so the finite ground cannot expose a rim.
        ink.globalCompositeOperation = 'destination-in';
        const horizontal = ink.createLinearGradient(0, 0, w, 0);
        for (const [at, alpha] of [[0, 0], [.31, 0], [.44, 1], [.58, 1], [.70, 0], [1, 0]]) horizontal.addColorStop(at, `rgba(0,0,0,${alpha})`);
        ink.fillStyle = horizontal; ink.fillRect(0, 0, w, h);
        const vertical = ink.createLinearGradient(0, 0, 0, h);
        for (const [at, alpha] of [[0, 0], [.07, 0], [.22, .8], [.40, 1], [.494, 1], [.5, 0], [1, 0]]) vertical.addColorStop(at, `rgba(0,0,0,${alpha})`);
        ink.fillStyle = vertical; ink.fillRect(0, 0, w, h);
        ink.globalCompositeOperation = 'source-over';
        ctx.drawImage(layer, 0, 0);
    }
    return { canvas, draw };
}
