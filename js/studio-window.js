/* Mechanical casements only. The room owns the exterior and the shared clock. */
import * as THREE from 'three';

export function createStudioWindow({ box, bar, group, material, reducedMotion, disposeOnce, layout }) {
    const root = new THREE.Group();
    root.name = 'opening-studio-window';
    root.userData.window = true;
    root.userData.windowOpen = true;
    const owned = new Set();
    let disposed = false, night = false;
    const own = value => { owned.add(value); return value; };
    function dispose() {
        if (disposed) return;
        disposed = true;
        owned.forEach(disposeOnce);
        owned.clear();
        root.removeFromParent();
    }
    try {
    const frame = material('windowFrame', { color: '#e9e8d9', roughness: .72 });
    const seal = material('windowSeal', { color: '#7f8e80', roughness: 1 });
    const handle = material('windowHandle', { color: '#a8b5a9', metalness: .45, roughness: .42 });
    const glass = own(new THREE.MeshStandardMaterial({
        color: '#c3e0dc', transparent: true, opacity: .105, roughness: .12,
        metalness: .12, side: THREE.DoubleSide, depthWrite: false
    }));
    const glint = own(new THREE.MeshBasicMaterial({
        color: '#effff5', transparent: true, opacity: .20, depthWrite: false, toneMapped: false
    }));

    // The fixed frame leaves the centre entirely clear when the two leaves open.
    for (const z of [-2.72, 2.58]) box(root, .16, 2.89, .095, -5.105, 2.985, z, frame, .014);
    for (const y of [1.60, 4.37]) box(root, .17, .095, 5.39, -5.105, y, -.07, frame, .014);
    for (const z of [-2.655, 2.515]) box(root, .04, 2.66, .026, -5.17, 2.985, z, seal, .004);

    const openingAngle = layout.casement.maxAngle;
    const casements = [];
    for (const direction of [1, -1]) {
        const leaf = group(root, layout.casement.hingeX, (layout.casement.top + layout.casement.bottom) / 2, direction === 1 ? layout.casement.zMin : layout.casement.zMax);
        const width = layout.casement.width, height = layout.casement.top - layout.casement.bottom, centre = direction * width / 2;
        leaf.name = direction === 1 ? 'window-left-casement' : 'window-right-casement';
        for (const z of [0, direction * width]) box(leaf, .075, height, .077, 0, 0, z, frame, .011);
        for (const y of [-height / 2 + .042, height / 2 - .042]) box(leaf, .075, .084, width, 0, y, centre, frame, .011);
        // A thin glass volume catches light without hiding the landscape.
        const pane = box(leaf, .012, height - .16, width - .14, 0, 0, centre, glass, 0);
        pane.castShadow = false;
        pane.receiveShadow = false;
        for (const offset of [0, .15]) {
            const reflection = bar(leaf, [.012, .95 - offset, centre + direction * .54], [.012, .52 - offset, centre + direction * .16], .009, glint);
            reflection.castShadow = false;
            reflection.receiveShadow = false;
        }
        for (const y of [-.88, .88]) {
            bar(leaf, [-.045, y - .09, 0], [-.045, y + .09, 0], .034, handle);
            box(leaf, .027, .17, .09, .005, y, direction * .03, handle, .008);
        }
        const latchZ = direction * (width - .15);
        box(leaf, .027, .24, .09, .052, -.11, latchZ, handle, .012);
        bar(leaf, [.066, -.05, latchZ], [.13, -.05, latchZ], .022, handle);
        bar(leaf, [.13, -.05, latchZ], [.13, -.23, latchZ], .024, handle);
        leaf.rotation.y = -direction * openingAngle;
        casements.push({ leaf, direction });
    }

    // An invisible opening-sized target remains easy to click with the leaves open.
    // Include meshes marked windowHit in the room's raycast candidates.
    const hit = new THREE.Mesh(own(new THREE.PlaneGeometry(5.19, 2.67)), own(new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0, colorWrite: false, depthWrite: false, side: THREE.DoubleSide
    })));
    hit.name = 'window-interaction-area';
    hit.rotation.y = Math.PI / 2;
    hit.position.set(-5.095, 2.985, -.07);
    hit.userData.windowHit = true;
    root.add(hit);

    let angle = openingAngle;
    function update(dt, open = true) {
        if (disposed) return false;
        const target = open ? openingAngle : 0;
        const previousAngle = angle;
        angle = reducedMotion ? target : THREE.MathUtils.damp(angle, target, 7, Math.max(0, dt));
        if (Math.abs(angle - target) < .0001) angle = target;
        for (const { leaf, direction } of casements) leaf.rotation.y = -direction * angle;
        root.userData.windowOpen = !!open;
        return angle !== previousAngle;
    }
    function setNight(value) {
        if (disposed || night === !!value) return;
        night = !!value;
        glass.color.set(night ? '#91abc4' : '#c3e0dc');
        glint.opacity = night ? .09 : .20;
    }
    return { root, update, setNight, dispose, getOpenAmount: () => angle / openingAngle };
    } catch (error) {
        dispose(); throw error;
    }
}
