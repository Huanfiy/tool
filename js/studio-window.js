/* Outward-opening casements with a local, animated fantasy countryside view. */
import * as THREE from 'three';

export function createStudioWindow({ scene, box, bar, sphere, group, material, resources, reducedMotion, disposeOnce }) {
    const root = group(scene);
    root.name = 'opening-studio-window';
    root.userData.window = true;
    root.userData.windowOpen = true;
    const owned = new Set();
    let disposed = false, night = false;
    const own = value => { owned.add(value); resources.add(value); return value; };
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

    const openingAngle = Math.PI / 3;
    const casements = [];
    for (const direction of [1, -1]) {
        const leaf = group(root, -5.145, 2.985, direction === 1 ? -2.66 : 2.52);
        const width = 2.58, height = 2.66, centre = direction * width / 2;
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

    const outdoors = group(root);
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
    const pastoralCanvas=document.createElement('canvas');pastoralCanvas.width=1024;pastoralCanvas.height=640;
    const pastoralCtx=pastoralCanvas.getContext('2d');
    function drawPastoral(t=0){
        const w=pastoralCanvas.width,h=pastoralCanvas.height;
        const sky=pastoralCtx.createLinearGradient(0,0,0,h);
        sky.addColorStop(0,night?'#435b70':'#9fd6df');sky.addColorStop(.60,night?'#9ab3ae':'#d7e9cf');sky.addColorStop(1,night?'#607969':'#f3e3b4');
        pastoralCtx.fillStyle=sky;pastoralCtx.fillRect(0,0,w,h);
        // Sun, warm halo and slow cloud strokes.
        const sx=w*.47,sy=h*.20;pastoralCtx.fillStyle=night?'#ffe4a0':'#ffd978';
        pastoralCtx.globalAlpha=.22;pastoralCtx.beginPath();pastoralCtx.arc(sx,sy,h*.17,0,Math.PI*2);pastoralCtx.fill();pastoralCtx.globalAlpha=1;
        pastoralCtx.fillStyle=night?'#fff0b2':'#ffeaa0';pastoralCtx.beginPath();pastoralCtx.arc(sx,sy,h*.078,0,Math.PI*2);pastoralCtx.fill();
        // Soft rays and a few drifting bird marks make the sky read clearly even
        // in the wide room view where the window occupies only a small region.
        pastoralCtx.strokeStyle=night?'#ffe9a544':'#fff5b866';pastoralCtx.lineWidth=5;pastoralCtx.lineCap='round';
        for(let i=0;i<8;i++){const a=i*Math.PI/4+.18;pastoralCtx.beginPath();pastoralCtx.moveTo(sx+Math.cos(a)*h*.09,sy+Math.sin(a)*h*.09);pastoralCtx.lineTo(sx+Math.cos(a)*h*.15,sy+Math.sin(a)*h*.15);pastoralCtx.stroke();}
        pastoralCtx.fillStyle=night?'#dbe6d5a0':'#fffdf0b5';
        for(const [x,y,s] of [[.18,.18,1],[.47,.26,.72],[.84,.31,.9]]){
            const drift=Math.sin(t*.08+x*7)*w*.018;pastoralCtx.beginPath();pastoralCtx.ellipse(w*x+drift,h*y,w*.105*s,h*.028*s,0,0,Math.PI*2);pastoralCtx.fill();
            pastoralCtx.beginPath();pastoralCtx.ellipse(w*x-w*.055+drift,h*y+h*.01,w*.07*s,h*.024*s,0,0,Math.PI*2);pastoralCtx.fill();
        }
        const birdColour=night?'#d7e3d3':'#4d6c6c';
        for(const [x,y,phase,size] of [[.28,.34,.2,1],[.53,.29,1.6,.78],[.76,.40,3.4,.92],[.90,.25,4.8,.60]]){
            const drift=Math.sin(t*.34+phase)*w*.045,cx=w*x+drift,cy=h*y+Math.cos(t*.46+phase)*h*.012,s=size;
            pastoralCtx.strokeStyle=birdColour;pastoralCtx.globalAlpha=night?.72:.88;pastoralCtx.lineWidth=4*s;pastoralCtx.beginPath();
            pastoralCtx.moveTo(cx-w*.025*s,cy);pastoralCtx.quadraticCurveTo(cx-w*.012*s,cy-h*.018*s,cx,cy);
            pastoralCtx.quadraticCurveTo(cx+w*.012*s,cy-h*.018*s,cx+w*.025*s,cy);pastoralCtx.stroke();
        }
        pastoralCtx.globalAlpha=1;
        const hills=[['#83b579',.53],['#679f6c',.63],['#528b62',.76],['#3f7655',.90]];
        hills.forEach(([colour,y],layer)=>{pastoralCtx.fillStyle=night&&layer>1?['#527266','#466356','#385448','#2c443d'][layer]:colour;pastoralCtx.beginPath();pastoralCtx.moveTo(0,h*y);pastoralCtx.bezierCurveTo(w*.17,h*(y-.17),w*.31,h*(y+.10),w*.51,h*(y-.06));pastoralCtx.bezierCurveTo(w*.75,h*(y-.20),w*.87,h*(y+.04),w,h*(y-.08));pastoralCtx.lineTo(w,h);pastoralCtx.lineTo(0,h);pastoralCtx.fill();});
        // Small orchard silhouettes add a recognisable tree line above the fields.
        for(const [x,y,s] of [[.08,.59,1.12],[.89,.57,.90]]){
            pastoralCtx.fillStyle=night?'#3c5b4b':'#735f4e';pastoralCtx.fillRect(w*x-w*.009,h*(y-.01),w*.018,h*.16*s);
            pastoralCtx.fillStyle=night?'#4f7b5c':'#5f9864';
            for(const [dx,dy,r] of [[-.035,-.05,.055],[.02,-.08,.07],[.075,-.03,.052],[.02,.01,.062]]){pastoralCtx.beginPath();pastoralCtx.arc(w*x+w*dx*s,h*y+h*dy*s,h*r*s,0,Math.PI*2);pastoralCtx.fill();}
        }
        // A winding path and tiny cottage make the view read as a lived-in valley.
        pastoralCtx.fillStyle=night?'#756f58':'#dfc78e';pastoralCtx.beginPath();pastoralCtx.moveTo(w*.43,h);pastoralCtx.quadraticCurveTo(w*.56,h*.79,w*.48,h*.68);pastoralCtx.quadraticCurveTo(w*.61,h*.78,w*.70,h);pastoralCtx.fill();
        pastoralCtx.fillStyle=night?'#785a4e':'#d5986b';pastoralCtx.fillRect(w*.18,h*.58,w*.11,h*.08);pastoralCtx.fillStyle=night?'#513f4b':'#9e6250';pastoralCtx.beginPath();pastoralCtx.moveTo(w*.16,h*.58);pastoralCtx.lineTo(w*.235,h*.51);pastoralCtx.lineTo(w*.31,h*.58);pastoralCtx.closePath();pastoralCtx.fill();pastoralCtx.fillStyle='#f0e8bb';pastoralCtx.fillRect(w*.215,h*.61,w*.022,h*.05);pastoralCtx.fillRect(w*.26,h*.61,w*.022,h*.05);
        for(let i=0;i<75;i++){
            const x=(i*83%w),y=h*(.74+((i*47)%170)/1000);pastoralCtx.strokeStyle=night?'#9fbe8855':'#477b5268';pastoralCtx.lineWidth=2;pastoralCtx.beginPath();pastoralCtx.moveTo(x,y+12);pastoralCtx.quadraticCurveTo(x-3,y,x+2,y-9);pastoralCtx.stroke();
            if(i%3===0){pastoralCtx.fillStyle=night?'#d7a3bd':'#e99082';pastoralCtx.beginPath();pastoralCtx.arc(x+3,y-10,4,0,Math.PI*2);pastoralCtx.fill();}
        }
        // Curved rows of crops create depth between the hills and the near grass.
        pastoralCtx.strokeStyle=night?'#b4c99545':'#577d5360';pastoralCtx.lineWidth=3;
        for(let row=0;row<5;row++){const yy=h*(.70+row*.055);pastoralCtx.beginPath();pastoralCtx.moveTo(w*.03,yy);pastoralCtx.quadraticCurveTo(w*.38,yy-h*.025,w*.95,yy-h*.045);pastoralCtx.stroke();}
        pastoralCtx.globalAlpha=1;
    }
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

    let angle = openingAngle, windTime = 0, landscapeRefresh = 0;
    function update(dt, open = true) {
        if (disposed) return false;
        if (!reducedMotion) {
            windTime += Math.max(0, dt);
            landscapeRefresh += Math.max(0, dt);
        }
        const target = open ? openingAngle : 0;
        const moving = Math.abs(angle - target) > .0001;
        angle = reducedMotion ? target : THREE.MathUtils.damp(angle, target, 7, Math.max(0, dt));
        if (Math.abs(angle - target) < .0001) angle = target;
        for (const { leaf, direction } of casements) leaf.rotation.y = -direction * angle;
        const breeze = open ? 1 : .18;
        // Clouds drift slowly, birds glide and flap, while flowers and tree crowns
        // sway at different phases so the view never looks like a looping sprite.
        if (!reducedMotion) {
            for(const cloud of clouds){cloud.node.position.z=cloud.baseZ+Math.sin(windTime*.10+cloud.phase)*.42;cloud.node.position.y=cloud.baseY+Math.sin(windTime*.13+cloud.phase)*.035;}
            for(const bird of birds){bird.node.position.z=bird.baseZ+Math.sin(windTime*.22+bird.phase)*1.25;bird.node.position.y=bird.baseY+Math.sin(windTime*.45+bird.phase)*.18;bird.wingA.rotation.z=.34+Math.sin(windTime*5.2+bird.phase)*.34;bird.wingB.rotation.z=-.34-Math.sin(windTime*5.2+bird.phase)*.34;}
            windCrowns.forEach((crown,i)=>{crown.rotation.z=Math.sin(windTime*.65+i*1.7)*.025*breeze;crown.rotation.x=Math.cos(windTime*.48+i)*.014*breeze;});
            flowers.forEach(flower=>{flower.node.rotation.z=Math.sin(windTime*.9+flower.phase)*.10*breeze;});
            if(landscapeRefresh>.14){drawPastoral(windTime);pastoralTexture.needsUpdate=true;landscapeRefresh=0;}
        }
        root.userData.windowOpen = !!open;
        return moving;
    }
    function setNight(value) {
        if (disposed || night === !!value) return;
        night = !!value;
        drawPastoral(windTime);pastoralTexture.needsUpdate=true;
        photoMaterial.color.set('#ffffff');
        glass.color.set(night ? '#91abc4' : '#c3e0dc');
        glint.opacity = night ? .09 : .20;
    }
    function dispose() {
        if (disposed) return;
        disposed = true;
        owned.forEach(value => { disposeOnce(value); resources.delete(value); });
        owned.clear();
        root.removeFromParent();
    }
    return { root, update, setNight, dispose };
}
