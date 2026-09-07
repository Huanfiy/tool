/* Procedural Three.js lab. No model assets or build step required. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStudioArt } from './studio-art.js';
import { createStudioMonitor } from './studio-monitor.js';
import { createStudioFigures } from './studio-figures.js';
import { createStudioWindow } from './studio-window.js';
import { createStudioLandscape } from './studio-landscape.js';

export function createStudioRoom({ container, state, reducedMotion, onSelect, onFrame, onEvent, onError, onWindowToggle, onReady = () => {} }) {
    const mobile = () => window.innerWidth <= 700;
    const scene = new THREE.Scene();
    const resources = new Set(), released = new WeakSet(), cleanups = [];
    let disposed = false, frameId = null, renderer = null;
    const own = value => { resources.add(value); return value; };
    function disposeOnce(value) {
        if (!value || typeof value.dispose !== 'function' || released.has(value)) return;
        released.add(value);
        if (value.isMaterial) for (const property of Object.values(value)) if (property?.isTexture) disposeOnce(property);
        value.dispose();
    }
    function disposeTree(root) {
        root.traverse(object => {
            disposeOnce(object.geometry);
            for (const mat of Array.isArray(object.material) ? object.material : [object.material]) disposeOnce(mat);
            disposeOnce(object.shadow);
        });
    }
    function listen(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        cleanups.push(() => target.removeEventListener(type, handler, options));
    }
    function dispose() {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(frameId); frameId = null;
        // Stop observers/listeners first, then detach child modules, then release
        // the scene AND cached geometry detached by batching, with one disposer.
        for (const cleanup of cleanups.reverse()) cleanup();
        disposeTree(scene);
        resources.forEach(disposeOnce); resources.clear(); scene.clear();
        renderer?.dispose(); renderer?.domElement.remove();
        container.style.cursor = '';
    }
    try {
    scene.background = new THREE.Color('#eee5d2');
    scene.fog = new THREE.Fog('#eee5d2', 30, 65);
    const wall = { centerX: -5.25, thickness: .16, zMin: -3.8, zMax: 3.8 };
    wall.outerX = wall.centerX - wall.thickness / 2;
    const floor = { top: -.025 + .09 / 2, bottom: -.11 - .13 / 2 };
    const layout = {
        wall, floor,
        opening: { bottom: .76 + 1.55 / 2, top: 5.055 - 1.57 / 2, zMin: -3.16 + 1.25 / 2, zMax: 3.25 - 1.1 / 2 },
        casement: { hingeX: -5.145, width: 2.58, maxAngle: Math.PI / 3, bottom: 1.655, top: 4.315, zMin: -2.66, zMax: 2.52 },
        garden: { xMin: wall.outerX - 6.2, xMax: wall.outerX, zMin: -8, zMax: 8 },
        ground: { top: floor.top - .17, fadeCenter: [wall.outerX - 4.17, 0], fadeRadii: [16, 14] },
        background: { center: [wall.outerX, 0, 0], radius: 80, horizonUV: .5 },
        sunDirection: [-4.4, 7.8, 2.7]
    };
    layout.casement.sweepX = layout.casement.hingeX - layout.casement.width * Math.sin(layout.casement.maxAngle);
    function outdoorPalette(night) {
        return night ? {
            night: true, paper: '#344840', ground: '#526950', crown: '#526c60', grass: '#71876a', bark: '#695f53', stone: '#697767', flower: '#9da9a2',
            sky: '#405960', haze: '#567163', hills: ['#4c655b', '#466052', '#3e594c'], cloud: '#a4b9b1', bird: '#b8c6b6'
        } : {
            night: false, paper: '#eee5d2', ground: '#93a574', crown: '#78a274', grass: '#a4b97e', bark: '#8f7256', stone: '#d0c5ab', flower: '#fff6e3',
            sky: '#b7d8d4', haze: '#dde5cc', hills: ['#becbb1', '#a7bd9b', '#93ad86'], cloud: '#fcf5df', bird: '#6c8077'
        };
    }
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 160);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile() ? 1.35 : 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute('aria-label', '可交互的 3D 嵌入式工作室');
    container.appendChild(renderer.domElement);
    // Keep touch gestures on a sibling of the HTML screen so native app scrolling works.
    const orbitSurface=document.createElement('div');orbitSurface.className='lab-orbit-surface';container.prepend(orbitSurface);
    cleanups.push(() => orbitSurface.remove());
    const controls = new OrbitControls(camera, orbitSurface);
    cleanups.push(() => controls.dispose());
    controls.enableDamping = true;
    controls.dampingFactor = .065;
    controls.enablePan = false;
    controls.minDistance = 3.0;
    controls.maxDistance = 27;
    controls.minPolarAngle = .65;
    controls.maxPolarAngle = 1.48;
    controls.minAzimuthAngle = -.28;
    controls.maxAzimuthAngle = .90;
    controls.rotateSpeed = .30;
    controls.zoomSpeed = .65;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

    const mats = {}, geometries = new Map(), devices = new Map();
    const color = {
        wall: '#f2e7cf', wallSide: '#ece4ca', floor: '#d8bb90', rim: '#a79978', metal: '#737e69', black: '#36473e',
        silver: '#b3b9a6', cream: '#ece4cc', mint: '#b0c79c', teal: '#8dac91', orange: '#c48f6e', darkOrange: '#71543c',
        oak: '#d4af7b', pcb: '#54856a', gold: '#ba9b64', white: '#f5edda', blue: '#91adb5'
    };
    function material(name, options = {}) {
        if (!mats[name]) mats[name] = own(new THREE.MeshStandardMaterial({ color: color[name] || name, roughness: .95, metalness: 0, ...options }));
        return mats[name];
    }
    const m = Object.fromEntries(Object.keys(color).map(k => [k, material(k)]));
    m.silver.metalness = .18; m.silver.roughness = .75; m.gold.metalness = .15;
    m.mintGlow = material('mintGlow', { color: '#c2dfaf', emissive: '#85b57a', emissiveIntensity: .65 });
    m.amberGlow = material('amberGlow', { color: '#ffe4a4', emissive: '#ffcf85', emissiveIntensity: .8 });
    m.blueGlow = material('blueGlow', { color: '#c0dbd6', emissive: '#8fbabc', emissiveIntensity: .5 });
    const leafDark=material('leafDark',{color:'#78965f',side:THREE.DoubleSide}),leafLight=material('leafLight',{color:'#a4bb7c',side:THREE.DoubleSide});
    const inkMaterial = own(new THREE.LineBasicMaterial({color:'#586048',transparent:true,opacity:.24,depthWrite:false}));
    const contourMaterial = own(new THREE.MeshBasicMaterial({color:'#515942',side:THREE.BackSide,transparent:true,opacity:.48,depthWrite:false}));
    const architecture = new THREE.Group(); scene.add(architecture);
    function group(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x,y,z); parent.add(g); return g; }
    function box(parent, w,h,d, x,y,z, mat = m.metal, radius = .025) {
        radius = Math.min(radius, w/3, h/3, d/3);
        const key = `b${w},${h},${d},${radius}`;
        if (!geometries.has(key)) geometries.set(key, own(radius ? new RoundedBoxGeometry(w,h,d,1,radius) : new THREE.BoxGeometry(w,h,d)));
        const obj = new THREE.Mesh(geometries.get(key), mat); obj.position.set(x,y,z); obj.castShadow = true; obj.receiveShadow = true; parent.add(obj);
        // Rounded shells beyond this radius diverge visibly from a straight-edged
        // wireframe, leaving a detached second silhouette; rely on the contour pass.
        if (radius < .04 && w >= .45 && w < 10 && d >= .25 && h >= .08 && h < 1.6) {
            const outlineGeometry = new THREE.BoxGeometry(w-.012,h-.006,d-.012);
            const ink = new THREE.LineSegments(new THREE.EdgesGeometry(outlineGeometry),inkMaterial);
            outlineGeometry.dispose(); ink.userData.ink = true; obj.add(ink);
        }
        return obj;
    }
    function cylinder(parent, r1,r2,h,x,y,z,mat = m.metal, segments = 24) {
        const key = `c${r1},${r2},${h},${segments}`;
        if (!geometries.has(key)) geometries.set(key, own(new THREE.CylinderGeometry(r1,r2,h,segments)));
        const obj = new THREE.Mesh(geometries.get(key), mat); obj.position.set(x,y,z); obj.castShadow=true; obj.receiveShadow=true; parent.add(obj); return obj;
    }
    function sphere(parent,r,x,y,z,mat) { const obj = new THREE.Mesh(own(new THREE.SphereGeometry(r,16,12)),mat); obj.position.set(x,y,z); obj.castShadow=true; parent.add(obj); return obj; }
    function paintedLeaf(parent,w,h,x,y,z,mat){
        const shape=new THREE.Shape();shape.moveTo(0,-h/2);
        shape.bezierCurveTo(w*.62,-h*.23,w*.50,h*.24,0,h/2);
        shape.bezierCurveTo(-w*.45,h*.18,-w*.56,-h*.27,0,-h/2);
        const geometry=new THREE.ShapeGeometry(shape,12),positions=geometry.attributes.position;
        const bend=y=>.055*(1-Math.pow(y/(h/2),2));
        for(let i=0;i<positions.count;i++)positions.setZ(i,bend(positions.getY(i)));
        geometry.computeVertexNormals();
        const leaf=new THREE.Mesh(geometry,mat);leaf.position.set(x,y,z);leaf.receiveShadow=true;parent.add(leaf);
        const edge=shape.getPoints(16),points=[];
        for(let i=1;i<edge.length;i++)points.push(edge[i-1].x,edge[i-1].y,bend(edge[i-1].y)+.003,edge[i].x,edge[i].y,bend(edge[i].y)+.003);
        for(let i=0;i<10;i++){const a=-h/2+i*h/10,b=a+h/10;points.push(0,a,bend(a)+.004,0,b,bend(b)+.004);}
        const ink=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3)),inkMaterial);ink.userData.ink=true;leaf.add(ink);return leaf;
    }
    function bar(parent, start, end, radius, mat) {
        const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), delta = b.clone().sub(a);
        const obj = cylinder(parent,radius,radius,delta.length(),0,0,0,mat,12); obj.position.copy(a.add(b).multiplyScalar(.5)); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); return obj;
    }
    function cable(parent, points, mat=m.black, radius=.025) {
        const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
        const geo = new THREE.TubeGeometry(curve, 32, radius, 6, false);
        const obj = new THREE.Mesh(geo,mat); obj.castShadow=true; parent.add(obj); return obj;
    }
    function canvasTexture(w,h,draw) {
        const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
        const ctx=canvas.getContext('2d'); draw(ctx,w,h);
        const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy()); resources.add(texture);
        return {canvas,ctx,texture};
    }
    function surface(parent,w,h,x,y,z,texture,rotation=0) {
        const mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.FrontSide,toneMapped:false}); resources.add(mat);
        const plane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat); plane.position.set(x,y,z); plane.rotation.x=rotation; parent.add(plane); return plane;
    }
    function textLabel(parent,lines,w,h,x,y,z,options={}) {
        const tex=canvasTexture(768,Math.max(96,Math.round(768*h/w)),(ctx,cw,ch)=>{
            if(options.background){ctx.fillStyle=options.background;ctx.fillRect(0,0,cw,ch);}
            ctx.fillStyle=options.color || '#b5d1c3'; ctx.textBaseline='middle'; ctx.textAlign=options.align||'left';
            const list=Array.isArray(lines)?lines:[lines]; const size=options.size||Math.min(ch/(list.length*1.5),100);
            ctx.font=`${options.bold?'600':'400'} ${size}px ${options.font||'monospace'}`;
            list.forEach((t,i)=>{
                ctx.font=`${options.bold?'600':'400'} ${size}px ${options.font||'monospace'}`;
                const fitted=Math.min(size,size*(cw-30)/Math.max(1,ctx.measureText(t).width));
                ctx.font=`${options.bold?'600':'400'} ${fitted}px ${options.font||'monospace'}`;
                ctx.fillText(t,options.align==='center'?cw/2:15,ch*(i+.5)/list.length);
            });
        });
        return surface(parent,w,h,x,y,z,tex.texture,options.rotation||0);
    }
    function emissiveStrip(parent,w,x,y,z,mat=m.mintGlow){return box(parent,w,.025,.035,x,y,z,mat,.008);}
    // Batch fixed parts by material; animated assemblies remain separate.
    function batch(root) {
        root.updateMatrixWorld(true); const inv = root.matrixWorld.clone().invert(), buckets=new Map();
        // Originals may no longer be reachable from scene after merging.
        root.traverse(obj => { if (obj.geometry) own(obj.geometry); if (obj.material) own(obj.material); });
        const lines=[];root.traverse(obj=>{if(obj.userData.ink)lines.push(obj);});
        if(lines.length){
            const copies=lines.map(obj=>obj.geometry.clone().applyMatrix4(inv.clone().multiply(obj.matrixWorld)));
            const ink=new THREE.LineSegments(mergeGeometries(copies,false),inkMaterial);root.add(ink);
            copies.forEach(disposeOnce);lines.forEach(obj=>{disposeOnce(obj.geometry);obj.removeFromParent();});
        }
        root.traverse(obj=>{if(!obj.isMesh || obj.material.transparent || Array.isArray(obj.material))return;
            const key=obj.material.uuid; if(!buckets.has(key))buckets.set(key,{mat:obj.material,items:[]}); buckets.get(key).items.push(obj);
        });
        buckets.forEach(({mat,items})=>{
            if(items.length<2)return;
            const copies=items.map(obj=>{
                const geometry=obj.geometry.index?obj.geometry.toNonIndexed():obj.geometry.clone();
                return geometry.applyMatrix4(inv.clone().multiply(obj.matrixWorld));
            });
            const merged=mergeGeometries(copies,false); copies.forEach(g=>g.dispose());
            if(!merged)return;
            const mesh=new THREE.Mesh(merged,mat); mesh.castShadow=true; mesh.receiveShadow=true;
            items.forEach(obj=>obj.removeFromParent()); root.add(mesh);
        });
        // One thin, coloured silhouette per fixed assembly, without a full-screen outline pass.
        root.updateMatrixWorld(true);const shells=[];
        root.traverse(obj=>{
            if(!obj.isMesh||obj.material.transparent||Array.isArray(obj.material))return;
            const geometry=obj.geometry.index?obj.geometry.toNonIndexed():obj.geometry.clone();
            geometry.applyMatrix4(inv.clone().multiply(obj.matrixWorld));
            const p=geometry.attributes.position,n=geometry.attributes.normal;
            for(let i=0;i<p.count;i++){p.setXYZ(i,p.getX(i)+n.getX(i)*.008,p.getY(i)+n.getY(i)*.008,p.getZ(i)+n.getZ(i)*.008);}
            shells.push(geometry);
        });
        if(shells.length){const outline=new THREE.Mesh(mergeGeometries(shells,false),contourMaterial);root.add(outline);shells.forEach(g=>g.dispose());}
    }
    function device(id,x,y,z,anchor) {
        const root=group(scene,x,y,z); root.userData.device=id; const fixed=group(root);
        const item={id,root,fixed,anchor:new THREE.Vector3(...anchor)}; devices.set(id,item); return item;
    }
    const glowTexture=canvasTexture(128,128,(ctx,w,h)=>{const g=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(172,255,217,.5)');g.addColorStop(.22,'rgba(107,230,189,.14)');g.addColorStop(1,'rgba(90,220,190,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}).texture;
    let spriteGeometry;
    function glow(parent,x,y,z,scale=.5,tint='#96ffd7') { const mat=new THREE.SpriteMaterial({map:glowTexture,color:tint,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});const obj=new THREE.Sprite(mat);obj.geometry=spriteGeometry||(spriteGeometry=own(obj.geometry.clone()));obj.position.set(x,y,z);obj.scale.setScalar(scale);parent.add(obj);return obj; }
    const shadowTexture=canvasTexture(128,128,(ctx,w,h)=>{const g=ctx.createRadialGradient(w/2,h/2,2,w/2,h/2,w/2);g.addColorStop(0,'rgba(83,77,48,.24)');g.addColorStop(.45,'rgba(83,77,48,.10)');g.addColorStop(1,'rgba(83,77,48,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}).texture;
    function contact(parent,w,d,x,y,z) {const o=surface(parent,w,d,x,y,z,shadowTexture,-Math.PI/2);o.material.depthWrite=false;return o;}

    const art=createStudioArt(canvasTexture);
    art.paper.texture.wrapS=art.paper.texture.wrapT=THREE.RepeatWrapping;art.paper.texture.repeat.set(3,2);
    m.wall.map=art.paper.texture;m.wall.color.set('#ffffff');m.wallSide.map=art.paper.texture;m.wallSide.color.set('#f2f0dc');
    m.oak.map=art.wood.texture;m.oak.color.set('#ffffff');
    m.floor.map=art.floor.texture;m.floor.color.set('#ffffff');
    art.floor.texture.wrapS=art.floor.texture.wrapT=THREE.RepeatWrapping;art.floor.texture.repeat.set(2,1.5);
    const fabric=material('fabric',{color:'#ffffff',map:art.cloth.texture,side:THREE.DoubleSide});
    // A bounded floor and open front keep the complete workspace visible.
    // Catch the diorama's shadow without a lit backdrop edge or a floor behind the window.
    const ground=box(architecture,105,.1,200,47.2,-.24,0,new THREE.ShadowMaterial({color:'#7b7357',opacity:.18,depthWrite:false}),0);ground.castShadow=false;
    box(architecture,10.7,.13,7.7,0,-.11,0,m.oak,.035);
    box(architecture,10.6,.09,7.6,0,floor.top-.09/2,0,m.floor,.025);
    box(architecture,10.65,5.9,.16,0,2.91,-3.82,m.wall,.025);
    box(architecture,wall.thickness,1.55,wall.zMax-wall.zMin,wall.centerX,.76,0,m.wallSide,.02);
    box(architecture,wall.thickness,1.57,wall.zMax-wall.zMin,wall.centerX,5.055,0,m.wallSide,.02);
    box(architecture,wall.thickness,2.95,1.25,wall.centerX,2.95,-3.16,m.wallSide,.02);
    box(architecture,wall.thickness,2.95,1.1,wall.centerX,2.95,3.25,m.wallSide,.02);
    box(architecture,10.6,.18,.09,0,.1,-3.65,m.oak);
    box(architecture,.09,.18,7.6,-5.1,.1,0,m.oak);
    box(architecture,.40,.11,5.45,-5.02,1.58,-.05,m.oak);
    const studioWindow=createStudioWindow({box,bar,group,material,reducedMotion,disposeOnce,layout});
    scene.add(studioWindow.root);
    cleanups.push(() => { disposeTree(studioWindow.root); studioWindow.dispose(); });
    const landscape=createStudioLandscape({layout,palette:outdoorPalette(false),compact:mobile(),disposeOnce});
    scene.add(landscape.root);
    cleanups.push(() => landscape.dispose());
    for(const leaf of studioWindow.root.children)if(leaf.name.endsWith('-casement'))batch(leaf);
    bar(architecture,[-4.91,4.50,-2.97],[-4.91,4.50,2.87],.026,m.oak);
    sphere(architecture,.07,-4.91,4.50,-2.98,m.oak);sphere(architecture,.07,-4.91,4.50,2.88,m.oak);
    const curtains=[];
    for(const [z,width] of [[-2.31,.82],[2.16,.92]]){
        const geo=new THREE.PlaneGeometry(width,2.88,14,18),positions=geo.attributes.position;
        for(let i=0;i<positions.count;i++){
            const u=positions.getX(i)/width+.5,v=(positions.getY(i)+1.44)/2.88;
            positions.setZ(i,Math.sin(u*Math.PI*7)*.075);
            positions.setY(i,positions.getY(i)+Math.cos(u*Math.PI*7)*.025*(1-v));
        }
        geo.computeVertexNormals();
        const curtain=new THREE.Mesh(geo,fabric);curtain.position.set(-4.88,2.98,z);curtain.rotation.y=Math.PI/2;curtain.receiveShadow=true;scene.add(curtain);
        curtains.push({mesh:curtain,base:new Float32Array(positions.array)});
        for(let j=0;j<6;j++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.041,.009,5,10),m.oak);ring.position.set(-4.91,4.48,z-width/2+j*width/5);ring.rotation.y=Math.PI/2;architecture.add(ring);}
    }
    const sunPatch=surface(scene,5.7,4.4,-.85,.042,.7,art.sunlight.texture,-Math.PI/2);sunPatch.rotation.z=-.42;sunPatch.material.depthWrite=false;
    const carpet=surface(architecture,4.8,3.1,.25,.038,1.15,art.rug.texture,-Math.PI/2);
    carpet.material=new THREE.MeshStandardMaterial({map:art.rug.texture,transparent:true,roughness:1,depthWrite:false});carpet.receiveShadow=true;
    // Pegboard and component shelving.
    box(architecture,2.45,1.25,.09,-3.52,3.31,-3.67,m.rim);
    for(let x=-4.65;x<-2.35;x+=.18)for(let y=2.78;y<3.85;y+=.17){const hole=cylinder(architecture,.016,.016,.007,x,y,-3.61,m.silver,6);hole.rotation.x=Math.PI/2;}
    // Pegboard: five familiar hand tools have distinct silhouettes and hanging details.
    const toolSteel=material('toolSteel',{color:'#aeb7a5',metalness:.48,roughness:.38});
    const toolDark=material('toolDark',{color:'#293934',roughness:.64});
    const toolRed=material('toolRed',{color:'#cf735d',roughness:.78});
    const toolYellow=material('toolYellow',{color:'#e1b55e',roughness:.76});
    const peg=(x,y)=>{cylinder(architecture,.024,.024,.055,x,y,-3.56,toolSteel,10).rotation.x=Math.PI/2;};
    // Scissors, with two torus finger loops and crossed blades.
    const scissors=group(architecture,-4.42,3.28,-3.52);peg(-4.42,3.62);
    for(const side of [-1,1]){
        const loop=new THREE.Mesh(new THREE.TorusGeometry(.105,.023,8,18),toolRed);loop.position.set(side*.09,-.12,0);scissors.add(loop);
        bar(scissors,[side*.055,-.03,.02],[side*.30,.30,.02],.018,toolSteel);
        const pivot=sphere(scissors,.027,0,.02,.035,toolDark);pivot.castShadow=true;
    }
    // Phillips screwdriver: knurled handle, shaft, and a cross tip.
    const driver=group(architecture,-3.91,3.31,-3.53);peg(-3.91,3.70);
    cylinder(driver,.105,.12,.27,0,-.05,0,toolRed,16);cylinder(driver,.055,.055,.35,0,.24,0,toolSteel,10);
    bar(driver,[-.025,.42,.01],[.025,.49,.01],.012,toolDark);bar(driver,[0,.45,-.035],[0,.45,.035],.012,toolDark);
    // Diagonal cutters: two rubber handles, pivot, and short jaws.
    const cutters=group(architecture,-3.39,3.30,-3.52);peg(-3.39,3.67);
    for(const side of [-1,1]){
        bar(cutters,[0,-.02,0],[side*.12,-.32,.01],.036,toolRed);
        bar(cutters,[0,.03,.01],[side*.16,.30,.01],.021,toolSteel);
    }
    sphere(cutters,.042,0,.02,.04,toolDark);
    // Utility knife: molded body, thumb slider, and exposed blade.
    const knife=group(architecture,-2.89,3.30,-3.53);peg(-2.89,3.66);
    box(knife,.22,.40,.11,0,-.02,0,toolYellow,.035);box(knife,.07,.11,.125,0,.08,.02,toolDark,.012);
    box(knife,.055,.22,.035,0,.29,0,toolSteel,.006);box(knife,.03,.075,.05,0,.43,0,toolSteel,.004);
    // Multimeter: casing, screen, dial, test sockets and two hanging probes.
    const meter=group(architecture,-2.49,3.29,-3.52);peg(-2.49,3.74);
    box(meter,.38,.57,.13,0,0,0,m.orange,.035);box(meter,.26,.15,.012,0,.13,.072,m.black,.008);
    textLabel(meter,['VΩmA','DMM'],.22,.10,0,.145,.082,{size:29,color:'#9fdec0',align:'center',font:'monospace'});
    cylinder(meter,.065,.065,.018,0,-.07,.078,toolDark,16).rotation.x=Math.PI/2;
    for(const x of [-.10,.10]){cylinder(meter,.025,.025,.02,x,-.20,.08,toolRed,12).rotation.x=Math.PI/2;bar(meter,[x,-.22,.07],[x*1.6,-.49,.06],.009,x<0?toolRed:toolSteel);}
    for (const [cx,width] of [[-3.47,2.55],[3.36,3.0]]) {
        box(architecture,width,.10,cx>0?.78:.57,cx,4.21,cx>0?-3.42:-3.46,m.oak);
        emissiveStrip(architecture,width-.16,cx,4.145,-3.22,m.amberGlow);
        for(const offset of [-width*.36,width*.36])bar(architecture,[cx+offset,3.96,-3.68],[cx+offset,4.16,-3.25],.025,m.black);
    }
    // Left shelf: individually modeled books with raised spines, page blocks, bands and titles.
    const bookSpines=['刻意练习','我们为什么要睡觉','foc 原理','嵌入式设计','信号与系统'];
    const bookColors=[m.teal,m.orange,m.blue,m.cream,m.mint];
    const bookInk=['#f7efd9','#fff2d8','#eef1df','#31453a','#31453a'];
    const bookXs=[-4.40,-4.02,-3.64,-3.25,-2.84];
    const bookHeights=[.63,.70,.56,.66,.58];
    bookSpines.forEach((title,i)=>{
        const book=group(architecture,bookXs[i],4.53,-3.42);book.rotation.z=(i===1?.055:i===3?-.035:0);
        const h=bookHeights[i],w=i===1?.28:i===2?.23:.25;
        box(book,w,h,.39,0,0,0,bookColors[i],.012);
        // Recessed page block, raised spine ridge and cover bands keep each book
        // readable as a bound volume instead of a row of coloured boxes.
        box(book,w-.045,.025,.34,0,h/2-.028,.015,m.cream,.004);
        box(book,.022,h-.065,.34,w/2-.025,-.006,.015,m.cream,.003);
        box(book,.026,h-.08,.025,-w/2+.026,0,.217,bookColors[(i+2)%bookColors.length],.003);
        const titlePlane=textLabel(book,title,h-.12,w-.075,0,0,.222,{size:145,color:bookInk[i],align:'center',bold:true,font:'Microsoft YaHei, sans-serif'});
        titlePlane.rotation.z=-Math.PI/2;
        for(const y of [-h*.39,h*.39])bar(book,[-w/2+.032,y,.222],[w/2-.032,y,.222],.005,material(`bookInk:${bookInk[i]}`,{color:bookInk[i]}));
    });
    const shelfFigures=createStudioFigures({parent:architecture,box,cylinder,sphere,bar,group,material});
    shelfFigures.position.set(3.36,4.26,-3.43);
    // An L-shaped walnut workbench on rear cantilever frames, with a clear knee space.
    const wood=art.wood.texture;
    wood.wrapS=wood.wrapT=THREE.RepeatWrapping;wood.repeat.set(3,1);
    const deskMat=material('desktop',{color:'#94765b',map:wood,roughness:.85});
    const deskSteel=material('deskSteel',{color:'#35413d',roughness:.72,metalness:.22});
    function strut(parent,start,end,w=.10,d=.10){
        const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),delta=b.clone().sub(a);
        const beam=box(parent,w,delta.length(),d,0,0,0,deskSteel,.012);
        beam.position.copy(a.add(b).multiplyScalar(.5));
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
        return beam;
    }
    box(architecture,9.4,.18,1.88,-.25,1.68,-2.65,deskMat,.045);
    box(architecture,9.25,.12,.10,-.25,1.51,-1.86,deskSteel);
    box(architecture,9.25,.12,.10,-.25,1.51,-3.44,deskSteel);
    box(architecture,9.20,.09,.09,-.25,.52,-3.43,deskSteel);
    for(const x of [-4.70,-.65,4.18]){
        box(architecture,.13,1.49,.13,x,.79,-3.43,deskSteel);
        box(architecture,.28,.07,.38,x,.055,-3.40,deskSteel);
        box(architecture,.11,.12,1.62,x,1.51,-2.65,deskSteel);
        strut(architecture,[x,.91,-3.43],[x,1.51,-2.08]);
        for(const y of [.65,1.40])cylinder(architecture,.03,.03,.015,x,y,-3.351,m.silver,8).rotation.x=Math.PI/2;
    }
    contact(architecture,9.8,2.7,-.25,.036,-2.47);
    // ESD desk mat and signal-routing cable.
    box(architecture,3.40,.016,1.35,-.30,1.784,-2.5,m.teal,.07);
    textLabel(architecture,'a work in progress',1.05,.08,-1.15,1.795,-1.89,{rotation:-Math.PI/2,color:'#dce0be',font:'Georgia, serif'});
    cable(architecture,[[-2.4,1.80,-2.2],[-2.2,1.82,-1.84],[-1.4,1.84,-1.85],[-1.27,1.85,-2.2]],m.orange,.014);

    // Keep the 16:9 desktop full-size, with a uniform, near-borderless rim.
    const monitor=device('monitor',.30,1.79,-2.86,[.30,4.02,-2.80]);
    const monitorScreen={width:3.60,height:2.025,y:1.22,z:.035},monitorBezel=.018;
    box(monitor.fixed,.70,.035,.45,0,.025,0,deskSteel);
    box(monitor.fixed,.095,.66,.08,0,.35,-.12,deskSteel);
    // Deliberately outside fixed: batch()'s expanded ink shell creates a second
    // silhouette around this thin panel, making the live screen look misaligned.
    const monitorFrame=material('monitorFrame',{color:'#1b2927',roughness:.28,metalness:.3,emissive:'#a7e9dd',emissiveIntensity:.025});
    const monitorPanel=box(monitor.root,monitorScreen.width+2*monitorBezel,monitorScreen.height+2*monitorBezel,.065,0,monitorScreen.y,0,monitorFrame,.012);
    monitorPanel.name='monitor-panel';
    const liveMonitor=createStudioMonitor({container,camera,monitor:monitor.root,...monitorScreen});
    cleanups.push(() => liveMonitor.dispose());
    const keyboard=group(architecture,.28,1.84,-1.99);
    box(keyboard,1.69,.08,.52,0,0,0,m.black,.04);
    box(keyboard,1.61,.01,.44,0,.05,0,m.silver,.025);
    for(let row=0;row<5;row++)for(let col=0;col<15;col++){
        if(row===4 && col>3 && col<10)continue;
        const key=box(keyboard,row===4&&col===3?.70:.085,.035,.063,-.73+col*.104,.072,-.185+row*.084,(col===0||col===14)?m.orange:(row===0?m.teal:m.cream),.01);
        if(row===4&&col===3)key.position.x=-.09;
    }
    // A ceramic mug with a real handle and visible coffee.
    cylinder(architecture,.14,.12,.27,1.94,1.93,-2.55,m.cream);
    cylinder(architecture,.117,.117,.007,1.94,2.07,-2.55,m.darkOrange);
    const mugHandle=new THREE.Mesh(new THREE.TorusGeometry(.105,.025,8,18),m.cream);mugHandle.position.set(2.08,1.94,-2.55);architecture.add(mugHandle);
    textLabel(architecture,'slow',.14,.07,1.94,1.94,-2.412,{font:'Georgia, serif',color:'#9b7755',align:'center'});
    // An open notebook, a pencil and a small board of unfinished ideas.
    const notebook=group(architecture,2.68,1.81,-1.99);notebook.rotation.y=-.13;
    box(notebook,.92,.035,.60,0,0,0,m.cream,.012);
    const notebookArt=canvasTexture(768,512,(ctx,w,h)=>{
        ctx.fillStyle='#f8efda';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#c4b68f';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(w/2,12);ctx.lineTo(w/2,h-12);ctx.stroke();
        ctx.fillStyle='#777954';ctx.font='italic 30px Georgia';ctx.fillText('little ideas',32,62);
        ctx.strokeStyle='#758669';ctx.lineWidth=3;ctx.strokeRect(55,152,120,112);ctx.strokeRect(230,170,95,70);
        for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(175,175+i*20);ctx.lineTo(230,175+i*20);ctx.stroke();}
        ctx.fillStyle='#a77d54';ctx.font='22px monospace';ctx.fillText('STM32',73,215);ctx.fillText('SOIL',248,212);
        ctx.strokeStyle='#aea588';ctx.lineWidth=1;
        for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(422,95+i*44);ctx.lineTo(721-i%3*36,95+i*44);ctx.stroke();}
        ctx.strokeStyle='#708a66';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(445,401);ctx.bezierCurveTo(475,315,505,490,540,396);ctx.bezierCurveTo(580,302,610,485,653,388);ctx.stroke();
    });
    surface(notebook,.88,.57,0,.021,0,notebookArt.texture,-Math.PI/2);
    bar(notebook,[-.10,.043,-.20],[.26,.043,.17],.015,m.orange);
    bar(notebook,[.26,.043,.17],[.31,.043,.22],.009,m.darkOrange);

    // Development board: daughterboard, standoffs, chip pins, headers and blinking status LEDs.
    const pcb=device('pcb',-1.55,1.82,-2.38,[-1.55,2.40,-2.28]);
    box(pcb.fixed,1.0,.045,.81,0,0,0,m.black,.025);
    const pcbAssembly=group(pcb.root);box(pcbAssembly,.91,.035,.70,0,.05,0,m.pcb,.015);
    for(const x of [-.40,.40])for(const z of [-.28,.28]){cylinder(pcbAssembly,.026,.026,.056,x,.047,z,m.gold,12);}
    const processor=group(pcb.root,0,.11,0);box(processor,.26,.055,.27,0,0,0,m.black,.008);
    for(let i=0;i<9;i++)for(const side of [-1,1]){
        box(processor,.012,.014,.045,-.105+i*.026,-.016,side*.148,m.silver,.002);
        box(processor,.045,.014,.012,side*.148,-.016,-.105+i*.026,m.silver,.002);
    }
    textLabel(processor,['STM32','H743'],.18,.11,0,.029,0,{rotation:-Math.PI/2,color:'#c4d6c4',align:'center',size:46});
    const boardTop=group(pcb.root);
    for(const z of [-.28,.28]){
        box(boardTop,.65,.065,.09,0,.115,z,m.black,.008);
        for(let i=0;i<16;i++)box(boardTop,.014,.019,.014,-.29+i*.039,.155,z,m.gold,.002);
    }
    box(boardTop,.12,.08,.17,-.40,.095,0,m.silver,.009);box(boardTop,.016,.04,.10,-.462,.092,0,m.black,.005);
    for(let i=0;i<11;i++){
        box(boardTop,.07,.04,.045,-.3+(i%4)*.18,.09,-.18+Math.floor(i/4)*.15,i%3?m.cream:m.black,.005);
    }
    for(let i=0;i<8;i++)bar(pcbAssembly,[-.31+i*.085,.072,-.22],[-.20+i*.06,.072,.18],.003,m.gold);
    const boardLed=box(boardTop,.035,.02,.035,.34,.10,.08,m.mintGlow,.004);
    glow(pcb.root,.34,.14,.08,.23);
    const boardOLED=canvasTexture(256,128,()=>{});const oledPlane=surface(pcb.root,.25,.125,.28,.112,-.115,boardOLED.texture,-Math.PI/2);

    // Oscilloscope and bench power supply.
    const scope=device('scope',-3.23,1.81,-2.90,[-3.20,2.83,-2.90]);
    box(scope.fixed,1.27,.75,.63,0,.39,0,m.cream,.065);
    box(scope.fixed,.88,.56,.035,-.13,.43,.325,m.black,.025);
    const scopeTex=canvasTexture(512,320,()=>{});surface(scope.root,.81,.49,-.13,.43,.347,scopeTex.texture);
    for(let row=0;row<3;row++)for(let col=0;col<2;col++){
        const knob=cylinder(scope.fixed,row===0?.065:.042,row===0?.065:.042,.04,.41+col*.135,.58-row*.16,.34,col?m.silver:m.metal,18);knob.rotation.x=Math.PI/2;
    }
    for(let i=0;i<4;i++){const port=cylinder(scope.fixed,.038,.038,.055,-.36+i*.20,.11,.35,[m.amberGlow,m.blueGlow,m.silver,m.silver][i],16);port.rotation.x=Math.PI/2;}
    // Model badge sits low beside the ports, clear of the supply resting on top.
    textLabel(scope.fixed,'SIGNAL / DSO',.26,.06,.44,.105,.321,{color:'#29463e',size:58,align:'center'});
    box(scope.fixed,.16,.065,.49,-.46,-.02,.02,m.black);box(scope.fixed,.16,.065,.49,.46,-.02,.02,m.black);
    cable(architecture,[[-3.58,1.93,-2.55],[-3.7,1.80,-2.05],[-2.6,1.80,-1.82],[-1.4,1.93,-2.2]],m.gold,.014);
    box(architecture,1.10,.30,.64,-3.22,2.725,-2.98,m.metal,.035);
    textLabel(architecture,['DC POWER','05.00 V   0.32 A'],.70,.16,-3.30,2.75,-2.65,{size:53,color:'#a7eace',background:'#122c2b'});
    const psuKnob=cylinder(architecture,.06,.06,.04,-2.78,2.74,-2.64,m.orange);psuKnob.rotation.x=Math.PI/2;

    // Soldering station and its automatic extraction fan.
    const solder=device('solder',-3.72,1.80,-1.94,[-4.02,2.31,-1.45]);
    box(solder.fixed,.55,.26,.44,0,.13,0,m.black,.04);
    const solderTex=canvasTexture(256,96,()=>{});surface(solder.root,.30,.11,-.055,.15,.225,solderTex.texture);
    const ironKnob=cylinder(solder.fixed,.055,.055,.05,.19,.13,.24,m.orange);ironKnob.rotation.x=Math.PI/2;
    cable(solder.fixed,[[.26,.10,.05],[.41,.03,.35],[.69,.05,.20],[.73,.25,.01]],m.black,.017);
    box(solder.fixed,.22,.055,.38,.72,.025,0,m.metal);
    bar(solder.fixed,[.73,.06,-.11],[.73,.36,.02],.045,m.silver);
    bar(solder.fixed,[.73,.25,.00],[.73,.55,.13],.055,m.orange);
    bar(solder.fixed,[.73,.51,.12],[.73,.70,.21],.014,m.silver);
    const extractor=group(solder.root,-.7,.34,-.10);box(extractor,.45,.43,.18,0,0,0,m.metal,.035);
    // Dark intake behind the blades, then a round wire guard: two rings and six spokes.
    const intake=cylinder(extractor,.175,.175,.012,0,0,.094,m.black,28);intake.rotation.x=Math.PI/2;
    const rotor=group(extractor,0,0,.102);
    for(let i=0;i<5;i++){const blade=box(rotor,.16,.067,.014,0,0,0,m.silver,.018);blade.position.set(Math.cos(i*Math.PI*2/5)*.10,Math.sin(i*Math.PI*2/5)*.10,0);blade.rotation.z=i*Math.PI*2/5+.7;}
    const fanHub=cylinder(extractor,.052,.052,.035,0,0,.119,m.black);fanHub.rotation.x=Math.PI/2;
    for(const r of [.175,.10]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.007,6,36),m.black);ring.position.z=.14;extractor.add(ring);}
    for(let i=0;i<6;i++){const a=i*Math.PI/3;bar(extractor,[Math.cos(a)*.045,Math.sin(a)*.045,.14],[Math.cos(a)*.175,Math.sin(a)*.175,.14],.006,m.black);}
    bar(solder.fixed,[-.7,.08,-.1],[-.7,.30,-.1],.03,m.silver);
    const smokeGeo=new THREE.BufferGeometry(),smokeArray=new Float32Array(18*3);smokeGeo.setAttribute('position',new THREE.BufferAttribute(smokeArray,3));
    const smoke=new THREE.Points(smokeGeo,new THREE.PointsMaterial({color:'#b7cfc3',size:.085,map:glowTexture,transparent:true,opacity:.24,depthWrite:false}));solder.root.add(smoke);

    // FDM printer stands on its own rubber feet at the front of the window wall.
    const printer=device('printer',-4.15,-.78,3.0,[-4.15,2.8,3.0]);
    for(const x of [-.56,.56])for(const z of [-.50,.50])cylinder(printer.fixed,.075,.075,.10,x,.86,z,m.black,12);
    box(printer.fixed,1.45,.28,1.35,0,1.03,0,m.black,.065);
    box(printer.fixed,1.43,.24,.10,0,1.07,.69,m.orange,.035);
    for(const x of [-.68,.68])for(const z of [-.59,.59]){
        box(printer.fixed,.08,1.93,.08,x,2.07,z,m.metal,.015);
        bar(printer.fixed,[x*.85,1.18,z*.87],[x*.85,2.96,z*.87],.018,m.silver);
        box(printer.fixed,.13,.14,.15,x,2.96,z,m.orange,.018);
    }
    box(printer.fixed,1.45,.09,.08,0,3.02,.59,m.metal);
    box(printer.fixed,1.45,.09,.08,0,3.02,-.59,m.metal);
    for(const x of [-.68,.68])box(printer.fixed,.08,.09,1.20,x,3.02,0,m.metal);
    box(printer.fixed,1.12,.055,1.03,0,1.33,0,m.silver,.018);
    box(printer.fixed,1.08,.015,.99,0,1.366,0,m.black,.012);
    textLabel(printer.fixed,'one layer at a time',.95,.12,0,1.08,.747,{size:69,color:'#594c39',align:'center',font:'Georgia, serif'});
    const gantry=group(printer.root,0,1.68,0);
    box(gantry,1.30,.08,.10,0,0,-.10,m.silver,.012);
    for(const x of [-.66,.66])box(gantry,.16,.19,.25,x,0,-.10,m.black,.015);
    const printHead=group(gantry);
    box(printHead,.28,.30,.27,0,-.08,-.08,m.orange,.035);
    box(printHead,.17,.17,.04,0,-.04,.075,m.black,.025);
    cylinder(printHead,.08,.08,.02,0,-.04,.104,m.silver,16).rotation.x=Math.PI/2;
    cylinder(printHead,.047,.014,.09,0,-.275,-.08,m.gold,12);
    glow(printHead,0,-.3,-.08,.38,'#ffc580');
    const spool=group(printer.fixed,0,3.18,-.12);
    const roll=cylinder(spool,.32,.32,.24,0,.13,0,m.cream,32);roll.rotation.z=Math.PI/2;
    for(const x of [-.14,.14]){const rim=cylinder(spool,.37,.37,.03,x,.13,0,m.orange,32);rim.rotation.z=Math.PI/2;}
    bar(printer.fixed,[-.30,3.02,-.12],[-.30,3.33,-.12],.035,m.black);
    const filamentPositions=new Float32Array(25*3);
    const filamentGeometry=new THREE.BufferGeometry();filamentGeometry.setAttribute('position',new THREE.BufferAttribute(filamentPositions,3));
    const filament=new THREE.Line(filamentGeometry,new THREE.LineBasicMaterial({color:'#e8e2cc'}));printer.root.add(filament);
    emissiveStrip(printer.fixed,1.17,0,2.96,-.48,m.amberGlow);
    const printPart=group(printer.root,0,1.38,0);
    const partMat=material('printed',{color:'#81c6b0',roughness:.78});
    // A fluted enclosure: horizontal bands visibly reveal the layers being printed.
    for(let i=0;i<30;i++){
        const shape=new THREE.Shape(),radius=.245+.04*Math.sin(i*.23);
        for(let j=0;j<=6;j++){const a=j*Math.PI/3;j?shape.lineTo(Math.cos(a)*radius,Math.sin(a)*radius):shape.moveTo(radius,0);}
        if(i>1){const hole=new THREE.Path();for(let j=0;j<=6;j++){const a=-j*Math.PI/3;j?hole.lineTo(Math.cos(a)*(radius-.06),Math.sin(a)*(radius-.06)):hole.moveTo(radius-.06,0);}shape.holes.push(hole);}
        const band=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.019,bevelEnabled:false,steps:1}),partMat);band.rotation.x=-Math.PI/2;band.position.y=i*.02;band.castShadow=true;band.receiveShadow=true;printPart.add(band);
    }
    const printerTex=canvasTexture(256,112,()=>{});surface(printer.root,.38,.16,.44,1.069,.751,printerTex.texture);
    contact(printer.fixed,1.9,1.8,0,.815,0);

    // Robotics island with a brushless-motor dynamometer and articulated pick-and-place arm.
    const island=group(architecture,-.55,0,1.49);
    box(island,3.72,.18,1.82,.05,1.20,0,deskMat,.045);
    // The open edge carries a shallow rail; all legs and low stretchers stay against the wall.
    for(const z of [-.77,.77])box(island,3.72,.12,.10,0,1.03,z,deskSteel);
    box(island,3.72,.09,.09,0,.04,.77,deskSteel);
    for(const x of [-1.63,1.64]){
        box(island,.13,1.45,.13,x,.30,.77,deskSteel);
        box(island,.30,.07,.31,x,-.425,.77,deskSteel);
        box(island,.11,.12,1.56,x,1.03,0,deskSteel);
        strut(island,[x,.42,.77],[x,1.03,-.60]);
    }
    const motor=device('motor',.65,1.30,1.64,[.80,2.29,1.95]);
    box(motor.fixed,1.35,.06,1.17,0,0,0,m.black,.045);
    for(const x of [-.50,.50])for(const z of [-.41,.41])cylinder(motor.fixed,.037,.037,.03,x,.04,z,m.silver,12);
    box(motor.fixed,.54,.065,.60,.03,.08,-.03,m.silver);
    cylinder(motor.fixed,.24,.27,.16,.03,.19,-.03,m.black,24);
    for(let i=0;i<12;i++){
        const a=i*Math.PI/6;bar(motor.fixed,[.03+Math.cos(a)*.16,.16,-.03+Math.sin(a)*.16],[.03+Math.cos(a)*.16,.37,-.03+Math.sin(a)*.16],.035,m.gold);
    }
    const motorRotor=group(motor.root,.03,.40,-.03);
    cylinder(motorRotor,.225,.225,.10,0,0,0,m.silver,24);
    cylinder(motorRotor,.058,.058,.18,0,.10,0,m.black);
    for(let i=0;i<3;i++){
        const blade=box(motorRotor,.47,.035,.10,0,.20,0,m.orange,.03);blade.position.set(Math.cos(i*Math.PI*2/3)*.22,.20,Math.sin(i*Math.PI*2/3)*.22);blade.rotation.y=-i*Math.PI*2/3;
    }
    const guard=new THREE.Mesh(new THREE.TorusGeometry(.51,.012,6,48),m.silver);guard.rotation.x=Math.PI/2;guard.position.set(.03,.63,-.03);motor.fixed.add(guard);
    for(const x of [-.43,.49])bar(motor.fixed,[x,.04,-.03],[x,.63,-.03],.012,m.silver);
    cable(motor.fixed,[[-.13,.17,.05],[-.30,.04,.27],[-.45,.08,.34]],m.orange,.015);
    const motorTex=canvasTexture(256,112,()=>{});surface(motor.root,.42,.19,-.39,.045,.38,motorTex.texture,-Math.PI/2);
    const arm=device('arm',-1.65,1.31,1.45,[-1.70,2.75,1.30]);
    box(arm.fixed,1.60,.06,1.36,0,0,0,m.teal,.06);
    cylinder(arm.fixed,.29,.33,.13,0,.10,0,m.black);
    const armYaw=group(arm.root,0,.20,0);
    cylinder(armYaw,.245,.245,.16,0,.015,0,m.orange);
    const shoulder=group(armYaw,0,.12,0);
    const armJoint=(parent,x,y,z,r)=>{const obj=cylinder(parent,r,r,.26,x,y,z,m.metal);obj.rotation.x=Math.PI/2;const cap=cylinder(parent,r*.67,r*.67,.275,x,y,z,m.silver);cap.rotation.x=Math.PI/2;};
    armJoint(shoulder,0,0,0,.18);
    box(shoulder,.25,.85,.20,0,.45,0,m.orange,.08);box(shoulder,.13,.52,.215,0,.48,0,m.cream,.035);
    const elbow=group(shoulder,0,.90,0);armJoint(elbow,0,0,0,.155);
    box(elbow,.19,.71,.18,0,.38,0,m.orange,.055);box(elbow,.08,.41,.195,0,.40,0,m.cream,.03);
    const wrist=group(elbow,0,.78,0);armJoint(wrist,0,0,0,.11);
    const gripper=group(wrist);box(gripper,.19,.15,.19,0,.13,0,m.black);
    const jawA=box(gripper,.035,.17,.12,-.08,.27,0,m.silver,.007);const jawB=box(gripper,.035,.17,.12,.08,.27,0,m.silver,.007);
    const carried=box(gripper,.10,.08,.10,0,.34,0,m.pcb,.008);carried.visible=false;
    cable(shoulder,[[0,.02,-.18],[.18,.35,-.18],[.16,.75,-.18],[0,.93,-.17]],m.black,.023);
    box(arm.fixed,.24,.045,.23,-.64,.06,.30,m.cream);
    const pickupPart=box(arm.root,.13,.07,.12,-.64,.11,.30,m.pcb,.009);
    box(arm.fixed,.36,.05,.40,.56,.05,-.40,m.black);
    for(let i=0;i<4;i++)box(arm.fixed,.10,.045,.10,.47+(i%2)*.14,.10,-.51+Math.floor(i/2)*.15,m.pcb,.008);
    const deliveredPart=box(arm.root,.13,.07,.12,.56,.15,-.40,m.pcb,.009);deliveredPart.visible=false;

    // Move the entire robotics bench to the window wall, leaving the centre of the room open.
    const wingTransform=new THREE.Matrix4().makeTranslation(-4.05,.48,.10)
        .multiply(new THREE.Matrix4().makeRotationY(-Math.PI/2))
        .multiply(new THREE.Matrix4().makeTranslation(.55,0,-1.49));
    for(const object of [island,motor.root,arm.root])object.applyMatrix4(wingTransform);
    for(const item of [motor,arm])item.anchor.applyMatrix4(wingTransform);
    contact(architecture,2.4,4.8,-4.05,.035,.1);

    // Compact network rack below the far end of the workbench.
    // The tower sits beside the desktop's outer end, leaving every rear leg visible.
    const rack=group(architecture,4.72,0,-2.42);
    box(rack,.62,1.25,.86,0,.67,0,m.black,.06);
    for(let i=0;i<4;i++){
        box(rack,.53,.20,.025,0,.27+i*.265,.444,m.metal,.018);
        for(let j=0;j<6;j++)box(rack,.018,.095,.016,-.19+j*.057,.28+i*.265,.462,m.black,.003);
        sphere(rack,.018,.22,.29+i*.265,.47,i%2?m.mintGlow:m.amberGlow);
    }
    box(rack,.46,.06,.32,0,1.34,0,m.silver);
    for(const x of [-.19,.19])bar(rack,[x,1.35,-.10],[x,1.73,-.13],.018,m.black);
    const poster=group(architecture,3.53,3.19,-3.70);poster.rotation.z=.018;
    box(poster,1.78,1.18,.055,0,0,0,m.oak,.035);
    const memoArt=canvasTexture(768,512,(ctx,w,h)=>{
        ctx.fillStyle='#bb9e72';ctx.fillRect(0,0,w,h);
        ctx.save();ctx.translate(55,56);ctx.rotate(-.07);ctx.fillStyle='#f6e6b2';ctx.fillRect(0,0,265,350);
        ctx.fillStyle='#6b7251';ctx.font='italic 36px Georgia';ctx.fillText('stay curious.',20,65);ctx.font='23px Georgia';
        ['read a little','make a little','grow a little'].forEach((t,i)=>ctx.fillText(t,25,145+i*58));ctx.fillStyle='#b88359';ctx.beginPath();ctx.arc(135,8,9,0,Math.PI*2);ctx.fill();ctx.restore();
        ctx.fillStyle='#e3e8cd';ctx.fillRect(388,88,300,256);ctx.strokeStyle='#758663';ctx.lineWidth=4;
        ctx.beginPath();ctx.moveTo(430,216);for(let x=0;x<210;x++)ctx.lineTo(430+x,216-Math.sin(x*.055)*48);ctx.stroke();
        ctx.fillStyle='#708161';ctx.font='20px monospace';ctx.fillText('a good signal :)',422,308);
        ctx.fillStyle='#b5bd8c';ctx.fillRect(470,74,110,25);
    });
    surface(poster,1.66,1.06,0,0,.032,memoArt.texture);
    // A botanical sketch, taped beside the monitor.
    const sketch=canvasTexture(256,384,(ctx,w,h)=>{
        ctx.fillStyle='#f4ecd5';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#718164';ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(119,291);ctx.quadraticCurveTo(90,160,143,55);ctx.stroke();
        for(let i=0;i<6;i++){ctx.fillStyle=i%2?'#97aa7a':'#b2bf90';ctx.beginPath();ctx.ellipse(122+(i%2?20:-17),86+i*31,15,29,i%2?.6:-.7,0,Math.PI*2);ctx.fill();ctx.stroke();}
        ctx.fillStyle='#85866d';ctx.font='italic 21px Georgia';ctx.fillText('keep growing',55,344);
    });
    const botanical=surface(architecture,.54,.79,1.89,3.04,-3.718,sketch.texture);botanical.rotation.z=-.06;
    box(architecture,.19,.055,.014,1.88,3.443,-3.704,m.mint,.003);
    for(let i=0;i<3;i++)box(architecture,.63,.055,.47,2.26,1.82+i*.06,-2.99,[m.cream,m.orange,m.teal][i]);
    const trailing=group(architecture,-2.72,4.26,-3.41);
    cylinder(trailing,.17,.12,.24,0,.13,0,m.orange);
    for(let strand=0;strand<3;strand++){
        const xx=-.08+strand*.10;
        cable(trailing,[[xx,.16,0],[xx+.13,-.05,.17],[xx+.08,-.4,.20],[xx+.13,-.71+strand*.13,.22]],leafDark,.009);
        for(let i=0;i<5;i++){const leaf=paintedLeaf(trailing,.095,.17,xx+.09+(i%2?.06:-.06),.10-i*.14,.22,i%2?leafDark:leafLight);leaf.rotation.z=i%2?.6:-.7;}
    }
    // Soil-moisture sensor: a small, interactive plant beside the development desk.
    const sensorPlant=device('plant',2.38,2.01,-2.99,[2.38,2.86,-2.99]);
    cylinder(sensorPlant.fixed,.22,.16,.32,0,.16,0,m.orange,28);
    cylinder(sensorPlant.fixed,.237,.237,.05,0,.31,0,m.orange,28);
    cylinder(sensorPlant.fixed,.205,.205,.014,0,.34,0,m.darkOrange,28);
    const leaves=group(sensorPlant.root);
    for(let i=0;i<7;i++){
        const a=i*2.4,h=.63+(i%3)*.10,x=Math.cos(a)*.20,z=Math.sin(a)*.16;
        bar(sensorPlant.fixed,[0,.34,0],[x,h,z],.008,leafDark);
        const leaf=paintedLeaf(leaves,.13,.31,x,h,z,i%2?leafDark:leafLight);leaf.rotation.set(Math.sin(a)*.4,a,Math.cos(a)*.55);
    }
    box(sensorPlant.fixed,.07,.21,.025,.12,.38,.04,m.pcb,.008);
    cable(sensorPlant.fixed,[[.12,.44,.055],[.30,.29,.08],[.37,.05,.18],[.34,.10,.25]],m.cream,.011);
    box(sensorPlant.fixed,.29,.18,.14,.36,.11,.23,m.cream,.02);
    const soilDisplay=canvasTexture(256,112,()=>{});surface(sensorPlant.root,.235,.12,.36,.12,.307,soilDisplay.texture);
    const waterPositions=new Float32Array(12*3),waterGeo=new THREE.BufferGeometry();waterGeo.setAttribute('position',new THREE.BufferAttribute(waterPositions,3));
    const droplets=new THREE.Points(waterGeo,new THREE.PointsMaterial({color:'#93b7c0',size:.045,transparent:true,opacity:.75,depthWrite:false}));droplets.visible=false;sensorPlant.root.add(droplets);
    batch(architecture);
    for(const item of devices.values())batch(item.fixed);
    batch(pcbAssembly);batch(boardTop);batch(processor);batch(leaves);
    // Corner brackets make picking feel tangible without covering the object.
    const bracketMaterial=new THREE.LineBasicMaterial({color:'#72885d',transparent:true,opacity:.38,depthWrite:false});
    devices.forEach(item=>{
        scene.updateMatrixWorld(true);
        const bounds=new THREE.Box3().setFromObject(item.root).expandByScalar(.05),points=[];
        for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
            const step=.12;points.push(x,y,z,x+(x===bounds.min.x?step:-step),y,z,x,y,z,x,y+(y===bounds.min.y?step:-step),z,x,y,z,x,y,z+(z===bounds.min.z?step:-step));
        }
        const brackets=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3)),bracketMaterial);brackets.visible=false;scene.add(brackets);item.brackets=brackets;
    });
    function updateBrackets(item){
        const bounds=new THREE.Box3();item.root.updateWorldMatrix(true,true);
        item.root.traverse(obj=>{
            if(!obj.isMesh||!obj.visible||obj.material.transparent)return;
            if(!obj.geometry.boundingBox)obj.geometry.computeBoundingBox();
            bounds.union(obj.geometry.boundingBox.clone().applyMatrix4(obj.matrixWorld));
        });
        if(bounds.isEmpty())return;bounds.expandByScalar(.055);
        const positions=item.brackets.geometry.attributes.position.array;let index=0;
        for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
            const points=[x,y,z,x+(x===bounds.min.x?.12:-.12),y,z,x,y,z,x,y+(y===bounds.min.y?.12:-.12),z,x,y,z,x,y,z+(z===bounds.min.z?.12:-.12)];
            positions.set(points,index);index+=points.length;
        }
        item.brackets.geometry.attributes.position.needsUpdate=true;item.brackets.geometry.computeBoundingSphere();
    }

    const hemi=new THREE.HemisphereLight('#fff5dc','#a5ae8a',2.1);scene.add(hemi);
    const key=new THREE.DirectionalLight('#ffecd0',2.3);key.position.set(-3.8,7.8,1.5);key.target.position.set(.6,0,-1.2);scene.add(key.target);key.castShadow=true;
    key.shadow.mapSize.set(mobile()?1024:2048,mobile()?1024:2048);
    Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.5,far:30});key.shadow.bias=-.0003;key.shadow.normalBias=.035;key.shadow.radius=4;scene.add(key);
    const rimLight=new THREE.DirectionalLight('#cfdebd',.4);rimLight.position.set(-6,4,-1);scene.add(rimLight);
    // A steady, shadow-free screen spill lights the stand and nearby desktop.
    // Reuse the existing desk light slot rather than adding a bloom/render pass.
    const monitorLight=new THREE.PointLight('#a6eadb',1.6,4.5,2);
    monitorLight.name='monitor-spill';monitorLight.position.set(0,monitorScreen.y-.18,monitorScreen.z+.65);monitor.root.add(monitorLight);
    const warmLight=new THREE.PointLight('#ffd398',1.2,9,2);warmLight.position.set(1.6,4.10,-3.10);scene.add(warmLight);
    const frontFill=new THREE.DirectionalLight('#e9ecd7',.5);frontFill.position.set(4,2,8);scene.add(frontFill);
    // Floating dust is subtle and pauses with reduced motion.
    const dustPositions=new Float32Array(16*3);
    for(let i=0;i<16;i++){dustPositions[i*3]=-3+Math.sin(i*12.97)*1.2;dustPositions[i*3+1]=1.5+(i%7)*.3;dustPositions[i*3+2]=Math.cos(i*7.33)*1.8;}
    const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
    const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#fff4c9',size:.017,map:glowTexture,transparent:true,opacity:.28,depthWrite:false}));scene.add(dust);

    let selected=null, hovered=null, view='overview', tween=null, paused=false, night=false, lost=false;
    let lastTime=performance.now(), elapsed=0, scopeTime=0, textureElapsed=0, reportElapsed=0, currentRPM=0, armTime=0, breezeTime=0, interactiveUntil=0;
    let renderedFrames=0,shadowUpdates=0,shadowUntil=3,lastMotionState='';
    const presets={
        overview:{pos:[10.8,8.4,14.8],target:[-.20,2.0,0]},
        panorama:{pos:[11.8,9.2,13.8],target:[-.15,1.75,-.25]},
        bench:{pos:[1.0,4.4,4.4],target:[-.30,2.35,-2.5]},
        // Printer seen from the open front with the window wall behind it, so the
        // courtyard is only a narrow strip past the wall's end.
        fabrication:{pos:[-2.7,3.9,8.0],target:[-4.15,1.78,3.0]},
        // Robotics bench framed from inside the room: the printer stays out of the
        // frame on the left and the wall face / casement form the backdrop.
        robotics:{pos:[-.72,4.1,2.77],target:[-4.1,2.3,-.2]},
        monitor:{pos:[.3,3.01,1.25],target:[.3,3.01,-2.825]}
    };
    const deviceViews={
        monitor:{pos:[3.4,4.65,3.2],target:[.25,2.85,-2.6]},
        // Steeper, closer board view keeps the monitor to a band along the top edge.
        pcb:{pos:[-1.9,4.65,0],target:[-1.55,1.95,-2.35]},
        scope:{pos:[-1.7,4.0,.9],target:[-3.1,2.38,-2.8]},
        solder:{pos:[-1.8,3.7,1.9],target:[-3.72,2.07,-1.9]},
        printer:presets.fabrication, motor:{pos:[-2.0,3.5,3.0],target:[-4.2,2.2,1.1]},
        arm:{pos:[-1.3,4.3,2.4],target:[-4.0,2.5,-1.0]},
        plant:{pos:[.8,3.7,.2],target:[2.38,2.4,-2.99]}
    };
    function destination(preset, forDevice=false) {
        const pos=new THREE.Vector3(...preset.pos), target=new THREE.Vector3(...preset.target);
        if(view==='monitor'&&!forDevice){
            const aspect=container.clientWidth/container.clientHeight;
            const distance=Math.max(monitorScreen.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*.65),monitorScreen.width/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*aspect*.90));
            // Derive both ends from the same physical plane as the CSS3D aperture.
            target.set(0,monitorScreen.y,monitorScreen.z);monitor.root.localToWorld(target);
            const normal=new THREE.Vector3(0,0,1).transformDirection(monitor.root.matrixWorld);
            pos.copy(target).addScaledVector(normal,distance);
            return {pos,target};
        }
        if(mobile()){
            if(view==='overview'&&!forDevice){
                pos.set(14.4,11.8,23.1);target.set(-.45,1.8,-.25);
                pos.sub(target).multiplyScalar(Math.max(1,.58/camera.aspect)).add(target);
            }
            else if(view==='panorama'&&!forDevice){pos.set(14.2,12,19.0);target.set(-.2,1.8,-.3);}
            else if(forDevice){const offset=pos.clone().sub(target).multiplyScalar(1.25);pos.copy(target).add(offset);target.y-=.62;}
            else {
                const offset=pos.clone().sub(target).multiplyScalar(view==='bench'?1.85:1.45);
                pos.copy(target).add(offset);
                if(view==='bench'){target.x-=.75;pos.x-=.75;}
            }
        } else if(forDevice) {
            // Leave space for the device controls on the right of the viewport.
            const right=new THREE.Vector3().crossVectors(pos.clone().sub(target),new THREE.Vector3(0,1,0)).normalize();
            target.addScaledVector(right,-.68);pos.addScaledVector(right,-.68);
        }
        return {pos,target};
    }
    function fitOutdoorCoverage() {
        const center = new THREE.Vector3(...layout.background.center), previousView = view;
        let targetBound = 0;
        for (const [name, preset] of Object.entries(presets)) {
            view = name; targetBound = Math.max(targetBound, destination(preset).target.distanceTo(center));
        }
        for (const preset of Object.values(deviceViews)) targetBound = Math.max(targetBound, destination(preset, true).target.distanceTo(center));
        view = previousView;
        // Triangle inequality covers every orbit and the convex hull of tweened
        // targets (including the screen centre), not only preset screenshots.
        // This spherical bound also covers the monitor's level orbit. Keep near unchanged.
        const cameraBound = (mobile() ? 60 : 27) + targetBound;
        const radius = Math.max(layout.background.radius, Math.ceil(cameraBound + 6));
        camera.far = Math.max(160, Math.ceil(radius + cameraBound + 8));
        landscape.configure(mobile(), radius);
    }
    function moveTo(preset,forDevice=false,instant=false){
        if(disposed)return;
        // Drain gesture inertia before a scripted move, without jumping the camera.
        const startPos=camera.position.clone(),startTarget=controls.target.clone();
        controls.enableDamping=false;controls.update();controls.enableDamping=true;
        camera.position.copy(startPos);controls.target.copy(startTarget);
        controls.minAzimuthAngle=forDevice?-.85:-.28;
        // The ordinary room limit is slightly top-down; it must not clamp the
        // front-on screen destination back to that angle on every update().
        controls.maxPolarAngle=view==='monitor'&&!forDevice?Math.PI/2:1.48;
        controls.maxDistance=mobile()?60:27;
        const dest=destination(preset,forDevice);
        tween={fromPos:camera.position.clone(),fromTarget:controls.target.clone(),toPos:dest.pos,toTarget:dest.target,start:performance.now(),duration:reducedMotion||instant?0:1250};
        controls.enabled=false;
        if(instant){camera.position.copy(dest.pos);controls.target.copy(dest.target);controls.update();tween=null;controls.enabled=!paused;}
    }
    function setView(name,instant=false){if(disposed)return;view=presets[name]?name:'overview';selected=null;renderer.shadowMap.needsUpdate=true;moveTo(presets[view],false,instant);}
    function select(id){if(disposed||!devices.has(id))return;selected=id;renderer.shadowMap.needsUpdate=true;moveTo(deviceViews[id],true);}
    function focusMonitor(){if(disposed)return;selected=null;view='monitor';moveTo(presets.monitor);}
    function setNight(value){
        if(disposed)return;
        night=value;hemi.color.set(night?'#b5c4d1':'#fffaf0');hemi.groundColor.set(night?'#697862':'#a7b093');hemi.intensity=night?.7:2.1;
        key.color.set(night?'#c0cfdd':'#fff0d6');key.intensity=night?.55:1.85;rimLight.intensity=night?.25:.4;
        monitorLight.intensity=night?3.2:1.6;monitorFrame.emissiveIntensity=night?.07:.025;
        warmLight.intensity=night?16:1.2;frontFill.intensity=night?.20:.5;
        const palette=outdoorPalette(night);
        scene.background.set(palette.paper);scene.fog.color.copy(scene.background);ground.material.color.set(night?'#101c18':'#7b7357');ground.material.opacity=night?.24:.18;
        sunPatch.material.opacity=night?.07:.60;inkMaterial.color.set(night?'#374a40':'#586048');
        bracketMaterial.color.set(night?'#d2dfb9':'#72885d');m.amberGlow.emissiveIntensity=night?1.4:.4;
        studioWindow.setNight(night);
        landscape.setTheme(palette);
        renderer.shadowMap.needsUpdate=true;
    }
    const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();let pointerStart=null,lastHover=0,multiTouch=false;
    const pointers=new Set();
    function hitAt(event){const rect=container.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
        // Intersect all geometry so walls and furniture correctly occlude device hit areas.
        const candidates=[];scene.traverseVisible(obj=>{if(obj.isMesh&&(!obj.material?.transparent||obj.userData.windowHit))candidates.push(obj);});
        const hits=raycaster.intersectObjects(candidates,false);
        for(const hit of hits){if(hit.object.isSprite||hit.object.isPoints||hit.object.isLine||(hit.object.material?.transparent&&!hit.object.userData.windowHit))continue;let node=hit.object;while(node){if(node.userData.device)return node.userData.device;if(node.userData.window)return 'window';node=node.parent;}return null;}return null;
    }
    listen(orbitSurface,'pointerdown',e=>{pointers.add(e.pointerId);multiTouch=multiTouch||pointers.size>1;pointerStart=multiTouch?null:{x:e.clientX,y:e.clientY,id:e.pointerId};});
    listen(orbitSurface,'pointerup',e=>{if(!multiTouch&&pointerStart&&pointerStart.id===e.pointerId&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)<7&&!paused){const hit=hitAt(e);if(hit==='window')onWindowToggle();else if(hit)onSelect(hit);}pointerStart=null;pointers.delete(e.pointerId);if(!pointers.size)multiTouch=false;});
    listen(orbitSurface,'pointercancel',e=>{pointerStart=null;pointers.delete(e.pointerId);if(!pointers.size)multiTouch=false;});
    listen(orbitSurface,'pointermove',e=>{if(e.pointerType==='touch'||performance.now()-lastHover<80)return;lastHover=performance.now();hovered=hitAt(e);container.style.cursor=hovered?'pointer':'grab';});
    listen(orbitSurface,'pointerleave',()=>{hovered=null;});
    const guardScreenPointer=e=>{
        if(!liveMonitor.element.contains(e.target))return;
        // Cancelling pointerdown does not cancel the subsequent native click.
        // Keyboard activation has no pointer coordinates; test the control centre.
        const rect=e.type==='click'&&e.detail===0?e.target.getBoundingClientRect():null;
        const hit=hitAt(rect?{clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2}:e);
        if(hit!=='monitor'){
            e.preventDefault();e.stopImmediatePropagation();
            if(e.type==='pointerdown'){if(hit==='window')onWindowToggle();else if(hit)onSelect(hit);}
        }else if(e.type==='click'&&!paused&&(view!=='monitor'||selected)){
            // The live HTML screen bypasses orbitSurface picking. Approach on a
            // completed click, in capture phase even if an app stops bubbling;
            // keep the same native click available to its control.
            onSelect('monitor');
        }
    };
    for(const type of ['pointerdown','click','dblclick','contextmenu','wheel'])listen(container,type,guardScreenPointer,{capture:true,passive:false});
    listen(controls,'start',()=>{tween=null;interactiveUntil=performance.now()+2000;});
    listen(controls,'end',()=>{interactiveUntil=performance.now()+1600;});
    function projectedMarkers(){const result=[];camera.updateMatrixWorld();devices.forEach(item=>{const p=item.anchor.clone().project(camera);result.push({id:item.id,x:(p.x*.5+.5)*container.clientWidth,y:(-.5*p.y+.5)*container.clientHeight,hovered:item.id===hovered,visible:p.z>-1&&p.z<1&&Math.abs(p.x)<.94&&Math.abs(p.y)<.88});});return result;}
    function resize(){if(disposed)return;const w=container.clientWidth,h=container.clientHeight;renderer.setPixelRatio(Math.min(window.devicePixelRatio,mobile()?1.35:1.5));renderer.setSize(w,h);liveMonitor.resize(w,h);camera.aspect=w/h;camera.fov=w/h<1?48:36;fitOutdoorCoverage();camera.updateProjectionMatrix();if(selected)moveTo(deviceViews[selected],true,true);else if(!paused)setView(view,true);}
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);
    cleanups.push(() => resizeObserver.disconnect());
    function setPaused(value){if(disposed)return;paused=value;controls.enabled=!paused;if(!paused){lastTime=performance.now();if(!frameId&&!lost&&!document.hidden)frameId=requestAnimationFrame(render);}}
    listen(renderer.domElement,'webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(frameId);frameId=null;onError('显卡连接已中断，可以重新加载场景。');});
    listen(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frameId);frameId=null;}else if(!disposed&&!paused&&!lost&&!frameId){lastTime=performance.now();frameId=requestAnimationFrame(render);}});

    function drawScope(ctx,w,h,t){
        ctx.fillStyle='#0b2325';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#294446';ctx.lineWidth=1;for(let x=24;x<w;x+=46){ctx.beginPath();ctx.moveTo(x,30);ctx.lineTo(x,h-35);ctx.stroke();}for(let y=38;y<h-28;y+=36){ctx.beginPath();ctx.moveTo(20,y);ctx.lineTo(w-20,y);ctx.stroke();}
        ctx.font='15px monospace';ctx.fillStyle='#e0c583';ctx.fillText('CH1   '+(state.scope==='sine'?'SINE':state.scope==='square'?'PWM':'SAW'),20,24);ctx.fillStyle='#97bfac';ctx.textAlign='right';ctx.fillText(state.frequency.toFixed(1)+' kHz',w-20,24);ctx.textAlign='left';
        const wave=(x)=>{const a=(x/w)*Math.PI*2*state.frequency+t*2;return state.scope==='sine'?Math.sin(a):state.scope==='square'?(Math.sin(a)>0?1:-1):2*((a/(Math.PI*2))%1)-1;};
        ctx.strokeStyle='#a5ebc1';ctx.shadowColor='#7fe1b0';ctx.shadowBlur=6;ctx.lineWidth=2.5;ctx.beginPath();for(let x=20;x<w-20;x++){const y=h*.47-wave(x)*h*.19;if(x===20)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();ctx.shadowBlur=0;
        ctx.strokeStyle='#e1b278';ctx.lineWidth=1.4;ctx.beginPath();for(let x=20;x<w-20;x++){const y=h*.66-Math.sin(x*.035+t)*16;if(x===20)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
        ctx.fillStyle='#80a593';ctx.font='12px monospace';ctx.fillText('3.30 Vpp   500us/div   '+(state.scopeRunning?'RUN':'STOP'),20,h-12);
    }
    function smallDisplay(display,top,bottom,tint='#a7eac8'){
        const {ctx,canvas,texture}=display;ctx.fillStyle='#102b2b';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#698e83';ctx.font='16px monospace';ctx.fillText(top,13,25);ctx.fillStyle=tint;ctx.font='30px monospace';ctx.fillText(bottom,13,canvas.height-17);texture.needsUpdate=true;
    }
    function tickSimulation(dt){
        if(disposed)return;
        if(studioWindow.update(dt,state.breeze))renderer.shadowMap.needsUpdate=true;
        const wind=.18+.82*studioWindow.getOpenAmount();
        landscape.update(dt,{reducedMotion,wind});
        if(state.scopeRunning)scopeTime+=dt;
        if(state.watering){
            state.waterProgress=Math.min(3,state.waterProgress+dt);state.soilMoisture=Math.min(72,42+state.waterProgress*10);
            if(state.waterProgress>=3){state.watering=false;onEvent('湿度升到 72%。小植物喝饱了，读数已同步到传感器。');}
        }
        droplets.visible=state.watering&&!reducedMotion;
        if(droplets.visible){for(let i=0;i<12;i++){const t=(elapsed*.9+i/12)%1;waterPositions[i*3]=.1+Math.sin(i*4)*.08;waterPositions[i*3+1]=.85-t*.48;waterPositions[i*3+2]=.02+Math.cos(i*3)*.08;}waterGeo.attributes.position.needsUpdate=true;}
        if(!reducedMotion)breezeTime+=dt*wind;
        leaves.rotation.z=Math.sin(breezeTime*.7)*.025*wind;
        for(const {mesh,base} of curtains){
            const attr=mesh.geometry.attributes.position;
            for(let i=0;i<attr.count;i++){const weight=Math.max(0,1-(base[i*3+1]+1.44)/2.88);attr.setZ(i,base[i*3+2]+Math.sin(breezeTime*.7+base[i*3]*3)*.075*weight*weight*(reducedMotion?0:wind));}
            attr.needsUpdate=true;
        }
        sunPatch.rotation.z=-.42+Math.sin(breezeTime*.19)*.013;
        if(state.printer==='printing'){
            state.printProgress=Math.min(100,state.printProgress+dt/26*100);
            if(state.printProgress>=100){state.printer='done';onEvent('打印完成。第一件原型，诞生了。');}
        }
        if(state.firmware==='flashing'){
            state.flashProgress=Math.min(100,state.flashProgress+dt/4.5*100);
            if(state.flashProgress>=100){state.firmware='done';onEvent('固件校验通过 · UART: Hello, world!');}
        }
        const h=state.printProgress/100*.60;
        printPart.children.forEach((child,i)=>{child.visible=i/30<state.printProgress/100;});
        gantry.position.y=1.71+h;
        printHead.position.x=state.printer==='printing'?Math.sin(elapsed*3.1)*.24:0;
        printHead.position.z=state.printer==='printing'?Math.cos(elapsed*2.4)*.17:0;
        const filamentCurve=new THREE.CubicBezierCurve3(new THREE.Vector3(0,3.34,.03),new THREE.Vector3(.48,3.02,.25),new THREE.Vector3(printHead.position.x+.32,gantry.position.y+.65,.18),new THREE.Vector3(printHead.position.x,gantry.position.y+.09,printHead.position.z-.08));
        for(let i=0;i<25;i++)filamentCurve.getPoint(i/24).toArray(filamentPositions,i*3);
        filamentGeometry.attributes.position.needsUpdate=true;filamentGeometry.computeBoundingSphere();
        const spread=state.boardExploded?1:0;pcbAssembly.position.y=THREE.MathUtils.damp(pcbAssembly.position.y,spread*.15,6,dt);processor.position.y=THREE.MathUtils.damp(processor.position.y,.11+spread*.64,6,dt);boardTop.position.y=THREE.MathUtils.damp(boardTop.position.y,spread*.39,6,dt);oledPlane.position.y=.112+boardTop.position.y;
        boardLed.material.emissiveIntensity=state.firmware==='flashing'?.65+Math.sin(elapsed*10)*.3:.55;
        rotor.rotation.z-=state.iron&&!reducedMotion?dt*14:0;
        smoke.visible=state.iron&&!reducedMotion;
        if(smoke.visible){for(let i=0;i<18;i++){const t=(elapsed*.5+i/18)%1;smokeArray[i*3]=.73-t*.72+Math.sin(t*9+i)*.04;smokeArray[i*3+1]=.7+t*.52;smokeArray[i*3+2]=.20-t*.28;}smokeGeo.attributes.position.needsUpdate=true;}
        currentRPM=THREE.MathUtils.damp(currentRPM,state.motor?state.rpm:0,3,dt);
        if(!reducedMotion)motorRotor.rotation.y+=dt*currentRPM/60*.65;
        if(state.arm)armTime+=dt;
        const phase=(armTime%10)/10;
        let reachX=.58,reachY=1.1,yaw=.1;
        if(state.armStarted){
            const smooth=THREE.MathUtils.smoothstep,pickYaw=Math.atan2(-.30,-.64)+Math.PI*2,dropYaw=Math.atan2(.40,.56);
            const outbound=smooth(phase,.44,.61),returning=smooth(phase,.86,1),turn=outbound-returning;
            yaw=THREE.MathUtils.lerp(pickYaw,dropYaw,turn);
            reachX=THREE.MathUtils.lerp(Math.hypot(.64,.30),Math.hypot(.56,.40),turn);
            const downPick=smooth(phase,.12,.25)-smooth(phase,.32,.44),downDrop=smooth(phase,.61,.72)-smooth(phase,.78,.86);
            reachY=1.0-.87*downPick-.83*downDrop;
        }
        const l1=.90,l2=.78,c2=THREE.MathUtils.clamp((reachX*reachX+reachY*reachY-l1*l1-l2*l2)/(2*l1*l2),-1,1),q2=Math.acos(c2),q1=Math.atan2(reachX,reachY)-Math.atan2(l2*Math.sin(q2),l1+l2*Math.cos(q2));
        shoulder.rotation.z=THREE.MathUtils.damp(shoulder.rotation.z,-q1,5,dt);elbow.rotation.z=THREE.MathUtils.damp(elbow.rotation.z,-q2,5,dt);armYaw.rotation.y=THREE.MathUtils.damp(armYaw.rotation.y,yaw,4,dt);wrist.rotation.z=-(shoulder.rotation.z+elbow.rotation.z)+Math.PI;
        carried.visible=state.armStarted&&phase>.28&&phase<.75;
        pickupPart.visible=!state.armStarted||phase<.28||phase>.93;deliveredPart.visible=state.armStarted&&phase>=.75&&phase<.93;
        jawA.position.x=carried.visible?-.07:-.11;jawB.position.x=-jawA.position.x;
        dust.visible=state.breeze&&!reducedMotion;dust.rotation.y=Math.sin(breezeTime*.11)*.06;
    }
    function render(now){
        frameId=null;if(disposed||lost||document.hidden)return;
        try {
        const active=tween||now<interactiveUntil||state.printer==='printing'||state.motor||currentRPM>1||state.arm||state.firmware==='flashing'||state.watering;
        // Never throttle the first frame: the loader is waiting for real pixels.
        // Quiet room: 30 fps with cached shadows; camera and device actions: up to 60 fps.
        if(renderedFrames>0&&!paused&&now-lastTime<1000/(active?60:30)-1){frameId=requestAnimationFrame(render);return;}
        const dt=Math.max(0,Math.min((now-lastTime)/1000,.1));lastTime=now;
        if(!paused){elapsed+=dt;tickSimulation(dt);}
        if(tween){const t=tween.duration?Math.min(1,(now-tween.start)/tween.duration):1;const eased=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;camera.position.lerpVectors(tween.fromPos,tween.toPos,eased);controls.target.lerpVectors(tween.fromTarget,tween.toTarget,eased);if(t===1){tween=null;controls.enabled=!paused;}}
        controls.update();
        devices.forEach(item=>{item.brackets.visible=item.id!=='monitor'&&!paused&&(item.id===selected||item.id===hovered);if(item.brackets.visible&&reportElapsed+dt>.1)updateBrackets(item);});
        textureElapsed+=dt;reportElapsed+=dt;
        if(textureElapsed>(active?.15:.35)){textureElapsed=0;drawScope(scopeTex.ctx,512,320,reducedMotion?0:scopeTime);scopeTex.texture.needsUpdate=true;smallDisplay(solderTex,'T12 STATION',state.iron?'350°C':'STANDBY',state.iron?'#f0bd7e':'#7aaca0');smallDisplay(printerTex,'FDM / 0.2mm',state.printer==='idle'?'READY':Math.round(state.printProgress)+'%');smallDisplay(motorTex,'BLDC / FOC',Math.round(currentRPM)+' RPM');smallDisplay(boardOLED,state.firmware==='done'?'SOIL / ADC':'STM32 H7',state.firmware==='flashing'?Math.round(state.flashProgress)+'%':state.firmware==='done'?Math.round(state.soilMoisture)+'%':'480 MHz');smallDisplay(soilDisplay,'SOIL / DEMO',Math.round(state.soilMoisture)+'%');}
        const motionState=`${state.arm}:${state.boardExploded}:${state.printer}:${state.iron}:${state.breeze}`;
        if(motionState!==lastMotionState){lastMotionState=motionState;shadowUntil=elapsed+2;}
        if(elapsed<shadowUntil||state.printer==='printing'||currentRPM>1||state.arm||state.iron)renderer.shadowMap.needsUpdate=true;
        if(renderer.shadowMap.needsUpdate)shadowUpdates++;
        liveMonitor.render();
        renderer.render(scene,camera);
        renderedFrames++;
        if(renderedFrames===1)onReady();
        if(disposed)return;
        if(active||reportElapsed>.1){onFrame({markers:projectedMarkers(),selected,rpm:Math.round(currentRPM),armPhase:Math.round((armTime%10)/10*100),update:reportElapsed>.1});if(reportElapsed>.1)reportElapsed=0;}
        if(!paused||tween)frameId=requestAnimationFrame(render);
        } catch (error) {
            // RAF errors do not reach createStudioRoom's initialization catch.
            // Tear down partially rendered layers before exposing the fallback.
            console.error('Studio frame failed to render:', error);
            dispose();
            onError('场景画面未能绘制，请重新加载，也可直接打开桌面。');
        }
    }
    resize();setView('overview',true);setNight(false);
    // Render the first instrument display before exposing the workspace.
    drawScope(scopeTex.ctx,512,320,0);scopeTex.texture.needsUpdate=true;
    frameId=requestAnimationFrame(render);
    return {setView,select,focusMonitor,setNight,setPaused,dispose,projectedMarkers,setHovered:id=>{if(!disposed)hovered=id;},getStats:()=>({drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,renderedFrames,shadowUpdates}),getView:()=>view};
    } catch (error) {
        dispose();
        throw error;
    }
}
