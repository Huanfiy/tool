/* Local countryside canvas; drawing is owned by the room clock. */
export function createLandscapeArt() {
    let night = false;
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
    return { canvas: pastoralCanvas, draw(time, value) { night = !!value; drawPastoral(time); } };
}
