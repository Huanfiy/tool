/* Exterior is a sibling of the mechanical window, never an interaction parent. */
import * as THREE from 'three';
import { createLandscapeArt } from './studio-landscape-art.js';
export function createStudioLandscape({ box, bar, sphere, group, resources, reducedMotion, disposeOnce }) {
    const root = new THREE.Group(), owned = new Set();
    let disposed = false, night = false, windTime = 0, landscapeRefresh = 0;
    const own = value => { owned.add(value); resources.add(value); return value; };
    const outdoors = root;
    outdoors.name = 'view-through-window';
    // Keep the real exterior geometry behind the window, but show it only through
    // the aperture. This also hides its back and edges when orbiting the diorama.
    // The mask uses world positions, so nearby branches retain their parallax.
    function throughWindow(mat) {
        mat.fog = false;
        mat.onBeforeCompile = shader => {
            shader.vertexShader = 'varying vec3 studioOutdoorPosition;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
                vec4 studioPosition = vec4(transformed, 1.0);
                #ifdef USE_INSTANCING
                    studioPosition = instanceMatrix * studioPosition;
                #endif
                studioOutdoorPosition = (modelMatrix * studioPosition).xyz;
                #include <project_vertex>
            `);
            shader.fragmentShader = 'varying vec3 studioOutdoorPosition;\n' + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `
                #include <clipping_planes_fragment>
                if (cameraPosition.x <= -5.17) discard;
                float studioDenominator = studioOutdoorPosition.x - cameraPosition.x;
                float studioCrossing = (-5.17 - cameraPosition.x) / studioDenominator;
                vec3 studioAperture = mix(cameraPosition, studioOutdoorPosition, studioCrossing);
                if (studioCrossing <= 0.0 || studioCrossing >= 1.0 ||
                    studioAperture.y < 1.65 || studioAperture.y > 4.35 ||
                    studioAperture.z < -2.69 || studioAperture.z > 2.57) discard;
            `);
        };
        mat.customProgramCacheKey = () => 'studio-window-aperture-v1';
        return own(mat);
    }

    // A painted fantasy countryside replaces the old photographic horizon.
    // The canvas is deliberately storybook-like; depth comes from the animated
    // trees, clouds, birds and flowers layered in front of it.
    const art = createLandscapeArt(), pastoralCanvas = art.canvas;
    const drawPastoral = t => art.draw(t, night);
    drawPastoral(0);
    const pastoralTexture=own(new THREE.CanvasTexture(pastoralCanvas));pastoralTexture.colorSpace=THREE.SRGBColorSpace;pastoralTexture.wrapS=THREE.ClampToEdgeWrapping;pastoralTexture.wrapT=THREE.ClampToEdgeWrapping;
    const photoMaterial = throughWindow(new THREE.MeshBasicMaterial({
        map:pastoralTexture, color:'#ffffff', side: THREE.DoubleSide, toneMapped: false
    }));
    // A curved panorama wraps around the exterior instead of sitting on the sash.
    const backdropGeometry = own(new THREE.PlaneGeometry(1, 40, 64, 1));
    const backdropPositions = backdropGeometry.attributes.position, backdropUV = backdropGeometry.attributes.uv;
    for (let i = 0; i < backdropPositions.count; i++) {
        const angle = backdropPositions.getX(i) * Math.PI, y = backdropPositions.getY(i);
        // The tall curved sheet prevents edge leaks during orbiting. Map the
        // aperture's 1.65–4.35 world-y band to the complete painted panorama;
        // the clamped texels outside that band cover unusually steep views.
        backdropUV.setY(i, (y - 2.15) / 2.70);
        // A compact arc gives the five-metre opening a broad slice of the
        // panorama instead of showing only its centre strip.
        backdropPositions.setXYZ(i, -5.30 - Math.cos(angle) * 4.5, y - .50, -.07 + Math.sin(angle) * 4.5);
    }
    backdropGeometry.computeVertexNormals();
    const backdrop = new THREE.Mesh(backdropGeometry, photoMaterial);
    backdrop.name = 'fantasy-pastoral-backdrop';
    outdoors.add(backdrop);
    const earth = throughWindow(new THREE.MeshStandardMaterial({ color: '#6c8051', roughness: 1 }));
    const bark = throughWindow(new THREE.MeshStandardMaterial({ color: '#938875', roughness: 1 }));
    const foliage = throughWindow(new THREE.MeshStandardMaterial({
        color: '#82956d', roughness: 1, side: THREE.DoubleSide, vertexColors: true
    }));
    const terrainGeometry = own(new THREE.PlaneGeometry(18, 23, 22, 25));
    terrainGeometry.rotateX(-Math.PI / 2);
    const terrainPositions = terrainGeometry.attributes.position;
    for (let i = 0; i < terrainPositions.count; i++) {
        const x = terrainPositions.getX(i), z = terrainPositions.getZ(i);
        terrainPositions.setY(i, -2.40 + Math.sin(x * .4 + z * .21) * .48 + Math.cos(z * .36) * .20);
    }
    terrainGeometry.computeVertexNormals();
    const terrain = new THREE.Mesh(terrainGeometry, earth);
    terrain.position.x = -14.4;
    outdoors.add(terrain);

    const treeCrown=throughWindow(new THREE.MeshStandardMaterial({color:'#6eaa6e',roughness:1}));
    const trunkMat=throughWindow(new THREE.MeshStandardMaterial({color:'#8d684f',roughness:1}));
    const cloudMat=throughWindow(new THREE.MeshBasicMaterial({color:'#fff9dc',transparent:true,opacity:.72,depthWrite:false,toneMapped:false}));
    const sunMat=throughWindow(new THREE.MeshBasicMaterial({color:'#fff0a8',toneMapped:false}));
    const birdMat=throughWindow(new THREE.MeshBasicMaterial({color:'#425e66',toneMapped:false}));
    const flowerMats=[throughWindow(new THREE.MeshStandardMaterial({color:'#e98d7d',roughness:.9})),throughWindow(new THREE.MeshStandardMaterial({color:'#f0c567',roughness:.9})),throughWindow(new THREE.MeshStandardMaterial({color:'#a68bd0',roughness:.9}))];
    const windCrowns=[],clouds=[],birds=[],flowers=[];
    // Keep the sun just below the top seal so it remains visible through the
    // aperture from both the overview and close window angles.
    const sun=sphere(outdoors,.46,-6.35,3.82,.10,sunMat);sun.scale.set(1,.96,.35);
    for(const [x,y,z,scale] of [[-10.8,4.05,-2.2,1],[-12.5,4.42,2.8,.72],[-14.2,3.88,-4.8,.84]]){
        const cloud=group(outdoors,x,y,z);clouds.push({node:cloud,baseZ:z,baseY:y,phase:Math.random()*6});
        for(const [dx,dy,dz,s] of [[-.25,0,0,.34],[.05,.06,0,.43],[.32,0,0,.28]]){const puff=sphere(cloud,s,dx,dy,dz,cloudMat);puff.scale.y=.62;puff.scale.z=.52;}
    }
    const crown=(x,y,z,s)=>{const g=group(outdoors,x,y,z);g.scale.setScalar(s);for(const [dx,dy,dz,scale] of [[0,0,0,1],[-.26,.12,.10,.75],[.24,.14,-.08,.72],[.03,.28,.06,.60]]){const leaf=sphere(g,.42,dx,dy,dz,treeCrown);leaf.scale.set(scale,.80*scale,.72*scale);}windCrowns.push(g);return g;};
    crown(-8.1,2.55,2.40,1.18);crown(-8.7,2.25,-2.75,1.02);crown(-11.2,2.05,4.35,.92);
    // Stylised flying birds: two wings flap while the group glides through the opening.
    for(const [x,y,z,phase] of [[-11.2,3.35,-1.20,0],[-12.5,3.82,1.25,2.1],[-9.6,3.15,3.65,4.2]]){
        const bird=group(outdoors,x,y,z),body=sphere(bird,.105,0,0,0,birdMat);body.scale.set(1.65,.70,.70);
        const wingA=box(bird,.28,.026,.065,-.16,.02,0,birdMat,.008),wingB=box(bird,.28,.026,.065,.16,.02,0,birdMat,.008);birds.push({node:bird,wingA,wingB,baseZ:z,baseY:y,phase});
    }
    // A nearer patch of flowers and grass responds to the same wind as the curtains.
    for(let i=0;i<11;i++){
        const z=-2.45+i*.48+(i%2)*.08,g=group(outdoors,-6.18,1.56,z),stem=bar(g,[0,0,0],[0,.25,0],.009,trunkMat),petals=[];
        for(let p=0;p<5;p++){const a=p*Math.PI*2/5,petal=sphere(g,.045,Math.cos(a)*.075,.29,Math.sin(a)*.075,flowerMats[i%3]);petal.scale.set(1,.55,.72);petals.push(petal);}sphere(g,.035,0,.29,0,sunMat);flowers.push({node:g,stem,petals,phase:i*.73});
    }

    // Light, individually shaped leaves close to the window create visible depth
    // against the real forest. The trunks and foliage stay outside the sill.
    let seed = 741;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const leafPositions = [], leafColours = [];
    const leafColour = new THREE.Color();
    function leafAt(x, y, z, size) {
        const right = new THREE.Vector3(Math.cos(random() * 6.28), .12 + random() * .35, Math.sin(random() * 6.28)).normalize();
        const up = new THREE.Vector3(-right.y, .65, .18).normalize();
        const centre = new THREE.Vector3(x, y, z);
        const shape = [[0, -.70], [-.55, -.34], [-.63, .14], [-.39, .59], [0, .84], [.39, .59], [.63, .14], [.55, -.34]];
        leafColour.setHSL(.22 + random() * .055, .20 + random() * .15, .54 + random() * .24);
        for (let k = 0; k < shape.length; k++) {
            const next = (k + 1) % shape.length;
            for (const p of [[0, 0], shape[k], shape[next]]) {
                const vertex = centre.clone().addScaledVector(right, p[0] * size).addScaledVector(up, p[1] * size);
                leafPositions.push(vertex.x, vertex.y, vertex.z);
                leafColours.push(leafColour.r, leafColour.g, leafColour.b);
            }
        }
    }
    for (const [x, z, height, lean] of [[-6.40, 2.55, 5.8, -.25], [-6.55, -4.70, 5.6, -.18]]) {
        const base = -2.15;
        bar(outdoors, [x, base, z], [x + lean, base + height, z + .22], .054, bark);
        for (let i = 0; i < 9; i++) {
            const y = base + 2.0 + i * (height - 2.35) / 9;
            const angle = i * 2.4;
            const reach = .38 + random() * .50;
            const end = [x + Math.cos(angle) * reach, y + .32 + random() * .32, z + Math.sin(angle) * reach];
            bar(outdoors, [x + lean * ((y - base) / height), y, z], end, .015, bark);
            for (let j = 0; j < 12; j++) {
                leafAt(end[0] + (random() - .5) * .76, end[1] + (random() - .5) * .38, end[2] + (random() - .5) * .76, .11 + random() * .09);
            }
        }
    }
    const leafGeometry = own(new THREE.BufferGeometry());
    leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute(leafPositions, 3));
    leafGeometry.setAttribute('color', new THREE.Float32BufferAttribute(leafColours, 3));
    leafGeometry.computeVertexNormals();
    outdoors.add(new THREE.Mesh(leafGeometry, foliage));
    outdoors.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = false;
        object.receiveShadow = false;
        object.raycast = () => {};
    });

    function update(dt, motion) {
        if (disposed) return;
        if (!reducedMotion) { windTime += Math.max(0, dt); landscapeRefresh += Math.max(0, dt); }
        const breeze = motion.wind;
        // Clouds drift slowly, birds glide and flap, while flowers and tree crowns
        // sway at different phases so the view never looks like a looping sprite.
        if (!reducedMotion) {
            for(const cloud of clouds){cloud.node.position.z=cloud.baseZ+Math.sin(windTime*.10+cloud.phase)*.42;cloud.node.position.y=cloud.baseY+Math.sin(windTime*.13+cloud.phase)*.035;}
            for(const bird of birds){bird.node.position.z=bird.baseZ+Math.sin(windTime*.22+bird.phase)*1.25;bird.node.position.y=bird.baseY+Math.sin(windTime*.45+bird.phase)*.18;bird.wingA.rotation.z=.34+Math.sin(windTime*5.2+bird.phase)*.34;bird.wingB.rotation.z=-.34-Math.sin(windTime*5.2+bird.phase)*.34;}
            windCrowns.forEach((crown,i)=>{crown.rotation.z=Math.sin(windTime*.65+i*1.7)*.025*breeze;crown.rotation.x=Math.cos(windTime*.48+i)*.014*breeze;});
            flowers.forEach(flower=>{flower.node.rotation.z=Math.sin(windTime*.9+flower.phase)*.10*breeze;});
            if(landscapeRefresh>.14){drawPastoral(windTime);pastoralTexture.needsUpdate=true;landscapeRefresh=0;}
        }
    }
    function setTheme(palette) {
        if (disposed || night === palette.night) return;
        night = palette.night;
        drawPastoral(windTime); pastoralTexture.needsUpdate = true;
    }
    function dispose() {
        if (disposed) return;
        disposed = true;
        owned.forEach(value => { disposeOnce(value); resources.delete(value); });
        owned.clear(); root.removeFromParent();
    }
    return { root, update, setTheme, dispose };
}
