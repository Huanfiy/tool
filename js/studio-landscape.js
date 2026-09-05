/* Continuous, world-fixed exterior. It owns no room state, lights or RAF. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createLandscapeArt, landscapeRandom } from './studio-landscape-art.js';

export function createStudioLandscape({ layout, palette, compact, disposeOnce }) {
    const root = new THREE.Group(); root.name = 'studio-landscape';
    const owned = new Set(), released = new WeakSet();
    let disposed = false, theme = null, quality = null, radius = 0, art, texture;
    let time = 0, windTime = 0, wind = 1;
    const own = value => { owned.add(value); return value; };
    const release = disposeOnce || (value => {
        if (!released.has(value)) { released.add(value); value.dispose(); }
    });
    function dispose() {
        if (disposed) return;
        disposed = true; root.removeFromParent();
        owned.forEach(release); owned.clear(); root.clear();
    }
    try {
    const random = landscapeRandom(), dummy = new THREE.Object3D();
    const materials = {};
    function material(name, options = {}) {
        const mat = own(new THREE.MeshStandardMaterial({ roughness: 1, ...options }));
        materials[name] = mat; return mat;
    }
    function mesh(name, geometry, mat) {
        const object = new THREE.Mesh(geometry, mat); object.name = name;
        root.add(object); return object;
    }
    function instances(name, geometry, mat, items, receiveShadow = false) {
        const object = own(new THREE.InstancedMesh(geometry, mat, items.length));
        object.name = name; object.receiveShadow = receiveShadow;
        root.add(object);
        for (let i = 0; i < items.length; i++) {
            pose(object, i, items[i]);
            if (items[i].color) object.setColorAt(i, new THREE.Color(items[i].color));
        }
        object.computeBoundingSphere();
        return object;
    }
    function pose(object, index, item, sway = 0) {
        dummy.position.set(item.x, item.y, item.z);
        dummy.rotation.set(item.rx || 0, item.ry || 0, (item.rz || 0) + sway);
        dummy.scale.set(...item.scale); dummy.updateMatrix(); object.setMatrixAt(index, dummy.matrix);
    }
    const smooth = THREE.MathUtils.smoothstep;
    function heightAt(x, z) {
        const distance = Math.max(0, layout.wall.outerX - x);
        const slope = smooth(distance, 1.5, 17) * .42;
        const meadow = smooth(distance, 2, 7) * (1 - smooth(distance, 26, 45));
        return layout.ground.top - slope + Math.sin(x * .28) * Math.cos(z * .22) * .07 * meadow;
    }
    const groundMat = material('ground', { color: palette.ground, fog: false });
    const paperUniform = { value: new THREE.Color(palette.paper) };
    const centerUniform = { value: new THREE.Vector2(...layout.ground.fadeCenter) };
    const radiiUniform = { value: new THREE.Vector2(...layout.ground.fadeRadii) };
    // The ONLY exterior fragment customization is a world-space paint feather.
    // Blend AFTER the production tone mapping / output conversion, so the outer
    // land matches scene.background in the default framebuffer in both themes.
    groundMat.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, { landscapePaper: paperUniform, landscapeCenter: centerUniform, landscapeRadii: radiiUniform });
        shader.vertexShader = 'varying vec3 landscapePosition;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n landscapePosition=(modelMatrix*vec4(position,1.0)).xyz;');
        shader.fragmentShader = 'uniform vec3 landscapePaper; uniform vec2 landscapeCenter; uniform vec2 landscapeRadii; varying vec3 landscapePosition;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `#include <fog_fragment>
            vec2 p = landscapePosition.xz;
            float edge = length((p - landscapeCenter) / landscapeRadii);
            edge += sin(p.y * .40 + p.x * .13) * .035;
            float paint = 1.0 - smoothstep(.35, 1.0, edge);
            gl_FragColor.rgb = mix(linearToOutputTexel(vec4(landscapePaper, 1.0)).rgb, gl_FragColor.rgb, paint);
        `);
    };
    groundMat.customProgramCacheKey = () => 'studio-landscape-world-paint-v1';
    function terrainGeometry(extent) {
        // Nonuniform grid: fine at the building, sparse at the distant support.
        // One topology crosses the former garden boundary in BOTH X and Z.
        const xs = [-extent, -48, -32, -24, -20, -17, -15, -13, -11, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, .18, 1, 2, 3, 4, 6, 8, 11, 15, 22, 32, 48, extent].map(x => x + layout.wall.outerX);
        const zs = [-extent, -48, -32, -22, -16, -12, -10, -8, -7, -6, -5, -4, -3.8, -3, -2, -1, 0, 1, 2, 3, 3.8, 4, 5, 6, 7, 8, 10, 12, 16, 22, 32, 48, extent];
        const positions = [], indices = [], colors = [], tint = new THREE.Color();
        for (const z of zs) for (const x of xs) {
            positions.push(x, heightAt(x, z), z);
            const shade = .94 + Math.sin(x * .42 + z * .3) * .035 + Math.cos(z * .53) * .025;
            tint.setRGB(shade, shade, shade * .98); colors.push(tint.r, tint.g, tint.b);
        }
        for (let z = 0; z < zs.length - 1; z++) for (let x = 0; x < xs.length - 1; x++) {
            const a = z * xs.length + x, b = a + xs.length;
            indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
        const geo = own(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.setIndex(indices); geo.computeVertexNormals(); geo.computeBoundingSphere(); return geo;
    }
    groundMat.vertexColors = true;
    const ground = mesh('continuous-garden-and-far-ground', terrainGeometry(layout.background.radius + 2), groundMat);
    ground.receiveShadow = true;
    const skyMaterial = own(new THREE.MeshBasicMaterial({ side: THREE.BackSide, toneMapped: false, fog: false }));
    const skyGeometry = own(new THREE.SphereGeometry(1, 64, 40, Math.PI)); skyGeometry.computeBoundingSphere();
    const sky = mesh('closed-pastoral-sky', skyGeometry, skyMaterial);
    sky.position.set(...layout.background.center); sky.raycast = () => {};

    const stoneMat = material('stone', { color: palette.stone });
    const cube = own(new THREE.BoxGeometry(1, 1, 1)), pebble = own(new THREE.IcosahedronGeometry(1, 1));
    const foundation = [];
    for (let i = 0; i < 16; i++) foundation.push({
        x: layout.wall.outerX - .08, y: layout.ground.top + .045, z: -3.75 + i * .5,
        scale: [.29, .14, .496], color: i % 3 ? '#ede7d4' : '#dcdac6'
    });
    // Short returns under the front/back floor corners, never an infinite cut edge.
    for (const z of [-3.84, 3.84]) for (let i = 0; i < 3; i++) foundation.push({
        x: layout.wall.outerX + .25 + i * .5, y: layout.ground.top + .035, z,
        scale: [.50, .12, .24], color: '#e5decb'
    });
    instances('wall-foot-stone-and-corner-returns', cube, stoneMat, foundation, true);
    const stones = [];
    const pathCenterX = z => layout.wall.outerX - 4.0 - .038 * z * z;
    for (let i = 0; i < 23; i++) {
        const z = -8.3 + i * .72, x = pathCenterX(z) + Math.sin(i * .8) * .12;
        stones.push({ x, y: heightAt(x, z) + .025, z, ry: Math.sin(i * 4) * .3,
            scale: [.40 + random() * .09, .045, .26 + random() * .05], color: i % 2 ? '#f3e5c7' : '#d6d6bd' });
    }
    instances('side-garden-stepping-stones', pebble, stoneMat, stones, true);

    const barkMat = material('bark', { color: palette.bark });
    const crownMat = material('crown', { color: palette.crown });
    const trunkGeometry = own(new THREE.CylinderGeometry(.72, 1, 1, 7));
    const trunks = [], crowns = [];
    // Tall assets stay on the outward side of the camera's conservative half-plane.
    // Positive-Z trees are set farther back, rather than restricting OrbitControls.
    const trees = [[-8.85, -4.10, 3.55, 1.10], [-12.55, 2.30, 3.8, 1.15], [-16.8, -5.8, 2.55, .86], [-19.2, 1.1, 2.20, .80]];
    for (const [x, z, height, size] of trees) {
        const y = heightAt(x, z);
        trunks.push({ x, y: y + height * .39, z, rz: .045, scale: [.11 * size, height * .78, .11 * size] });
        for (const side of [-1, 1]) trunks.push({ x: x + side * .20, y: y + height * .67, z, rz: side * -.48, scale: [.052, height * .34, .052] });
        for (const [dx, dy, dz, s] of [[0, 0, 0, 1], [-.57, -.18, .08, .74], [.53, -.12, .18, .78], [.08, .49, -.08, .72], [-.05, .06, -.5, .76]]) {
            crowns.push({ x: x + dx * size, y: y + height + dy * size, z: z + dz * size,
                scale: [size * s, size * s * .83, size * s * .86], phase: random() * Math.PI * 2,
                color: ['#dbe8c8', '#bed5ae', '#ebedcd'][crowns.length % 3] });
        }
    }
    instances('orchard-trunks', trunkGeometry, barkMat, trunks);
    // Soft contact colour grounds the trees without adding dynamic shadow casters.
    const contactGeometry = own(new THREE.CircleGeometry(1, 24)); contactGeometry.rotateX(-Math.PI / 2);
    const contactColors = [];
    for (let i = 0; i < contactGeometry.attributes.position.count; i++) contactColors.push(1, 1, 1, i ? 0 : .21);
    contactGeometry.setAttribute('color', new THREE.Float32BufferAttribute(contactColors, 4));
    const contactMat = own(new THREE.MeshBasicMaterial({ color: '#516347', vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
    const contacts = trees.map(([x, z, , size]) => ({ x, y: heightAt(x, z) + .012, z, scale: [size * 1.4, 1, size * 1.1] }));
    instances('orchard-contact-wash', contactGeometry, contactMat, contacts).raycast = () => {};
    const crownMesh = instances('wind-orchard-crowns', pebble, crownMat, crowns);
    crownMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Native raycasting uses these same animated instance matrices; opaque trees
    // occlude devices, but no exterior ancestor carries a window/device action.

    const grassMat = material('grass', { color: palette.grass, side: THREE.DoubleSide, vertexColors: true });
    const bladePositions = [], bladeColors = [], bladeIndices = [];
    const rootTint = new THREE.Color('#c6d4ac'), middleTint = new THREE.Color('#eef1cf'), tipTint = new THREE.Color('#fff2bd');
    const leafTint = new THREE.Color();
    let grassReach = 0, grassHeight = 0;
    // Six independent, curved ribbons, not intersecting upright wedges. Roots
    // spread slightly; each blade broadens then tapers to ONE tip (no flat cap).
    // Indexed rows share normals for a soft painted surface without dark facets.
    const blades = [[.15, .64, .37, .053], [2.55, .43, .48, .058], [4.8, .75, .26, .045],
        [1.5, .51, .53, .055], [3.8, .55, .42, .048], [5.85, .38, .45, .052]];
    for (const [angle, height, bend, width] of blades) {
        const start = bladePositions.length / 3;
        for (let row = 0; row <= 5; row++) {
            const t = row / 5, a = angle + .18 * t * t;
            const reach = .045 + bend * t * t;
            const x = Math.cos(a) * reach, z = Math.sin(a) * reach;
            const y = height * (2.1 * t - 1.1 * t * t);
            const halfWidth = width * [.40, 1, .82, .50, .20, 0][row];
            grassReach = Math.max(grassReach, Math.hypot(reach, halfWidth));
            grassHeight = Math.max(grassHeight, y);
            leafTint.copy(rootTint).lerp(middleTint, Math.min(1, t * 2));
            if (t > .5) leafTint.lerp(tipTint, (t - .5) * 2);
            for (const side of row === 5 ? [0] : [-1, 1]) {
                bladePositions.push(x - Math.sin(a) * halfWidth * side, y, z + Math.cos(a) * halfWidth * side);
                bladeColors.push(leafTint.r, leafTint.g, leafTint.b);
            }
            if (row < 4) {
                const v = start + row * 2;
                bladeIndices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
            } else if (row === 4) bladeIndices.push(start + 8, start + 9, start + 10);
        }
    }
    const grassGeometry = own(new THREE.BufferGeometry());
    grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bladePositions, 3));
    grassGeometry.setAttribute('color', new THREE.Float32BufferAttribute(bladeColors, 3));
    grassGeometry.setIndex(bladeIndices); grassGeometry.computeVertexNormals(); grassGeometry.computeBoundingSphere();
    const grasses = [], grassRandom = landscapeRandom(1927), patches = [];
    // Keep the original scenery random stream stable: changing the grass detail
    // must not rearrange the flowers. All new tuft decisions use their own seed.
    for (let i = 0; i < 150; i++) {
        const x = layout.wall.outerX - .65 - random() * 10.0, z = (random() - .5) * 15.5;
        patches.push({ x, z, size: .22 + random() * .25, angle: random() * Math.PI, phase: random() * 6.28 });
    }
    for (const patch of patches) {
        // Loose islands of growth with breathing room, rather than evenly spaced
        // spikes or a dense carpet. Smaller low tufts gather around a taller one.
        if (grassRandom() > .40) continue;
        const count = 3 + Math.floor(grassRandom() * 4);
        for (let i = 0; i < count; i++) {
            const a = patch.angle + grassRandom() * Math.PI * 2;
            const distance = i ? .17 + grassRandom() * .62 : 0;
            const x = patch.x + Math.cos(a) * distance, z = patch.z + Math.sin(a) * distance;
            const size = (i ? .72 : 1) * (.30 + patch.size * .30 + grassRandom() * .10);
            const spread = size * (1.15 + grassRandom() * .45), depth = spread * (.80 + grassRandom() * .30);
            // Include nonuniform scale, full leaf reach and the .08-radian wind
            // envelope in the clearances, not just the instance's root point.
            const footprint = grassReach * Math.max(spread, depth) + grassHeight * size * .08;
            // Only the far side of the path grows grass. The entire house-side
            // strip (including beneath the window) stays clear, even between stones.
            // Use the outermost path bend across the tuft's full Z footprint;
            // .75 covers stone width, placement jitter and a small bare verge.
            if (Math.abs(z) + footprint > 7.85 || x + footprint > pathCenterX(Math.abs(z) + footprint) - .75) continue;
            if (trees.some(([tx, tz, , treeSize]) => Math.hypot(x - tx, z - tz) < .14 * treeSize + footprint)) continue;
            if (grasses.some(grass => Math.hypot(x - grass.x, z - grass.z) < .16)) continue;
            grasses.push({ x, y: heightAt(x, z) - .008, z, ry: a, phase: patch.phase * .12,
                scale: [spread, size, depth],
                color: ['#ffffff', '#f1f4dc', '#e4edcf'][Math.floor(grassRandom() * 3)] });
        }
    }
    const grassMesh = instances('garden-grass', grassGeometry, grassMat, grasses);
    grassMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // A whole flower is one shared geometry, not six draw calls per stem.
    const flowerParts = [];
    function flowerPart(geometry, scale, position, color) {
        if (geometry.index) { const indexed = geometry; geometry = indexed.toNonIndexed(); release(indexed); }
        geometry.scale(...scale); geometry.translate(...position);
        const c = new THREE.Color(color), colors = [];
        for (let i = 0; i < geometry.attributes.position.count; i++) colors.push(c.r, c.g, c.b);
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); flowerParts.push(geometry);
    }
    flowerPart(new THREE.CylinderGeometry(.011, .014, .35, 5), [1, 1, 1], [0, .175, 0], '#81a167');
    for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        flowerPart(new THREE.IcosahedronGeometry(1, 0), [.064, .025, .049], [Math.cos(a) * .062, .36, Math.sin(a) * .062], '#f2b3a1');
    }
    flowerPart(new THREE.IcosahedronGeometry(1, 0), [.031, .03, .031], [0, .376, 0], '#f1d58a');
    const flowerGeometry = own(mergeGeometries(flowerParts, false)); flowerParts.forEach(release);
    const flowerMat = material('flower', { color: palette.flower, vertexColors: true });
    const flowers = [];
    for (let i = 0; i < 48; i++) {
        const x = layout.wall.outerX - .60 - random() * 2.45, z = -5.8 + random() * 11.6, size = .65 + random() * .6;
        flowers.push({ x, y: heightAt(x, z) + .015, z, ry: random() * 6.28, phase: random() * 6.28,
            scale: [size, size, size], color: ['#ffffff', '#fff1ba', '#ccc0ee'][i % 3] });
    }
    const flowerMesh = instances('low-window-flower-beds', flowerGeometry, flowerMat, flowers);
    flowerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const cloudMat = own(new THREE.MeshBasicMaterial({ color: palette.cloud, transparent: true, opacity: .65, depthWrite: false, fog: false, toneMapped: false }));
    const cloudGeometry = own(new THREE.SphereGeometry(1, 12, 8)), clouds = [];
    for (const [x, y, z, size] of [[-29, 9.6, -9, 1.8], [-33, 11.7, 8, 1.45], [-37, 8.3, -2, 1.2]]) {
        for (const [offset, rise, scale] of [[-1, -.1, .70], [-.3, .2, 1], [.45, .07, .82], [1, -.05, .55]]) clouds.push({
            x, y: y + rise * size, z: z + offset * size, phase: z * .13,
            scale: [size * scale * .55, size * scale * .43, size * scale], baseY: y + rise * size, baseZ: z + offset * size
        });
    }
    const cloudMesh = instances('slow-orchard-clouds', cloudGeometry, cloudMat, clouds); cloudMesh.raycast = () => {};
    cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const birdMat = own(new THREE.MeshBasicMaterial({ color: palette.bird, side: THREE.DoubleSide, toneMapped: false, fog: false }));
    const birdGeometry = own(new THREE.BufferGeometry());
    birdGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, .04, .02, .26, 0, .09, .52], 3)); birdGeometry.computeVertexNormals();
    const birds = [];
    for (let i = 0; i < 4; i++) for (const side of [-1, 1]) birds.push({
        x: -24 - i * 1.4, y: 6.0 + Math.sin(i * 2) * .55, z: -4 + i * 2.2,
        baseY: 6.0 + Math.sin(i * 2) * .55, baseZ: -4 + i * 2.2,
        phase: i * 1.8, side, scale: [1, 1, 1], ry: side < 0 ? Math.PI : 0
    });
    const birdMesh = instances('gliding-garden-birds', birdGeometry, birdMat, birds); birdMesh.raycast = () => {};
    birdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Fixed conservative envelopes cover every phase, including closed-window
    // wind. Avoid an O(instance count) sphere union on every quiet-room frame.
    // Near meshes only rotate; clouds translate <=1.1/.045, birds <=1.8/.22
    // plus wing rotation. Keep these margins in sync with update() amplitudes.
    const animatedMeshes = [crownMesh, grassMesh, flowerMesh, cloudMesh, birdMesh];
    const motionMargins = [.08, .12, .10, 1.2, 2.0];
    animatedMeshes.forEach((object, i) => { object.boundingSphere.radius += motionMargins[i]; });

    function paintSky() {
        art.draw(theme, layout);
        texture.needsUpdate = true;
    }
    function setTheme(next) {
        if (disposed || theme?.night === next.night) return;
        theme = next;
        for (const [name, mat] of Object.entries(materials)) mat.color.set(next[name]);
        paperUniform.value.set(next.paper); cloudMat.color.set(next.cloud); birdMat.color.set(next.bird);
        contactMat.color.set(next.night ? '#182c22' : '#516347');
        if (art) paintSky();
    }
    function configure(nextCompact, nextRadius = layout.background.radius) {
        if (disposed) return;
        if (radius !== nextRadius) {
            sky.scale.setScalar(nextRadius);
            if (radius) { const old = ground.geometry; ground.geometry = terrainGeometry(nextRadius + 2); release(old); owned.delete(old); }
            radius = nextRadius;
        }
        const size = nextCompact ? 1024 : 2048;
        if (quality === size) return;
        quality = size; art = createLandscapeArt(size, size / 2); art.draw(theme, layout);
        const previous = texture;
        texture = own(new THREE.CanvasTexture(art.canvas)); texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
        skyMaterial.map = texture; skyMaterial.needsUpdate = true;
        if (previous) { release(previous); owned.delete(previous); }
    }
    function update(dt, motion) {
        if (disposed || motion.reducedMotion) return;
        dt = Math.max(0, dt);
        // Integrate phase; never multiply an absolute time/position by the new
        // window state. Even an instantaneous casement change cannot teleport birds.
        wind = THREE.MathUtils.damp(wind, motion.wind, 3, dt);
        time += dt; windTime += dt * wind;
        crowns.forEach((item, i) => pose(crownMesh, i, item, Math.sin(windTime * .65 + item.phase) * .021 * wind));
        grasses.forEach((item, i) => {
            // A slow, spatially coherent breeze, with a much smaller second ripple.
            // Root translations remain fixed; native picking follows the matrices.
            const phase = windTime * .95 + item.x * .48 + item.z * .32 + item.phase;
            pose(grassMesh, i, item, (Math.sin(phase) * .065 + Math.sin(phase * 1.8 + item.phase) * .015) * wind);
        });
        flowers.forEach((item, i) => pose(flowerMesh, i, item, Math.sin(windTime * .9 + item.phase) * .085 * wind));
        clouds.forEach((item, i) => {
            item.z = item.baseZ + Math.sin(windTime * .065 + item.phase) * 1.1;
            item.y = item.baseY + Math.sin(time * .09 + item.phase) * .045;
            pose(cloudMesh, i, item);
        });
        birds.forEach((item, i) => {
            item.z = item.baseZ + Math.sin(windTime * .22 + item.phase) * 1.8;
            item.y = item.baseY + Math.sin(windTime * .42 + item.phase) * .22;
            item.rx = item.side * (.20 + Math.sin(windTime * 4.4 + item.phase) * .34);
            pose(birdMesh, i, item);
        });
        for (const object of animatedMeshes) object.instanceMatrix.needsUpdate = true;
    }
    setTheme(palette); configure(compact);
    return { root, update, setTheme, configure, dispose, heightAt };
    } catch (error) {
        dispose(); throw error;
    }
}
