/* A live HTML desktop in the monitor's physical screen, sharing the room camera. */
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

export function createStudioMonitor({ container, camera, monitor, width, height, y, z }) {
    const element = document.getElementById('monitor-focus');
    if (!element) throw new Error('Studio monitor element is missing');
    const home = element.parentElement;
    let disposed = false;
    const cssScene = new THREE.Scene();
    const cssRenderer = new CSS3DRenderer();
    cssRenderer.domElement.className = 'lab-screen-layer';
    container.prepend(cssRenderer.domElement);
    element.classList.add('is-spatial');
    element.inert = false;
    const screen = new CSS3DObject(element);
    screen.matrixAutoUpdate = false;
    cssScene.add(screen);

    // Write a transparent aperture into the WebGL canvas. Its depth buffer still
    // hides HTML behind foreground furniture, while the rest of the room stays opaque.
    const aperture = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.FrontSide, fog: false, toneMapped: false }));
    aperture.position.set(0, y, z);
    aperture.renderOrder = 1;
    monitor.add(aperture);
    let layoutWidth = 960;
    const local = new THREE.Matrix4();
    const center = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const direction = new THREE.Vector3();

    function resize(w, h) {
        if (disposed) return;
        cssRenderer.setSize(w, h);
        layoutWidth = w <= 700 ? 400 : 960;
        element.style.width = `${layoutWidth}px`;
        element.style.height = `${layoutWidth * height / width}px`;
        local.makeTranslation(0, y, z).scale(new THREE.Vector3().setScalar(width / layoutWidth));
    }
    function render() {
        if (disposed) return;
        monitor.updateWorldMatrix(true, false);
        screen.matrix.copy(monitor.matrixWorld).multiply(local);
        center.set(0, y, z).applyMatrix4(monitor.matrixWorld);
        normal.set(0, 0, 1).transformDirection(monitor.matrixWorld);
        const facing = normal.dot(direction.copy(camera.position).sub(center)) > 0;
        const p = center.clone().project(camera);
        const visible = facing && p.z > -1 && p.z < 1;
        element.inert = !visible;
        element.style.visibility = visible ? 'visible' : 'hidden';
        cssRenderer.render(cssScene, camera);
    }
    // Native clicks, selection, input and scrolling stay inside the screen.
    // Room gestures are handled on the separate surface behind this element.
    const stop = event => event.stopPropagation();
    const events = ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'wheel', 'dblclick'];
    events.forEach(type => element.addEventListener(type, stop));
    return {
        element, resize, render,
        dispose() {
            if (disposed) return;
            disposed = true;
            events.forEach(type => element.removeEventListener(type, stop));
            element.classList.remove('is-spatial');
            element.style.cssText = '';
            home.append(element);
            cssRenderer.domElement.remove();
        }
    };
}
