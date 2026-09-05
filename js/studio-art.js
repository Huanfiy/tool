/* Small, local canvas paintings for the room. No image or font downloads. */
export function createStudioArt(canvasTexture) {
    let seed = 29;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    function grain(ctx, w, h, amount = 2200, opacity = .035) {
        for (let i = 0; i < amount; i++) {
            ctx.fillStyle = `rgba(88,72,47,${random() * opacity})`;
            ctx.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2);
        }
    }
    const paper = canvasTexture(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#f3ead6'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) {
            const x = random() * w, y = random() * h;
            const wash = ctx.createRadialGradient(x, y, 0, x, y, 100);
            wash.addColorStop(0, 'rgba(190,167,117,.025)'); wash.addColorStop(1, 'rgba(190,167,117,0)');
            ctx.fillStyle = wash; ctx.fillRect(0, 0, w, h);
        }
        grain(ctx, w, h, 9000, .08);
    });
    const wood = canvasTexture(1024, 512, (ctx, w, h) => {
        ctx.fillStyle = '#dab98c'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 180; i++) {
            const y = random() * h;
            ctx.strokeStyle = `rgba(120,83,43,${.025 + random() * .08})`; ctx.lineWidth = .4 + random() * 1.7;
            ctx.beginPath(); ctx.moveTo(0, y);
            ctx.bezierCurveTo(w * .3, y + Math.sin(i) * 12, w * .6, y - 6, w, y + 4); ctx.stroke();
        }
        for (const [x, y] of [[260, 140], [740, 365]]) {
            for (let r = 0; r < 5; r++) {
                ctx.strokeStyle = 'rgba(112,81,47,.08)'; ctx.beginPath();
                ctx.ellipse(x, y, 20 + r * 20, 2 + r * 3, 0, 0, Math.PI * 2); ctx.stroke();
            }
        }
        grain(ctx, w, h);
    });
    const floor = canvasTexture(1024, 1024, (ctx, w, h) => {
        ctx.fillStyle = '#d4b68d'; ctx.fillRect(0, 0, w, h);
        for (let row = 0; row < 8; row++) {
            const y = row * 128;
            ctx.fillStyle = ['#d9bd95', '#d6b98e', '#dec39e', '#d2b68e'][row % 4]; ctx.fillRect(0, y, w, 128);
            ctx.strokeStyle = 'rgba(101,84,59,.3)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, y + 1); ctx.lineTo(w, y + 1); ctx.stroke();
            const joint = (row % 3) * 280 + 140;
            ctx.beginPath(); ctx.moveTo(joint, y); ctx.lineTo(joint, y + 128); ctx.stroke();
            for (let j = 0; j < 22; j++) {
                const yy = y + random() * 128;
                ctx.strokeStyle = 'rgba(111,82,49,.075)'; ctx.lineWidth = .8;
                ctx.beginPath(); ctx.moveTo(0, yy); ctx.bezierCurveTo(340, yy - 3, 680, yy + 4, w, yy); ctx.stroke();
            }
        }
        grain(ctx, w, h, 14000, .045);
    });
    const cloth = canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#a7bba1'; ctx.fillRect(0, 0, w, h);
        ctx.lineWidth = 1;
        for (let i = 0; i < w; i += 4) {
            ctx.strokeStyle = i % 8 ? '#b0c1a854' : '#d8e1cc66';
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
            ctx.strokeStyle = '#506a4220'; ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
        }
        grain(ctx, w, h, 1200);
    });
    const rug = canvasTexture(1024, 640, (ctx, w, h) => {
        ctx.translate(w / 2, h / 2);
        ctx.beginPath(); ctx.ellipse(0, 0, 490, 294, -.015, 0, Math.PI * 2);
        ctx.fillStyle = '#a6b795'; ctx.fill(); ctx.strokeStyle = '#718061'; ctx.lineWidth = 3; ctx.stroke();
        ctx.save(); ctx.clip();
        for (let y = -300; y < 300; y += 4) {
            ctx.strokeStyle = y % 8 ? '#e1dec329' : '#687e5520'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-500, y); ctx.lineTo(500, y + 2); ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = '#e2dcc0'; ctx.lineWidth = 3; ctx.setLineDash([11, 8]);
        ctx.beginPath(); ctx.ellipse(0, 0, 465, 270, -.015, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#7c926c'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            const x = -60 + i * 58;
            ctx.beginPath(); ctx.moveTo(x, 204); ctx.quadraticCurveTo(x - 12, 175, x + 8, 148); ctx.stroke();
            for (const [dx, yy, a] of [[-10, 183, -.4], [8, 171, .5]]) {
                ctx.beginPath(); ctx.ellipse(x + dx, yy, 6, 12, a, 0, Math.PI * 2); ctx.stroke();
            }
        }
    });

    function drawLandscape(ctx, w, h, night = false) {
        seed = 91;
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, night ? '#354b6a' : '#b5d8db');
        sky.addColorStop(.7, night ? '#82969b' : '#e8edd3'); sky.addColorStop(1, night ? '#9baf9e' : '#f5edd2');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = night ? '#f6e9bd' : '#fff5d1'; ctx.beginPath(); ctx.arc(w * .72, h * .20, h * .066, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = night ? '#f5efd124' : '#ffffefb0';
        for (const [x, y, scale] of [[.22, .22, 1], [.79, .37, .7], [.45, .1, .55]]) {
            ctx.beginPath(); ctx.ellipse(w * x, h * y, w * .10 * scale, h * .032 * scale, -.05, 0, Math.PI * 2); ctx.fill();
        }
        for (let layer = 0; layer < 4; layer++) {
            ctx.fillStyle = (night ? ['#81958d', '#627f7a', '#516f65', '#3c5c55'] : ['#bbcda8', '#a2bd91', '#8cac79', '#759461'])[layer];
            const y = h * (.53 + layer * .11);
            ctx.beginPath(); ctx.moveTo(0, y);
            ctx.bezierCurveTo(w * .25, y - h * .16, w * .43, y + h * .11, w * .65, y - h * .03);
            ctx.bezierCurveTo(w * .84, y - h * .14, w * .96, y - h * .09, w, y - h * .07);
            ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
        }
        // Irregular overlapping washes, with visible branches and small leaf marks.
        for (const [x, y, size] of [[.13, .67, .31], [.91, .72, .24], [.04, .92, .26], [.80, .96, .16]]) {
            const xx = x * w, yy = y * h, r = size * h;
            ctx.strokeStyle = night ? '#405652' : '#777450'; ctx.lineWidth = r * .08; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(xx, yy + r * .9); ctx.quadraticCurveTo(xx - r * .15, yy, xx + r * .08, yy - r * .7); ctx.stroke();
            for (let branch = 0; branch < 4; branch++) {
                const bx = xx + (branch % 2 ? -1 : 1) * r * .5, by = yy - branch * r * .16;
                ctx.lineWidth = r * .035; ctx.beginPath(); ctx.moveTo(xx, yy + r * .3); ctx.lineTo(bx, by); ctx.stroke();
            }
            for (let i = 0; i < 13; i++) {
                const a = i * 2.4, distance = r * (.15 + random() * .45);
                ctx.fillStyle = (night ? ['#45665b', '#567769', '#638172'] : ['#799d66', '#8fae74', '#9db780', '#b0c58d'])[i % (night ? 3 : 4)];
                ctx.beginPath(); ctx.ellipse(xx + Math.cos(a) * distance, yy - r * .3 + Math.sin(a) * distance, r * (.30 + random() * .15), r * (.35 + random() * .16), a, 0, Math.PI * 2); ctx.fill();
            }
            ctx.strokeStyle = night ? '#b3c39c35' : '#526e4250'; ctx.lineWidth = 1.4;
            for (let i = 0; i < 24; i++) {
                const lx = xx + (random() - .5) * r * 1.2, ly = yy - r * .3 + (random() - .5) * r * 1.2;
                ctx.beginPath(); ctx.moveTo(lx, ly); ctx.quadraticCurveTo(lx + 5, ly - 6, lx + 9, ly - 3); ctx.stroke();
            }
        }
        if (night) {
            ctx.fillStyle = '#fff3cb';
            for (let i = 0; i < 26; i++) { ctx.globalAlpha = .25 + random() * .6; ctx.fillRect(random() * w, random() * h * .45, 1.5, 1.5); }
            ctx.globalAlpha = 1;
        } else {
            ctx.strokeStyle = '#667e6e'; ctx.lineWidth = 1.7;
            for (const x of [.48, .52, .57]) { ctx.beginPath(); ctx.moveTo(w * x - 6, h * .3); ctx.quadraticCurveTo(w * x, h * .3 - 5, w * x + 4, h * .3 + 1); ctx.quadraticCurveTo(w * x + 8, h * .3 - 4, w * x + 12, h * .3 - 1); ctx.stroke(); }
        }
        grain(ctx, w, h, 5500, .05);
    }
    const landscape = canvasTexture(1024, 640, (ctx, w, h) => drawLandscape(ctx, w, h));
    const sunlight = canvasTexture(512, 512, (ctx, w, h) => {
        const glow = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 2);
        glow.addColorStop(0, '#fff2c080'); glow.addColorStop(.65, '#fff0bd48'); glow.addColorStop(1, '#fff2c000');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 12; ctx.strokeStyle = '#0008';
        ctx.beginPath(); ctx.moveTo(w * .48, 0); ctx.lineTo(w * .48, h); ctx.moveTo(0, h * .46); ctx.lineTo(w, h * .46); ctx.stroke();
        for (let i = 0; i < 50; i++) {
            ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(random() * w, random() * h, 6 + random() * 12, 3 + random() * 7, random() * 6, 0, Math.PI * 2); ctx.fill();
        }
    });
    return { paper, wood, floor, cloth, rug, landscape, sunlight, drawLandscape };
}
