/* A palm-sized desk spirit, facing +z. Built from the room's primitives but kept out of
   the static batch so it can breathe, blink, follow the camera and hop when poked. */
import * as THREE from 'three';

export function createStudioSpirit({ parent, sphere, bar, group, material, paintedLeaf, glow, leafMaterials, reducedMotion, random = Math.random }) {
    const root = group(parent);
    root.name = 'desk-spirit';
    // Picked through the same parent walk as the instruments; the room keeps it out of
    // the device map, so it answers with a bubble instead of the inspector.
    root.userData.device = 'spirit';
    const shades = { body: '#a9d6c9', cream: '#f4eddb', ink: '#30333c', blush: '#dba28e' };
    const m = Object.fromEntries(Object.entries(shades).map(([key, color]) => [key, material(`spirit-${key}`, { color, roughness: .82 })]));
    const mote = material('spirit-mote', { color: '#dbf6e8', emissive: '#8fd6bd', emissiveIntensity: .9, roughness: .5 });

    function oval(target, size, at, mat) {
        const item = sphere(target, 1, ...at, mat);
        item.scale.set(...size);
        return item;
    }

    // body: bob, breath and squash; head: tilt and a gentle turn towards the camera.
    const body = group(root);
    oval(body, [.105, .115, .095], [0, .125, 0], m.body);
    oval(body, [.062, .072, .034], [0, .112, .078], m.cream);
    for (const side of [-1, 1]) {
        oval(body, [.028, .048, .028], [side * .118, .128, .028], m.body).rotation.z = -side * .55;
        oval(body, [.040, .020, .050], [side * .052, .020, .032], m.cream);
    }
    const head = group(body, 0, .335, 0);
    oval(head, [.135, .125, .125], [0, 0, 0], m.body);
    const eyes = [];
    for (const side of [-1, 1]) {
        eyes.push(oval(head, [.016, .023, .008], [side * .048, .012, .118], m.ink));
        // Both catchlights sit towards the same upper-left, as if lit by the window.
        oval(head, [.0055, .0065, .004], [side * .048 - .005, .019, .1245], m.cream);
        oval(head, [.015, .0085, .005], [side * .076, -.018, .103], m.blush);
        bar(head, [side * .013, -.022, .123], [0, -.029, .124], .0025, m.ink);
    }
    bar(head, [0, .118, -.005], [.012, .165, -.002], .006, leafMaterials.dark);
    const leafA = paintedLeaf(head, .052, .085, -.024, .186, -.003, leafMaterials.light);
    leafA.rotation.set(-.35, 0, .85);
    const leafB = paintedLeaf(head, .046, .075, .036, .191, -.001, leafMaterials.dark);
    leafB.rotation.set(-.3, 0, -.65);
    // A soft aura and three slow motes read as the room's "灵气" without any post pass.
    const aura = glow(body, 0, .30, -.06, .58, '#a8e6cf');
    aura.material.opacity = .5;
    const motes = [0, 1, 2].map(() => sphere(body, .011, 0, .34, 0, mote));
    for (const item of motes) item.castShadow = false;

    let time = random() * 10, blink = 0, nextBlink = 2 + random() * 3, reaction = 0, hoverAmount = 0, hovered = false, night = false;
    const lookLocal = new THREE.Vector3();
    const anchor = new THREE.Vector3();

    function placeMotes(phase, spread) {
        for (let i = 0; i < motes.length; i++) {
            const angle = phase + i * Math.PI * 2 / 3, radius = .185 + spread;
            motes[i].position.set(Math.cos(angle) * radius, .34 + Math.sin(angle * 1.7 + i) * .035 + spread * .6, Math.sin(angle) * radius * .8);
        }
    }
    placeMotes(0, 0);

    function update(dt, cameraPosition) {
        if (reaction > 0) reaction = Math.max(0, reaction - dt / .95);
        const progress = 1 - reaction, active = reaction > 0, motion = reducedMotion ? 0 : 1;
        hoverAmount = reducedMotion ? (hovered ? 1 : 0) : THREE.MathUtils.damp(hoverAmount, hovered ? 1 : 0, 9, dt);
        time += dt * motion;
        const bob = Math.sin(time * 1.7) * .006 * motion;
        const breath = Math.sin(time * 1.7) * .012 * motion;
        // Hop through the first 60% of the reaction, then a squash on landing.
        const hop = active && progress < .6 ? Math.sin(progress / .6 * Math.PI) * .085 * motion : 0;
        const squash = active && progress >= .6 && progress < .85 ? Math.sin((progress - .6) / .25 * Math.PI) * .12 * motion : 0;
        const scale = 1 + hoverAmount * .05;
        body.position.y = bob + hop;
        body.scale.set(scale * (1 + squash - breath * .5), scale * (1 - squash + breath), scale * (1 + squash - breath * .5));
        body.rotation.z = Math.sin(time * .9) * .03 * motion;
        head.rotation.z = (Math.sin(time * .6 + 1) * .05 + (active ? Math.sin(progress * Math.PI * 3) * .12 * reaction : 0)) * motion;
        if (cameraPosition) {
            // The head leads the turn and the body follows a little, so a glance at the
            // visitor never reads as a twisted neck.
            lookLocal.copy(cameraPosition);
            root.worldToLocal(lookLocal);
            const yaw = THREE.MathUtils.clamp(Math.atan2(lookLocal.x, lookLocal.z), -.6, .6);
            body.rotation.y = reducedMotion ? yaw * .35 : THREE.MathUtils.damp(body.rotation.y, yaw * .35, 3, dt);
            head.rotation.y = reducedMotion ? yaw * .65 : THREE.MathUtils.damp(head.rotation.y, yaw * .65, 4, dt);
        }
        if (!reducedMotion) {
            nextBlink -= dt;
            if (nextBlink <= 0) { blink = .14; nextBlink = 2.2 + random() * 3.4; }
            if (blink > 0) blink -= dt;
        }
        const open = blink > 0 ? Math.max(.1, Math.abs(blink - .07) / .07) : 1;
        for (const eye of eyes) eye.scale.y = .023 * open;
        aura.material.opacity = (night ? .95 : .5) + reaction * .5 + hoverAmount * .25;
        aura.scale.setScalar(.58 + reaction * .35 + hoverAmount * .06);
        if (!reducedMotion) placeMotes(time * .85 + (active ? progress * reaction * 4 : 0), active ? Math.sin(progress * Math.PI) * .09 : 0);
    }
    function poke() { reaction = 1; }
    function setHovered(value) { hovered = !!value; }
    function setNight(value) {
        night = !!value;
        mote.emissiveIntensity = night ? 1.6 : .9;
    }
    // Follows the hop but not the landing squash, so the bubble stays readable.
    function worldAnchor(target = anchor) {
        target.set(0, .60 + body.position.y, 0);
        return root.localToWorld(target);
    }
    return { root, update, poke, setHovered, setNight, worldAnchor, isActive: () => reaction > 0 };
}
