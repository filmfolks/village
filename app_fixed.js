/* ============================================================================
   ಊರಂದ್ರೆ ನಮ್ಮೂರು — Professional 3D Lyrical Video (Three.js)
   Beat-reactive stylized Kannada village world + audio-synced lyric animation
   ==========================================================================*/
'use strict';

// ---------- offline-safe payload loader (embedded or fetched) ----------
const EMBEDDED = (typeof window.__OOR_DATA__ !== 'undefined') ? window.__OOR_DATA__ : null;
async function loadPayload(){
  if (EMBEDDED) return EMBEDDED;
  const r = await fetch('data/timeline.json');
  return r.json();
}

// ---------- math helpers ----------
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smoothstep=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const rnd=(a=1,b=0)=>b+Math.random()*(a-b);
function mulberry(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const rand=mulberry(20240418);

// ---------- RLE band decoder ----------
let rleFPS=50;
function decodeRLE(rle,q=32){
  const out=new Float32Array(Math.ceil(161.31*rleFPS));
  let i=0;
  for(let k=0;k<rle.length;k+=2){
    const v=rle[k]/q, run=rle[k+1]|0;
    for(let j=0;j<run&&i<out.length;j++)out[i++]=v;
  }
  return out;
}

// ---------- section themes ----------
const THEMES={
 'ಪಲ್ಲವಿ':          {sky:'assets/sky_day.png',    tc:'#4A2E14',bc:'#C84B31',sun:new THREE.Color(0xFFE9B8),fog:new THREE.Color(0xEADFC8),amb:new THREE.Color(0xBFD8E8),dir:new THREE.Color(0xFFDFB0),mood:0},
 'ಏ ಗಡಿಬಿಡಿ Hook': {sky:'assets/sky_golden.png', tc:'#4A2E14',bc:'#B3400F',sun:new THREE.Color(0xFFC65E),fog:new THREE.Color(0xF3D9A4),amb:new THREE.Color(0xE8C890),dir:new THREE.Color(0xFFB85C),mood:1},
 'ಇಂಟರ್\u200cಲ್ಯೂಡ್':   {sky:'assets/sky_day.png',    tc:'#5C3A1E',bc:'#7A4E2D',sun:new THREE.Color(0xFFF2CC),fog:new THREE.Color(0xE9E2D2),amb:new THREE.Color(0xCBDDE6),dir:new THREE.Color(0xFFE8C0),mood:2},
 'ಚರಣ':            {sky:'assets/sky_green.png',  tc:'#1A3A10',bc:'#2F7A1F',sun:new THREE.Color(0xEFFFCF),fog:new THREE.Color(0xDCEFD2),amb:new THREE.Color(0xBFE3C8),dir:new THREE.Color(0xF2FFC8),mood:3},
 'ಔಟ್ರೋ':           {sky:'assets/sky_dusk.png',   tc:'#FFF7CC',bc:'#FFD166',sun:new THREE.Color(0xFF9E5E),fog:new THREE.Color(0xD88A5A),amb:new THREE.Color(0xE0A070),dir:new THREE.Color(0xFF8A4A),mood:4},
};
const SECTION_TITLES={
 'ಪಲ್ಲವಿ':{kn:'ಪಲ್ಲವಿ',en:'Pallavi — The Chorus of Home'},
 'ಏ ಗಡಿಬಿಡಿ Hook':{kn:'ಏ ಗಡಿಬಿಡಿ',en:'The Rush of Life — Hook'},
 'ಇಂಟರ್\u200cಲ್ಯೂಡ್':{kn:'ಸಂಗೀತ ಸಂಧಿಕಾಲ',en:'Folk Instrumental Interlude'},
 'ಚರಣ':{kn:'ಚರಣ',en:'Charana — The Verse'},
 'ಔಟ್ರೋ':{kn:'ಔಟ್ರೋ',en:'Outro — Coming Home'},
};
function themeFor(t){
  t=t||'';
  if(THEMES[t])return THEMES[t];
  if(t.indexOf('ಗಡಿಬಿಡಿ')>=0)return THEMES['ಏ ಗಡಿಬಿಡಿ Hook'];
  if(t.indexOf('ಲ್ಯೂಡ್')>=0||t.indexOf('ಸಂಗೀತ')>=0)return THEMES['ಇಂಟರ್\u200cಲ್ಯೂಡ್'];
  if(t.indexOf('ಚರಣ')>=0)return THEMES['ಚರಣ'];
  if(t.indexOf('ಔಟ್ರೋ')>=0||t.indexOf('ಔಟ್')>=0)return THEMES['ಔಟ್ರೋ'];
  return THEMES['ಪಲ್ಲವಿ'];
}
function titleFor(t){
  t=t||'';
  if(SECTION_TITLES[t])return SECTION_TITLES[t];
  for(const k in SECTION_TITLES){if(t.indexOf(k.slice(0,4))>=0)return SECTION_TITLES[k]}
  return null;
}

// ---------- DOM ----------
const stage=document.getElementById('stage');
const canvas=document.getElementById('c');
const lyricLayer=document.getElementById('lyric-layer');
const secTitleEl=document.getElementById('section-title');
const flashEl=document.getElementById('flash');
const media=document.getElementById('media');
const seekEl=document.getElementById('seek');
const timeText=document.getElementById('time-text');
const playBtn=document.getElementById('play-btn');
const volEl=document.getElementById('vol');
const startEl=document.getElementById('start');
const eqBars=[...document.querySelectorAll('#eq-mini i')];


// ---------- CapsuleGeometry polyfill (three r128 lacks it) ----------
if(!THREE.CapsuleGeometry){
  THREE.CapsuleGeometry=function(radius,length,capSegs,radialSegs){
    const h=Math.max(.01,length+radius*2);
    const g=new THREE.CylinderGeometry(radius,radius,h,Math.max(3,radialSegs||8),1,false);
    return g;
  };
}

// ---------- renderer / scene ----------
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xEADFC8,38,150);
const camera=new THREE.PerspectiveCamera(42,16/9,0.1,400);
camera.position.set(0,4.6,17.5);

// lights
const hemi=new THREE.HemisphereLight(0xD8ECF2,0x8A6A40,0.85);scene.add(hemi);
const amb=new THREE.AmbientLight(0xBFD8E8,0.35);scene.add(amb);
const sun=new THREE.DirectionalLight(0xFFDFB0,1.35);
sun.position.set(-14,20,-8);
sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-30;sun.shadow.camera.right=30;
sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;
sun.shadow.camera.far=90;sun.shadow.bias=-0.0006;
scene.add(sun);
const rim=new THREE.DirectionalLight(0xFFCFA0,0.5);rim.position.set(16,8,14);scene.add(rim);

// ---------- procedural texture makers ----------
function texFromCanvas(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;
}
function noiseTex(size=256,scale=1,alpha=false){
  return texFromCanvas(size,size,(g,w,h)=>{
    const img=g.createImageData(w,h);
    for(let i=0;i<w*h;i++){const v=Math.floor(rand()*255);img.data[i*4]=img.data[i*4+1]=img.data[i*4+2]=v;img.data[i*4+3]=alpha?Math.floor(rand()*255):255}
    g.putImageData(img,0,0);
  });
}
function groundTex(){
  return texFromCanvas(512,512,(g,w,h)=>{
    // warm earth base with patchy grass & farm tracks
    g.fillStyle='#C9A063';g.fillRect(0,0,w,h);
    for(let i=0;i<2600;i++){
      const x=rand(w),y=rand(h),r=4+rand()*30;
      const greens=['#8FAE5C','#A3BE6E','#7C9C4E','#B9C07A'];
      g.fillStyle=greens[Math.floor(rand()*greens.length)];
      g.globalAlpha=.10+rand()*.18;
      g.beginPath();g.ellipse(x,y,r,r*(0.4+rand()*0.6),rand()*Math.PI,0,7);g.fill();
    }
    g.globalAlpha=.16;g.strokeStyle='#B08850';
    for(let i=0;i<9;i++){g.lineWidth=6+rand()*14;g.beginPath();g.moveTo(rand(w),0);g.bezierCurveTo(rand(w),h*.3,rand(w),h*.7,rand(w),h);g.stroke()}
    g.globalAlpha=1;
  });
}
function thatchTex(){
  return texFromCanvas(128,128,(g,w,h)=>{
    g.fillStyle='#B8813F';g.fillRect(0,0,w,h);
    g.strokeStyle='rgba(90,55,20,.5)';
    for(let i=0;i<130;i++){g.lineWidth=1+rand()*2;const y=rand(h);g.beginPath();g.moveTo(0,y);g.lineTo(w,y+rand()*8-4);g.stroke()}
    g.strokeStyle='rgba(255,225,160,.35)';
    for(let i=0;i<60;i++){g.lineWidth=1;const y=rand(h);g.beginPath();g.moveTo(0,y);g.lineTo(w,y+rand()*6-3);g.stroke()}
  });
}
function wallTex(){
  return texFromCanvas(128,128,(g,w,h)=>{
    g.fillStyle='#E3C08A';g.fillRect(0,0,w,h);
    for(let i=0;i<700;i++){g.fillStyle=`rgba(${120+rand()*60|0},${80+rand()*40|0},40,${.05+rand()*.1})`;g.fillRect(rand(w),rand(h),2+rand()*4,2+rand()*4)}
  });
}
function leafTex(){
  return texFromCanvas(256,256,(g,w,h)=>{
    g.clearRect(0,0,w,h);
    for(let i=0;i<26;i++){
      const cx=30+rand()*196,cy=30+rand()*196,r=26+rand()*40;
      const grd=g.createRadialGradient(cx-r*.3,cy-r*.3,r*.1,cx,cy,r);
      const hue=88+rand()*30;
      grd.addColorStop(0,`hsla(${hue},52%,${52+rand()*12}%,.95)`);
      grd.addColorStop(1,`hsla(${hue-8},55%,30%,.9)`);
      g.fillStyle=grd;g.beginPath();g.arc(cx,cy,r,0,7);g.fill();
    }
  });
}
function petalTex(){
  return texFromCanvas(64,64,(g,w,h)=>{
    g.clearRect(0,0,w,h);
    const grd=g.createRadialGradient(32,26,2,32,32,28);
    grd.addColorStop(0,'#FFF3D8');grd.addColorStop(.55,'#FFC9A8');grd.addColorStop(1,'rgba(255,150,110,0)');
    g.fillStyle=grd;g.beginPath();g.ellipse(32,32,16,26,0,0,7);g.fill();
  });
}
function glowSpriteTex(c0='rgba(255,240,200,1)',c1='rgba(255,200,120,0)'){
  return texFromCanvas(128,128,(g,w,h)=>{
    const grd=g.createRadialGradient(64,64,2,64,64,62);
    grd.addColorStop(0,c0);grd.addColorStop(.35,c0.replace(/,1\)$/,',.55)'));grd.addColorStop(1,c1);
    g.fillStyle=grd;g.fillRect(0,0,w,h);
  });
}
function cloudTex(){
  return texFromCanvas(256,128,(g,w,h)=>{
    g.clearRect(0,0,w,h);
    for(let i=0;i<14;i++){
      const cx=40+rand()*176,cy=40+rand()*50,r=22+rand()*34;
      const grd=g.createRadialGradient(cx,cy,2,cx,cy,r);
      grd.addColorStop(0,'rgba(255,255,255,.95)');grd.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=grd;g.beginPath();g.arc(cx,cy,r,0,7);g.fill();
    }
  });
}
function rangoliTex(){
  return texFromCanvas(256,256,(g,w,h)=>{
    g.clearRect(0,0,w,h);
    g.translate(128,128);
    const cols=['#C84B31','#F59E0B','#3B7A23','#2A6F97','#7A4E2D'];
    for(let ring=0;ring<4;ring++){
      const R=26+ring*24,n=8+ring*4;
      g.fillStyle=cols[ring%cols.length];
      for(let i=0;i<n;i++){
        const a=i/n*Math.PI*2;
        g.save();g.rotate(a);g.beginPath();g.ellipse(R,0,10-ring,5,0,0,7);g.fill();g.restore();
      }
    }
    g.fillStyle='#F59E0B';g.beginPath();g.arc(0,0,14,0,7);g.fill();
    g.fillStyle='#C84B31';g.beginPath();g.arc(0,0,7,0,7);g.fill();
  });
}

const TEX={ground:groundTex(),thatch:thatchTex(),wall:wallTex(),leaf:leafTex(),petal:petalTex(),cloud:cloudTex(),rangoli:rangoliTex(),glow:glowSpriteTex(),firefly:glowSpriteTex('rgba(255,240,160,1)','rgba(255,200,60,0)')};
TEX.ground.wrapS=TEX.ground.wrapT=THREE.RepeatWrapping;TEX.ground.repeat.set(10,10);TEX.ground.anisotropy=4;

// sky textures loaded from PNG assets
const skyTexCache={};
function getSkyTex(name){
  if(skyTexCache[name])return skyTexCache[name];
  const t=new THREE.TextureLoader().load(name);t.encoding=THREE.sRGBEncoding;
  skyTexCache[name]=t;return t;
}

// ---------- SKY DOME ----------
const skyMat=new THREE.MeshBasicMaterial({map:getSkyTex(THEMES['ಪಲ್ಲವಿ'].sky),side:THREE.BackSide,fog:false});
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(190,32,20),skyMat);
scene.add(skyDome);

// sun orb sprite
const sunOrb=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glow,color:0xFFE9B8,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
sunOrb.scale.set(46,46,1);sunOrb.position.set(-92,44,-120);scene.add(sunOrb);

// ---------- CLOUDS ----------
const clouds=[];
for(let i=0;i<10;i++){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.cloud,transparent:true,opacity:.85,depthWrite:false}));
  const sc=18+rand()*30;s.scale.set(sc,sc*.5,1);
  s.position.set(-140+rand()*280,26+rand()*30,-90-rand()*60);
  s.userData.v=0.4+rand()*0.8;clouds.push(s);scene.add(s);
}

// ---------- BIRDS (flocking V) ----------
const birdGroup=new THREE.Group();scene.add(birdGroup);
function makeBird(){
  const g=new THREE.Group();
  const mat=new THREE.LineBasicMaterial({color:0x4A3018});
  const geoL=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(-.55,.28,-.1)]);
  const geoR=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(.55,.28,-.1)]);
  const l=new THREE.Line(geoL,mat),r=new THREE.Line(geoR,mat);
  g.add(l,r);g.userData={l,r,ph:rand()*7};
  return g;
}
const birds=[];
for(let i=0;i<7;i++){const b=makeBird();b.position.set(-60+rand()*120,16+rand()*10,-40-rand()*30);b.userData.v=3+rand()*3;b.userData.base=b.position.y;birds.push(b);birdGroup.add(b)}

// ---------- GROUND ----------
const ground=new THREE.Mesh(new THREE.PlaneGeometry(300,300,1,1),
  new THREE.MeshStandardMaterial({map:TEX.ground,roughness:.95}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);

// distant hills
function hill(z,scale,color){
  const m=new THREE.Mesh(new THREE.SphereGeometry(1,18,12,0,Math.PI*2,0,Math.PI/2),
    new THREE.MeshStandardMaterial({color,roughness:1}));
  m.scale.set(60*scale,14*scale,26*scale);m.position.set(rand()*40-20,-2,z);scene.add(m);return m;
}
for(let i=0;i<7;i++)hill(-95-i*8,1.4+rand(),new THREE.Color().setHSL(.28,.3,.42+rand()*.1));

// ---------- SHARED UNIFORMS for wind shaders ----------
const cwUniforms={time:{value:0},wind:{value:0.25}};

// ---------- FIELD CROPS (instanced, wind sway shader) ----------
const cropGeo=new THREE.ConeGeometry(.09,1.5,4,3,true);
cropGeo.translate(0,.75,0);
const cropMat=new THREE.MeshStandardMaterial({color:0x7FA344,roughness:.9});
cropMat.onBeforeCompile=sh=>{
  sh.uniforms.uTime=cwUniforms.time;sh.uniforms.uWind=cwUniforms.wind;
  sh.vertexShader='uniform float uTime;uniform float uWind;\n'+sh.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
     vec4 wp=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
     float ph=wp.x*.7+wp.z*.9;
     float sway=sin(uTime*2.1+ph)*(.06+.30*uWind)*position.y;
     transformed.x+=sway;transformed.z+=sway*.5;`);
};
const N_CROP=1400;
const crops=new THREE.InstancedMesh(cropGeo,cropMat,N_CROP);
crops.castShadow=false;crops.receiveShadow=true;
{
  const mtx=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3();
  for(let i=0;i<N_CROP;i++){
    let x,z;
    do{x=-46+rand()*92;z=6+rand()*40}while(Math.abs(x)<3&&z<16); // keep road clear
    p.set(x,0,z);
    q.setFromAxisAngle(new THREE.Vector3(0,1,0),rand()*7);
    const sc=.7+rand()*.9;s.set(sc,sc*(.7+rand()*.7),sc);
    mtx.compose(p,q,s);crops.setMatrixAt(i,mtx);
    crops.setColorAt(i,new THREE.Color().setHSL(.22+rand()*.08,.5,.42+rand()*.12));
  }
  crops.instanceMatrix.needsUpdate=true;
}
scene.add(crops);

// ---------- KENNEL TREES (coconut palms, instanced fronds) ----------
function makePalm(){
  const g=new THREE.Group();
  const trunkH=6.5+rand()*2.5;
  const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,0,0),new THREE.Vector3(.35+rand()*.4,trunkH*.4,.2),
    new THREE.Vector3(.7+rand()*.5,trunkH*.75,.1),new THREE.Vector3(.5+rand()*.6,trunkH,0)]);
  const trunk=new THREE.Mesh(new THREE.TubeGeometry(curve,10,.16+trunkH*.018,7,false),
    new THREE.MeshStandardMaterial({color:0x8A6A42,roughness:.95}));
  trunk.castShadow=true;g.add(trunk);
  const top=curve.getPoint(1);
  const frondGeo=new THREE.PlaneGeometry(3.2,.5,8,1);
  const pos=frondGeo.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i);pos.setY(i,pos.getY(i)*(1-Math.abs(x)/1.9)*.9+ .12*(1-(x/1.6)**2)*-1);pos.setZ(i,-x*x*.045)}
  frondGeo.computeVertexNormals();
  const frondMat=new THREE.MeshStandardMaterial({map:TEX.leaf,color:0x6FA84F,roughness:.85,side:THREE.DoubleSide});
  const nF=7+Math.floor(rand()*3);
  for(let i=0;i<nF;i++){
    const f=new THREE.Mesh(frondGeo,frondMat);
    f.position.copy(top);f.rotation.y=i/nF*Math.PI*2+rand()*.4;
    f.rotation.z=-.35-rand()*.3;f.position.x+=Math.cos(f.rotation.y)*1.4;f.position.z+=Math.sin(f.rotation.y)*1.4;
    f.position.y-=.2;f.castShadow=true;
    f.userData.swayPh=rand()*7;g.userData.fronds=(g.userData.fronds||[]).concat(f);
    g.add(f);
  }
  // coconuts
  for(let i=0;i<3;i++){
    const c=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),new THREE.MeshStandardMaterial({color:0x6B4A26,roughness:.9}));
    c.position.set(top.x+rnd(.3,-.3),top.y-.25,top.z+rnd(.3,-.3));g.add(c);
  }
  return g;
}
const palms=[];
const palmSpots=[[-16,-2],[15,-4],[-21,6],[19,8],[-12,-14],[13,-13],[-26,-10],[24,-9],[8,-20],[-8,-22]];
for(const [x,z] of palmSpots){const p=makePalm();p.position.set(x,0,z);p.rotation.y=rand()*7;p.scale.setScalar(.8+rand()*.5);palms.push(p);scene.add(p)}

// big banyan-ish tree right side
(function(){
  const g=new THREE.Group();g.position.set(21,0,-6);
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.5,5,10),new THREE.MeshStandardMaterial({color:0x6E4A28,roughness:1}));
  trunk.position.y=2.5;trunk.castShadow=true;g.add(trunk);
  for(let i=0;i<9;i++){
    const blob=new THREE.Mesh(new THREE.SphereGeometry(2+rand()*1.6,10,8),new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.27,.45,.32+rand()*.08),roughness:.95}));
    blob.position.set(rnd(5,-5),6+rnd(2.6,-1),rnd(5,-5));blob.scale.y=.7;blob.castShadow=true;
    blob.userData.blob=true;blob.userData.ph=rand()*7;g.add(blob);
  }
  scene.add(g);palms.push(g);
})();

// ---------- HOUSES ----------
function makeHouse(scale=1,roofCol=0xC84B31){
  const g=new THREE.Group();
  const W=3.4,H=2.4,D=3;
  const walls=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),new THREE.MeshStandardMaterial({map:TEX.wall,roughness:.95}));
  walls.position.y=H/2;walls.castShadow=true;walls.receiveShadow=true;g.add(walls);
  // sloped roof — two slabs
  const roofMat=new THREE.MeshStandardMaterial({map:TEX.thatch,color:roofCol,roughness:.9});
  const r1=new THREE.Mesh(new THREE.BoxGeometry(W+.8,1.9,.35),roofMat);
  r1.position.set(0,H+.62,-.62);r1.rotation.x=.62;r1.castShadow=true;g.add(r1);
  const r2=r1.clone();r2.position.z=.62;r2.rotation.x=-.62;g.add(r2);
  // door
  const door=new THREE.Mesh(new THREE.BoxGeometry(.8,1.5,.1),new THREE.MeshStandardMaterial({color:0x5C3A1E,roughness:.9}));
  door.position.set(0,.78,D/2+.02);g.add(door);
  // windows
  for(const sx of[-1,1]){
    const win=new THREE.Mesh(new THREE.BoxGeometry(.6,.6,.08),new THREE.MeshStandardMaterial({color:0x2A4A5A,roughness:.4,metalness:.2}));
    win.position.set(sx*1.1,1.5,D/2+.02);g.add(win);
  }
  // rangoli at door
  const ran=new THREE.Mesh(new THREE.CircleGeometry(.7,20),new THREE.MeshStandardMaterial({map:TEX.rangoli,transparent:true,roughness:1}));
  ran.rotation.x=-Math.PI/2;ran.position.set(0,.02,D/2+.7);g.add(ran);
  g.scale.setScalar(scale);
  return g;
}
const houses=[];
[[-10,-4,.95],[9.5,-6,1],[-15,-9,.85],[14.5,-11,.9]].forEach(([x,z,s],i)=>{
  const h=makeHouse(s,i%2?0xB3400F:0xC84B31);h.position.x=x;h.position.z=z;h.rotation.y=(x>0?-.25:.25)+rnd(.2,-.2);houses.push(h);scene.add(h);
});

// ---------- TEMPLE with gopuram ----------
let KALASHA=null;const FLAGS=[];
const temple=new THREE.Group();temple.position.set(0,0,-24);
(function(){
  const stone=new THREE.MeshStandardMaterial({color:0xE8D8B0,roughness:.9});
  const stoneDark=new THREE.MeshStandardMaterial({color:0xD9C08A,roughness:.9});
  const base=new THREE.Mesh(new THREE.BoxGeometry(6,.6,5),stone);base.position.y=.3;base.receiveShadow=true;temple.add(base);
  // stepped tower
  let w=4.6,h=1.1,d=3.8,y=.6;
  for(let i=0;i<5;i++){
    const t=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),i%2?stoneDark:stone);
    t.position.y=y+h/2;t.castShadow=true;temple.add(t);
    // mini kalashas on edges
    for(const sx of[-1,1]){
      const k=new THREE.Mesh(new THREE.SphereGeometry(.14,8,6),new THREE.MeshStandardMaterial({color:0xF59E0B,metalness:.7,roughness:.3}));
      k.position.set(sx*w/2,y+h+.1,d/2);temple.add(k);
    }
    y+=h;w*=.78;d*=.8;h*=.92;
  }
  // main kalasha
  const kal=new THREE.Mesh(new THREE.SphereGeometry(.34,10,8),new THREE.MeshStandardMaterial({color:0xFFC53D,metalness:.85,roughness:.25,emissive:0x553300,emissiveIntensity:.3}));
  kal.position.y=y+.3;temple.add(kal);kal.userData.kalasha=true;KALASHA=kal;
  // garbhagriha doorway
  const dr=new THREE.Mesh(new THREE.BoxGeometry(1,1.6,.1),new THREE.MeshStandardMaterial({color:0x3A2412}));
  dr.position.set(0,1.1,2.45);temple.add(dr);
  // pillars
  for(const sx of[-2,2]){
    const pl=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,2.2,8),stoneDark);pl.position.set(sx,1.1,2.6);pl.castShadow=true;temple.add(pl);
  }
  // flag
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,1.6,6),new THREE.MeshStandardMaterial({color:0x777777,metalness:.6}));
  pole.position.set(2.2,1.4+.8,1.5);temple.add(pole);
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(.8,.4),new THREE.MeshStandardMaterial({color:0xC84B31,side:THREE.DoubleSide}));
  fl.position.set(2.6,2.5,1.5);fl.userData.flag=true;FLAGS.push(fl);temple.add(fl);
})();
scene.add(temple);

// ---------- WINDMILL (renewable energy nod) ----------
const windmill=new THREE.Group();windmill.position.set(-24,0,-16);
(function(){
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.12,.22,9,8),new THREE.MeshStandardMaterial({color:0xDDDDDD,roughness:.5,metalness:.3}));
  mast.position.y=4.5;mast.castShadow=true;windmill.add(mast);
  const hub=new THREE.Group();hub.position.set(0,9,.3);
  for(let i=0;i<3;i++){
    const bl=new THREE.Mesh(new THREE.BoxGeometry(.16,3.4,.05),new THREE.MeshStandardMaterial({color:0xF5F5F5,roughness:.4}));
    bl.position.y=1.7;bl.rotation.z=0;
    const holder=new THREE.Group();holder.rotation.z=i*Math.PI*2/3;holder.add(bl);hub.add(holder);
  }
  windmill.add(hub);windmill.userData.hub=hub;
})();
scene.add(windmill);

// ---------- OIL LAMPS (diyas) ----------
const diyas=[];
function makeDiya(x,z,lit=false){
  const g=new THREE.Group();g.position.set(x,.05,z);
  const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.3,.16,.16,12),new THREE.MeshStandardMaterial({color:0xB06030,roughness:.6}));
  bowl.castShadow=true;g.add(bowl);
  const flame=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glow,color:0xFFB347,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  flame.scale.set(.5,.7,1);flame.position.y=.3;g.add(flame);
  const pt=new THREE.PointLight(0xFFA040,lit?1.4:0,6,2);pt.position.y=.45;g.add(pt);
  g.userData={flame,light:pt,on:lit};
  scene.add(g);diyas.push(g);return g;
}
for(const [x,z] of [[-3.2,4],[3.2,4],[-6,-1],[6.4,-1.6],[-1.6,-19],[1.6,-19]]) makeDiya(x,z,false);

// ---------- CART (life's journey "ಬದುಕೆಂಬ ಗಾಡಿ") ----------
const cart=new THREE.Group();
(function(){
  const wood=new THREE.MeshStandardMaterial({color:0x8A5A2E,roughness:.9});
  const bed=new THREE.Mesh(new THREE.BoxGeometry(2.6,.18,1.5),wood);bed.position.y=.75;bed.castShadow=true;cart.add(bed);
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(2.6,.5,.08),wood);rail.position.set(0,1.05,sz*.72);rail.castShadow=true;cart.add(rail);
  }
  // canopy poles + cloth
  for(const sx of[-1.1,1.1])for(const sz of[-.6,.6]){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,1.4,6),wood);p.position.set(sx,1.7,sz);cart.add(p);
  }
  const cloth=new THREE.Mesh(new THREE.PlaneGeometry(2.7,1.6),new THREE.MeshStandardMaterial({color:0xF59E0B,side:THREE.DoubleSide,roughness:.8}));
  cloth.rotation.x=Math.PI/2;cloth.position.y=2.42;cloth.userData.canopy=true;FLAGS.push(cloth);cart.add(cloth);
  // wheels
  cart.userData.wheels=[];
  for(const [wx,wz,wr] of [[-1,.78,.55],[1,.78,.55],[-1,-.78,.55],[1,-.78,.55]]){
    const wg=new THREE.Group();wg.position.set(wx,wr,wz);
    const tire=new THREE.Mesh(new THREE.TorusGeometry(wr-.06,.06,8,18),wood);
    const spokes=new THREE.Group();
    for(let i=0;i<4;i++){const sp=new THREE.Mesh(new THREE.BoxGeometry(wr*1.8,.05,.05),wood);sp.rotation.z=i*Math.PI/4;spokes.add(sp)}
    wg.add(tire,spokes);wg.rotation.y=Math.PI/2;cart.add(wg);cart.userData.wheels.push(wg);
  }
  // axle
  const ax=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,2.9,6),wood);ax.rotation.z=Math.PI/2;ax.position.y=.55;cart.add(ax);
  // pot on cart
  const pot=new THREE.Mesh(new THREE.SphereGeometry(.4,10,8),new THREE.MeshStandardMaterial({color:0xA0522D,roughness:.7}));
  pot.position.set(-.5,1.2,0);pot.castShadow=true;cart.add(pot);
})();
cart.position.set(0,0,10);cart.visible=false;scene.add(cart);

let CANAL=null,SPARKS=null;
// ---------- PUMPS / TANK / PIPE (ನೀರಿನ ಹೊಳೆ) ----------
const waterGroup=new THREE.Group();scene.add(waterGroup);
(function(){
  const metal=new THREE.MeshStandardMaterial({color:0x607080,metalness:.6,roughness:.4});
  const tank=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,2.4,16),new THREE.MeshStandardMaterial({color:0x3B7A23,roughness:.7}));
  tank.position.set(-13,.2+1.2,10);tank.castShadow=true;waterGroup.add(tank);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(1.4,16,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0x2F6018,roughness:.7}));
  cap.position.set(-13,2.6,10);waterGroup.add(cap);
  // pipe from tank toward field channel
  const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,10,8),metal);
  pipe.rotation.z=Math.PI/2;pipe.position.set(-8,.6,10);waterGroup.add(pipe);
  const motor=new THREE.Mesh(new THREE.BoxGeometry(.8,.7,.6),metal);motor.position.set(-11.4,.9,10);waterGroup.add(motor);
  // canal along the road edge
  const canal=new THREE.Mesh(new THREE.BoxGeometry(60,.12,1.1),new THREE.MeshStandardMaterial({color:0x3E8DA8,roughness:.25,metalness:.1,transparent:true,opacity:.85}));
  canal.position.set(0,.06,14.2);waterGroup.add(canal);canal.userData.canal=true;CANAL=canal;
  // sparkles over canal
  const spkGeo=new THREE.BufferGeometry();
  const N=90;const arr=new Float32Array(N*3);const spd=[];
  for(let i=0;i<N;i++){arr[i*3]=-30+rand()*60;arr[i*3+1]=.15+rand()*.3;arr[i*3+2]=13.6+rand()*1.2;spd.push(.2+rand()*.8)}
  spkGeo.setAttribute('position',new THREE.BufferAttribute(arr,3));
  const spk=new THREE.Points(spkGeo,new THREE.PointsMaterial({map:TEX.firefly,size:.22,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,color:0xBFEFFF}));
  waterGroup.add(spk);spk.userData.spd=spd;SPARKS=spk;
})();

// ---------- DOGS & GOAT ----------
function critBody(col){
  const g=new THREE.Group();
  const m=new THREE.MeshStandardMaterial({color:col,roughness:.9});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.22,.55,4,8),m);body.rotation.z=Math.PI/2;body.position.y=.42;body.castShadow=true;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.18,8,8),m);head.position.set(.5,.55,0);g.add(head);
  const snout=new THREE.Mesh(new THREE.BoxGeometry(.14,.1,.12),m);snout.position.set(.68,.5,0);g.add(snout);
  g.userData.legs=[];
  for(const [lx,lz] of [[.3,.16],[.3,-.16],[-.3,.16],[-.3,-.16]]){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.05,.045,.4,6),m);leg.position.set(lx,.2,lz);g.add(leg);g.userData.legs.push(leg);
  }
  const tail=new THREE.Mesh(new THREE.CylinderGeometry(.03,.02,.3,5),m);tail.position.set(-.5,.6,0);tail.rotation.z=.9;g.add(tail);g.userData.tail=tail;
  return g;
}
const dogA=critBody(0xC8A074),dogB=critBody(0xE8E0D0);
dogA.position.set(4,0,6);dogB.position.set(-5,0,8);scene.add(dogA,dogB);
const goat=critBody(0xF0EDE4);goat.scale.setScalar(.8);goat.position.set(11,0,4);goat.userData.horns=true;
for(const sx of[-1,1]){const hn=new THREE.Mesh(new THREE.ConeGeometry(.03,.2,5),new THREE.MeshStandardMaterial({color:0x8A7A60}));hn.position.set(.45+sx*.05,.75,sx*.08);hn.rotation.z=-sx*.6;goat.add(hn)}
scene.add(goat);
const animals=[{g:dogA,cx:5,cz:7,r:3,v:.9,ph:0},{g:dogB,cx:-6,cz:9,r:3.5,v:.7,ph:2},{g:goat,cx:12,cz:5,r:2.5,v:.5,ph:4}];

// ---------- CHILDREN (dancing stick figures with spheres) ----------
const kids=[];
function makeKid(col){
  const g=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:0x9A6A40,roughness:.8});
  const shirt=new THREE.MeshStandardMaterial({color:col,roughness:.8});
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.16,.4,4,8),shirt);torso.position.y=.85;torso.castShadow=true;g.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),skin);head.position.y=1.32;g.add(head);
  // hair tuft
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0x201510,roughness:1}));hair.position.y=1.36;g.add(hair);
  g.userData.arms=[];g.userData.legs=[];
  for(const s of[-1,1]){
    const arm=new THREE.Group();arm.position.set(s*.2,1.1,0);
    const am=new THREE.Mesh(new THREE.CapsuleGeometry(.05,.34,4,6),skin);am.position.y=-.17;am.rotation.z=s*.2;arm.add(am);g.add(arm);g.userData.arms.push(arm);
    const leg=new THREE.Group();leg.position.set(s*.09,.5,0);
    const lm=new THREE.Mesh(new THREE.CapsuleGeometry(.06,.34,4,6),new THREE.MeshStandardMaterial({color:0x4A3A2A,roughness:.9}));lm.position.y=-.2;leg.add(lm);g.add(leg);g.userData.legs.push(leg);
  }
  return g;
}
[[0xF59E0B,-2.2,3],[0x2A6F97,-1.2,3.6],[0xC84B31,-.2,2.8],[0x3B7A23,.9,3.5],[0x9A5FBF,2,3]].forEach(([c,x,z],i)=>{
  const k=makeKid(c);k.position.set(x,0,z);k.scale.setScalar(.8+i%3*.12);kids.push(k);scene.add(k);
});

// ---------- PEACOCKS ----------
function makePeacock(){
  const g=new THREE.Group();
  const bodyM=new THREE.MeshStandardMaterial({color:0x1E6FA8,roughness:.5,metalness:.1});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.18,.4,4,8),bodyM);body.rotation.z=Math.PI/2.6;body.position.y=.5;g.add(body);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.05,.08,.5,8),bodyM);neck.position.set(.18,.85,0);neck.rotation.z=-.3;g.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.09,8,8),bodyM);head.position.set(.28,1.12,0);g.add(head);
  const crest=new THREE.Mesh(new THREE.ConeGeometry(.03,.14,5),new THREE.MeshStandardMaterial({color:0x2FA85A}));crest.position.set(.28,1.26,0);g.add(crest);
  // fan
  const fan=new THREE.Group();fan.position.set(-.28,.6,0);
  for(let i=0;i<11;i++){
    const feather=new THREE.Group();
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.7,4),new THREE.MeshStandardMaterial({color:0x3FA86A}));
    shaft.position.y=.35;feather.add(shaft);
    const eye=new THREE.Mesh(new THREE.CircleGeometry(.09,10),new THREE.MeshStandardMaterial({color:0x14507A,side:THREE.DoubleSide}));
    eye.position.y=.68;feather.add(eye);
    const eye2=new THREE.Mesh(new THREE.CircleGeometry(.045,8),new THREE.MeshStandardMaterial({color:0xC8A030,side:THREE.DoubleSide}));
    eye2.position.y=.68;eye2.position.z=.005;feather.add(eye2);
    feather.rotation.z=Math.PI/2+(i-5)*.16;feather.rotation.x=.15;fan.add(feather);
  }
  fan.rotation.y=.4;g.add(fan);g.userData.fan=fan;g.userData.ph=rand()*7;
  return g;
}
const peacocks=[];
for(const [x,z] of [[-16,2],[17,2]]){const p=makePeacock();p.position.set(x,0,z);p.rotation.y=x<0?.8:-.8;p.scale.setScalar(1.2);peacocks.push(p);scene.add(p)}

// ---------- SUGARCANE ARROW ("ಮುಂದೆ ಸಾಗೋರು") ----------
const arrow=new THREE.Group();
(function(){
  const cane=new THREE.MeshStandardMaterial({color:0x8FBF5A,roughness:.7});
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,3.4,8),cane);shaft.rotation.z=-Math.PI/2;arrow.add(shaft);
  for(let i=0;i<4;i++){const node=new THREE.Mesh(new THREE.TorusGeometry(.08,.02,6,10),new THREE.MeshStandardMaterial({color:0x6FA040}));node.position.x=-1.4+i*.9;node.rotation.y=Math.PI/2;arrow.add(node)}
  const tipG=new THREE.ConeGeometry(.3,.8,4);
  const tip=new THREE.Mesh(tipG,new THREE.MeshStandardMaterial({color:0xE8D8A0,roughness:.5}));
  tip.rotation.z=-Math.PI/2;tip.position.x=2.1;arrow.add(tip);
  const fletch=new THREE.Mesh(new THREE.PlaneGeometry(.7,.5),new THREE.MeshStandardMaterial({color:0xC84B31,side:THREE.DoubleSide}));
  fletch.position.x=-1.8;arrow.add(fletch);
})();
arrow.position.set(-26,3.4,2);arrow.visible=false;scene.add(arrow);

// ---------- DIYA RIVER (kidi-kidi → deepa) ----------
const riverDiyas=[];
(function(){
  const geo=new THREE.CylinderGeometry(.22,.12,.1,10);
  const mat=new THREE.MeshStandardMaterial({color:0xB06030,roughness:.6});
  for(let i=0;i<14;i++){
    const g=new THREE.Group();
    const b=new THREE.Mesh(geo,mat);g.add(b);
    const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.glow,color:0xFFB347,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    fl.scale.set(.35,.5,1);fl.position.y=.25;g.add(fl);
    g.position.set(-30+rand()*60,.12,13.7+rand()*.6);
    g.userData={vx:.6+rand()*.8,fl};
    scene.add(g);riverDiyas.push(g);
  }
})();

// ---------- PARTICLE POOLS ----------
class Pool{
  constructor(n,tex,size,color,additive=true){
    this.n=n;this.pos=new Float32Array(n*3);this.vel=new Float32Array(n*3);this.life=new Float32Array(n);this.max=new Float32Array(n);this.size=new Float32Array(n);
    this.geo=new THREE.BufferGeometry();
    this.geo.setAttribute('position',new THREE.BufferAttribute(this.pos,3));
    this.mat=new THREE.PointsMaterial({map:tex,size,sizeAttenuation:true,transparent:true,depthWrite:false,color:new THREE.Color(color),blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});
    this.pts=new THREE.Points(this.geo,this.mat);
    this.cursor=0;this.gravity=-3;this.drag=.985;
    for(let i=0;i<n;i++){this.pos[i*3+1]=-999;this.life[i]=0}
    scene.add(this.pts);
  }
  emit(x,y,z,vx,vy,vz,life,size){
    const i=this.cursor;this.cursor=(this.cursor+1)%this.n;
    this.pos[i*3]=x;this.pos[i*3+1]=y;this.pos[i*3+2]=z;
    this.vel[i*3]=vx;this.vel[i*3+1]=vy;this.vel[i*3+2]=vz;
    this.life[i]=life;this.max[i]=life;this.size[i]=size;
  }
  update(dt){
    for(let i=0;i<this.n;i++){
      if(this.life[i]<=0)continue;
      this.life[i]-=dt;
      if(this.life[i]<=0){this.pos[i*3+1]=-999;continue}
      this.vel[i*3+1]+=this.gravity*dt;
      this.vel[i*3]*=this.drag;this.vel[i*3+1]*=this.drag;this.vel[i*3+2]*=this.drag;
      this.pos[i*3]+=this.vel[i*3]*dt;this.pos[i*3+1]+=this.vel[i*3+1]*dt;this.pos[i*3+2]+=this.vel[i*3+2]*dt;
    }
    this.geo.attributes.position.needsUpdate=true;
  }
}
const petals=new Pool(500,TEX.petal,.5,0xFFD8C0,false);petals.gravity=-.6;petals.drag=.995;
const sparks=new Pool(300,TEX.firefly,.35,0xFFC860);sparks.gravity=-1.2;
const gold=new Pool(260,TEX.glow,.7,0xFFD964);gold.gravity=-.4;
const fireflies=new Pool(120,TEX.firefly,.3,0xFFE080);fireflies.gravity=0;fireflies.drag=1;

// floating lanterns for hook sections
const lanterns=[];
for(let i=0;i<8;i++){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.SphereGeometry(.3,10,8),new THREE.MeshStandardMaterial({color:0xFFB347,emissive:0xFF8A2A,emissiveIntensity:.9,roughness:.5,transparent:true,opacity:.92}));
  g.add(body);
  const lt=new THREE.PointLight(0xFFA040,1.2,9,2);g.add(lt);
  g.position.set(rnd(24,-24),2+rand()*4,rnd(-8,-24));
  g.userData={vy:.5+rand()*.6,ph:rand()*7,body,lt};
  scene.add(g);lanterns.push(g);
}

// confetti burst pool (section changes)
const confetti=new Pool(400,TEX.petal,.42,0xFFFFFF,false);confetti.gravity=-4;
{ // enable per-particle colors on confetti
  const cols=new Float32Array(confetti.n*3).fill(1);
  confetti.geo.setAttribute('color',new THREE.BufferAttribute(cols,3));
  confetti.mat.vertexColors=true;
  confetti.setColor=function(i,hex){const c=new THREE.Color(hex);cols[i*3]=c.r;cols[i*3+1]=c.g;cols[i*3+2]=c.b;confetti.geo.attributes.color.needsUpdate=true};
}
const CONF_COLORS=[0xC84B31,0xF59E0B,0x3B7A23,0x2A6F97,0xFFF3CD];

// ---------- audio analysis state ----------
const A={bass:0,mid:0,high:0,air:0,rms:0,pulse:0,pulseFast:0,beatGap:1};
let ONSETS=[],onsetIdx=0,lastOnsetT=0;

// ---------- timeline data ----------
let TL=null,CUES=[],FPSV=50;
let BAND={bass:null,mid:null,high:null,air:null,rms:null};
function sampleBand(arr,t){const i=clamp(Math.floor(t*FPSV),0,arr.length-1);return arr[i]}

// ---------- lyric engine ----------
const VARIANTS=['v-rise','v-pop','v-flip','v-swirl','v-drop','v-wave'];
let curBlock=null,curCueIdx=-1,lastCueIdx=-1;
let wordEls=[],wordRanges=[]; // karaoke mapping
let cueStartRender=0;

function fitFont(blk){
  requestAnimationFrame(()=>{
    const lines=[...blk.querySelectorAll('.kn-line')];if(!lines.length)return;
    for(let fs=8.4;fs>=3.6;fs-=0.4){
      lines.forEach(l=>l.style.fontSize=fs+'vh');
      if(lines.every(l=>l.getBoundingClientRect().width<=blk.clientWidth*0.97))break;
    }
    const en=[...blk.querySelectorAll('.en-line')];
    en.forEach(e=>e.style.fontSize='3.1vh');
  });
}
function buildBlock(cue,idx){
  const theme=themeFor(cue.t);
  const blk=document.createElement('div');blk.className='line-block';
  blk.style.setProperty('--tc',theme.tc);blk.style.setProperty('--bc',theme.bc);
  const badge=document.createElement('div');badge.className='badge';badge.textContent=cue.t;
  blk.appendChild(badge);
  const knLines=cue.kn.split('\n');
  const enLines=(cue.en||'').split('\n');
  const isInterlude=/♫/.test(cue.kn);
  const totalChars=isInterlude?1:[...cue.kn.replace(/\n/g,'')].length;
  wordRanges=[];wordEls=[];let charAcc=0;
  const perLine=knLines.map(L=>[...L.replace(/\s/g,'')].length||1);
  knLines.forEach((L,li)=>{
    const ln=document.createElement('span');ln.className='kn-line '+VARIANTS[(idx*2+li)%VARIANTS.length];
    const words=L.split(/(\s+)/);
    let wc=0;words.forEach(w=>{
      if(!w.trim()){ln.appendChild(document.createTextNode(w));return}
      const wd=document.createElement('span');wd.className='word';
      wd.textContent=w;
      const hl=document.createElement('span');hl.className='hl';hl.textContent=w;wd.appendChild(hl);
      ln.appendChild(wd);
      const n=[...w.replace(/\s/g,'')].length;
      const fracStart=(charAcc)/totalChars,fracEnd=(charAcc+n)/totalChars;
      wordRanges.push({el:wd,hl,s:fracStart,e:fracEnd,line:li});
      wordEls.push(wd);charAcc+=n;wc++;
    });
    blk.appendChild(ln);blk.appendChild(document.createElement('br'));
  });
  enLines.forEach((L,li)=>{
    if(!L)return;
    const ln=document.createElement('span');ln.className='en-line';
    ln.style.fontSize=isInterlude?'3.6vh':'3.2vh';
    ln.textContent=L;blk.appendChild(ln);
  });
  // stagger delays; entrance variant chosen per line (varied, deterministic)
  let dly=0;
  for(const w of wordRanges){w.el.style.animationDelay=dly.toFixed(3)+'s';dly+=0.06}
  fitFont(blk);
  requestAnimationFrame(()=>{badge.classList.add('show');blk.querySelectorAll('.en-line').forEach(e=>e.classList.add('show'))});
  return blk;
}

function showCue(idx,seeking){
  const cue=CUES[idx];if(!cue)return;
  if(curBlock){const old=curBlock;old.classList.add('out');setTimeout(()=>old.remove(),600)}
  curBlock=buildBlock(cue,idx);lyricLayer.appendChild(curBlock);
  curCueIdx=idx;
  // section change detection
  if(idx===0||CUES[idx-1].t!==cue.t){
    announceSection(cue.t,seeking);
    onSectionChange(cue.t);
  }
}
function announceSection(t,seeking){
  const st=titleFor(t)||SECTION_TITLES['ಪಲ್ಲವಿ'];if(!st)return;
  secTitleEl.querySelector('.st-kn').textContent=st.kn;
  secTitleEl.querySelector('.st-en').textContent=st.en;
  secTitleEl.classList.remove('play');void secTitleEl.offsetWidth;secTitleEl.classList.add('play');
  if(!seeking)confettiBurst();
}
function confettiBurst(){
  for(let i=0;i<160;i++){
    confetti.emit(rnd(1,-1),3+rnd(2,-1),rnd(1,-1),rnd(9,-9),4+rand()*7,rnd(3,-3),1.6+rand()*1.2,.5);
    confetti.setColor(confetti.cursor,(CONF_COLORS[Math.floor(rand()*CONF_COLORS.length)]));
  }
  for(let i=0;i<70;i++)sparks.emit(rnd(6,-6),3+rand()*2,-2+rand()*4,rnd(4,-4),3+rand()*5,rnd(2,-2),1+rand(),.4);
  flashScreen(.5);
}
function flashScreen(a){flashEl.style.transition='none';flashEl.style.opacity=a;requestAnimationFrame(()=>{flashEl.style.transition='opacity .5s ease-out';flashEl.style.opacity=0})}

// interlude flying notes
let noteTimer=0;
function spawnFlyNote(){
  const glyphs=['♪','♫','♩','🎵','✦'];
  const n=document.createElement('div');n.className='fly-note';
  n.textContent=glyphs[Math.floor(rand()*glyphs.length)];
  n.style.left=(10+rand()*80)+'%';n.style.top=(55+rand()*20)+'%';
  n.style.animationDuration=(2.4+rand()*2)+'s';
  lyricLayer.appendChild(n);setTimeout(()=>n.remove(),4600);
}

// ---------- mood-driven scene state ----------
let mood=0,moodTarget=0;
let hookMode=0; // gadibidi intensity
function onSectionChange(t){
  const th=THEMES[t]||THEMES['ಪಲ್ಲವி'];
  moodTarget=th.mood;
  // cross-fade sky texture
  skyMat.map=getSkyTex(th.sky);skyMat.needsUpdate=true;
  // fog color tween handled in update via lerping to targets
  fogTarget.copy(th.fog);ambTarget.copy(th.amb);dirTarget.copy(th.dir);sunColTarget.copy(th.sun);
  lightAllDiyas((t||'').indexOf('ಔಟ್ರೋ')>=0 || (t||'').indexOf('ಲ್ಯೂಡ್')>=0 || (t||'').indexOf('ಗಡಿಬಿಡಿ')>=0);
  // reveal props
  arrow.visible=(t||'').indexOf('ಪಲ್ಲವಿ')===0|| (t||'')==='ಪಲ್ಲವಿ';
  cart.visible=(t||'').indexOf('ಗಡಿಬಿಡಿ')>=0;
}
function hookNow(){return curCueIdx>=0&&CUES[curCueIdx]&&(CUES[curCueIdx].t||'').indexOf('ಗಡಿಬಿಡಿ')>=0}
function lightAllDiyas(on){diyas.forEach(d=>{d.userData.wantOn=on})}

const fogTarget=new THREE.Color(0xEADFC8),ambTarget=new THREE.Color(0xBFD8E8),dirTarget=new THREE.Color(0xFFDFB0),sunColTarget=new THREE.Color(0xFFE9B8);

// ---------- camera rig ----------
const camState={pos:new THREE.Vector3(0,4.6,17.5),look:new THREE.Vector3(0,2.2,-4)};
const CAM_KEY={
 intro:{p:[0,5.2,20],l:[0,2.6,-10]},
 pallavi:{p:[0,4.6,17.5],l:[0,2.2,-4]},
 pallaviWide:{p:[-6,3.8,15],l:[2,2.4,-8]},
 hook:{p:[3,3.2,13],l:[-1,2,-2]},
 hookLow:{p:[-4,1.6,12],l:[1,1.6,-4]},
 interlude:{p:[0,7.5,20],l:[0,1.5,-14]},
 charana:{p:[-2,5.4,16],l:[0,2.6,-8]},
 outro:{p:[0,3.4,11],l:[0,2.4,-20]},
};
function camKeysFor(t,m){
  switch(t){
    case 0:return Math.sin(m*.13)>0?CAM_KEY.pallavi:CAM_KEY.pallaviWide;
    case 1:return Math.sin(m*.2)>0?CAM_KEY.hook:CAM_KEY.hookLow;
    case 2:return CAM_KEY.interlude;
    case 3:return CAM_KEY.charana;
    case 4:return CAM_KEY.outro;
  }
  return CAM_KEY.pallavi;
}

// ---------- resize ----------
function resize(){
  const w=stage.clientWidth,h=stage.clientHeight;
  renderer.setSize(w,h,false);
  camera.aspect=w/h;camera.updateProjectionMatrix();
}
addEventListener('resize',resize);resize();

// ---------- transport ----------
let playing=false,seekDirty=false;
function fmt(t){t=Math.max(0,t);return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')}
playBtn.onclick=()=>{playing?media.pause():media.play()};
document.getElementById('big-play').onclick=()=>{startEl.classList.add('hidden');media.volume=+volEl.value;media.play().catch(()=>{})};
volEl.oninput=()=>media.volume=+volEl.value;
seekEl.oninput=()=>{media.currentTime=+seekEl.value;seekDirty=true;resetOnsetCursor(+seekEl.value)};
document.getElementById('btn-cine').onclick=()=>stage.classList.toggle('cine');
document.getElementById('btn-reset').onclick=()=>{media.currentTime=0;resetOnsetCursor(0)};
media.addEventListener('play',()=>{playing=true;playBtn.textContent='⏸'});
media.addEventListener('pause',()=>{playing=false;playBtn.textContent='▶'});
media.addEventListener('ended',()=>{playing=false;playBtn.textContent='▶'});
addEventListener('keydown',e=>{
  if(e.code==='Space'){e.preventDefault();playing?media.pause():media.play()}
  if(e.code==='ArrowRight'){media.currentTime=Math.min(media.duration||161.31,media.currentTime+5);resetOnsetCursor(media.currentTime)}
  if(e.code==='ArrowLeft'){media.currentTime=Math.max(0,media.currentTime-5);resetOnsetCursor(media.currentTime)}
  if(e.key==='c'||e.key==='C')stage.classList.toggle('cine');
  if(e.key==='l'||e.key==='L'){document.getElementById('controls').classList.toggle('pin')}
});
function resetOnsetCursor(t){onsetIdx=lowerBound(ONSETS,t)}
function lowerBound(arr,v){let lo=0,hi=arr.length;while(lo<hi){const m=(lo+hi)>>1;if(arr[m]<v)lo=m+1;else hi=m}return lo}

// ---------- onset reactions ----------
function processOnsets(t,dt){
  while(onsetIdx<ONSETS.length&&ONSETS[onsetIdx]<=t){
    const o=ONSETS[onsetIdx];
    if(t-o<0.35){reactOnset(o)}
    onsetIdx++;
  }
}
function reactOnset(t){
  A.pulse=Math.min(1.4,A.pulse+0.9);A.pulseFast=1;
  A.beatGap=t-lastOnsetT;lastOnsetT=t;
  const hook=hookNow();
  // ambient sparkle every few onsets
  if(Math.random()<.7){
    const x=rnd(20,-20),y=1+Math.random()*4,z=rnd(6,-18);
    sparks.emit(x,y,z,rnd(1.5,-1.5),2+Math.random()*2.5,rnd(1,-1),.8+Math.random()*.6,.35);
  }
  if(hook){
    gold.emit(rnd(14,-14),2+Math.random()*3,rnd(-4,-16),rnd(2,-2),3+Math.random()*3,rnd(1,-1),1.2,.6);
  }
  // strong beat pulse on lamps
  diyas.forEach(d=>{if(d.userData.on)d.userData.fl.scale.set(.45+Math.random()*.25,.65+Math.random()*.3,1)});
}

// ---------- main loop ----------
let lastT=performance.now()/1000,elapsed=0;
function animate(){
  requestAnimationFrame(animate);
  const now=performance.now()/1000;let dt=Math.min(.05,now-lastT);lastT=now;elapsed+=dt;
  const t=media.currentTime||0;

  // ---- sample audio bands ----
  if(BAND.bass){
    A.bass=sampleBand(BAND.bass,t);A.mid=sampleBand(BAND.mid,t);
    A.high=sampleBand(BAND.high,t);A.air=sampleBand(BAND.air,t);A.rms=sampleBand(BAND.rms,t);
  }
  A.pulse=Math.max(0,A.pulse-dt*3.2);A.pulseFast=Math.max(0,A.pulseFast-dt*6);
  if(playing)processOnsets(t,dt);

  // ---- cue sync ----
  let idx=-1;
  for(let i=0;i<CUES.length;i++){if(t>=CUES[i].s&&t<CUES[i].e){idx=i;break}}
  if(idx!==curCueIdx&&idx>=0){showCue(idx,seekDirty);seekDirty=false}
  if(idx===-1&&curCueIdx>=0&&t>=CUES[curCueIdx]?.e){/* keep block until next */}
  // karaoke highlight
  if(curBlock&&curCueIdx>=0){
    const cue=CUES[curCueIdx];
    const prog=clamp((t-cue.s)/(cue.e-cue.s-0.15),0,1);
    for(const w of wordRanges){
      const lp=clamp((prog-w.s)/Math.max(1e-4,w.e-w.s),0,1);
      w.hl.style.clipPath=`inset(0 ${(1-lp)*100}% 0 0)`;
      // bounce word when being sung
      if(lp>0&&lp<1){
        const b=Math.sin(elapsed*14+w.s*40)*.04*A.mid;
        w.el.style.transform=`translateY(${b}em) scale(${1+A.pulse*0.05})`;
      }else if(lp>=1){w.el.style.transform=`scale(${1+A.pulse*0.03})`}
    }
    // gentle whole-line breathing synced to rms
    const br=1+A.rms*0.035;
    curBlock.style.transform=`translate(-50%,-50%) scale(${br}) rotate(${Math.sin(elapsed*.7)*.4}deg)`;
  }
  // interlude notes
  const cue=CUES[curCueIdx];
  if(cue&&/♫/.test(cue.kn)){noteTimer-=dt;if(noteTimer<=0){spawnFlyNote();noteTimer=.35+rand()*.4}}

  // ---- mood / theme tween ----
  mood+=(moodTarget-mood)*Math.min(1,dt*1.4);
  scene.fog.color.lerp(fogTarget,dt*1.2);
  renderer.setClearColor(scene.fog.color);
  amb.color.lerp(ambTarget,dt*1.2);sun.color.lerp(dirTarget,dt*1.2);sunOrb.material.color.lerp(sunColTarget,dt*1.2);
  hookMode=lerp(hookMode,hookNow()?1:0,dt*2);
  const night=mood===4?1:0;
  renderer.toneMappingExposure=lerp(renderer.toneMappingExposure,1.08-A.rms*0.06+(mood===4?-0.06:0),dt*3);

  // ---- camera choreography ----
  const key=camKeysFor(CUES[curCueIdx]?themeFor(CUES[curCueIdx].t).mood:0,t);
  const driftX=Math.sin(t*.11)*1.6+Math.sin(t*.037)*.9;
  const driftY=Math.sin(t*.083)*.5;
  const shake=A.pulse*0.06*hookMode;
  const px=key.p[0]+driftX+(rand()-.5)*shake,py=key.p[1]+driftY+A.pulse*.18+(rand()-.5)*shake,pz=key.p[2]-hookMode*1.5;
  camState.pos.lerp(new THREE.Vector3(px,py,pz),dt*1.1);
  camState.look.lerp(new THREE.Vector3(key.l[0]+Math.sin(t*.07)*.6,key.l[1],key.l[2]),dt*1.1);
  camera.position.copy(camState.pos);camera.lookAt(camState.look);
  camera.rotation.z=Math.sin(t*.05)*.006+A.pulseFast*.01*(rand()-.5);

  // ---- sun orb pulses ----
  sunOrb.scale.setScalar(42+A.bass*26+A.pulse*8);
  sunOrb.position.y=44+(mood===4?-14:mood===1?-6:0)+Math.sin(t*.05)*2;

  // ---- clouds drift with bass ----
  for(const c of clouds){c.position.x+=c.userData.v*(0.5+A.rms)*dt*3;if(c.position.x>150)c.position.x=-150}

  // ---- birds fly faster during hook ----
  for(const b of birds){
    b.position.x+=b.userData.v*(1+hookMode*2.2)*dt*2.2;
    b.position.y=b.userData.base+Math.sin(elapsed*2+b.userData.ph)*.4;
    if(b.position.x>75)b.position.x=-75;
    const flap=Math.sin(elapsed*10+b.userData.ph)*.3;
    b.userData.l.rotation.x=flap;b.userData.r.rotation.x=flap;
  }

  // ---- wind uniform ----
  cwUniforms.time.value=elapsed;
  cwUniforms.wind.value=lerp(cwUniforms.wind.value,.2+A.air*.9+hookMode*.5,dt*3);

  // ---- palms sway ----
  for(const p of palms)(p.userData.fronds||[]).forEach(f=>{f.rotation.z=-.35+Math.sin(elapsed*2.1+f.userData.swayPh)*(.05+A.air*.18)});

  // ---- windmill spins with air band ----
  windmill.userData.hub.rotation.z+=(0.6+A.air*5+hookMode*3)*dt;

  // ---- flags/canopies flutter ----
  FLAGS.forEach((f,i)=>{f.rotation.z=Math.sin(elapsed*3+i)*.06*(1+A.air);f.position.y=(f.userData.canopy?2.42:2.5)+Math.sin(elapsed*4+i)*.03});

  // ---- kalasha glint ----
  if(KALASHA)KALASHA.material.emissiveIntensity=.3+A.pulse*.9+A.air*.4;

  // ---- temple step-light halo on beats ----
  sun.intensity=1.35+A.rms*.35+A.pulse*.25;

  // ---- diyas ramp ----
  diyas.forEach(d=>{
    const want=d.userData.wantOn&&!d.userData.on;
    if(want){d.userData.on=true}
    if(!d.userData.wantOn&&d.userData.on&&mood!==4){d.userData.on=false}
    const target=d.userData.on?(0.9+A.pulse*.8):0;
    d.userData.light.intensity=lerp(d.userData.light.intensity,target,dt*4);
    d.userData.flame.material.opacity=lerp(d.userData.flame.material.opacity,d.userData.on?1:0,dt*4);
    if(d.userData.on)d.userData.flame.scale.y=.6+Math.sin(elapsed*13+d.position.x)*.08+A.pulse*.2;
  });

  // ---- diya river flow (visible during spark→lamp & rush sections) ----
  const riverOn=hookNow()||(CUES[curCueIdx]&&(CUES[curCueIdx].t||'').indexOf('ಕಿಡಿ')>=0)||mood===4;
  riverDiyas.forEach(g=>{
    g.visible=riverOn;
    if(!riverOn)return;
    g.position.x+=g.userData.vx*(1+A.rms)*dt*2.2;
    g.position.y=.12+Math.sin(elapsed*3+g.position.x)*.03;
    if(g.position.x>32)g.position.x=-32;
    g.userData.fl.material.opacity=.5+A.pulse*.5;
  });

  // ---- cart gallop during hook ----
  if(cart.visible){
    const speed=3.2+A.rms*4+hookMode*3;
    cart.position.x+=speed*dt;
    if(cart.position.x>34)cart.position.x=-34;
    cart.position.y=Math.abs(Math.sin(elapsed*9))*0.06*(1+A.bass);
    cart.rotation.z=Math.sin(elapsed*9)*.015;
    cart.userData.wheels.forEach(w=>w.rotation.x-=speed*dt*1.9);
  }

  // ---- sugarcane arrow flies across during pallavi ----
  if(arrow.visible){
    arrow.position.x+= (7+A.mid*6)*dt;
    arrow.position.y=3.4+Math.sin(elapsed*3)*.3;
    arrow.rotation.z=Math.sin(elapsed*2)*.08;
    if(arrow.position.x>28)arrow.position.x=-28;
  }

  // ---- animals wander ----
  animals.forEach(a=>{
    a.ph+=dt*a.v;
    const g=a.g;
    g.position.x=a.cx+Math.cos(a.ph)*a.r;g.position.z=a.cz+Math.sin(a.ph)*a.r;
    g.rotation.y=-a.ph+Math.PI/2;
    g.userData.legs.forEach((l,i)=>l.rotation.x=Math.sin(elapsed*7+i*Math.PI)*.5);
    g.userData.tail.rotation.y=Math.sin(elapsed*6)*.4;
  });

  // ---- kids dance harder as energy rises ----
  const dk=.6+A.rms*1.6+hookMode*1.4+A.pulse*1.2;
  kids.forEach((k,i)=>{
    const ph=elapsed*(2.2+i*.22)+i;
    k.userData.arms.forEach((arm,s)=>{arm.rotation.z=s? -dk*(1+Math.sin(ph))*.9 : dk*(1+Math.cos(ph))*.9;arm.rotation.x=Math.sin(ph*1.3)*.4*dk});
    k.userData.legs.forEach((leg,s)=>{leg.rotation.x=Math.sin(ph*2+s*Math.PI)*.5*dk});
    k.position.y=Math.abs(Math.sin(ph*1.6))*.16*dk;
    k.rotation.y=Math.sin(ph*.5)*.5;
  });

  // ---- peacocks fan up on high-energy beats ----
  peacocks.forEach(p=>{
    const open=clamp(A.pulse*1.2+A.high*.6+(hookNow()?.4:0),0,1);
    p.userData.fan.children.forEach((f,i)=>{
      const spread=(i-5)*(.16+open*.12);
      f.rotation.z=Math.PI/2+spread;
      f.scale.setScalar(.6+open*.7);
    });
    p.userData.fan.rotation.x=-.2+open*.35;
    p.position.y=Math.abs(Math.sin(elapsed*3+p.userData.ph))*.05*open;
  });

  // ---- petals rain continuously, more during charana/pallavi ----
  const petalRate=(mood===3||mood===0)?26:10;
  if(Math.random()<petalRate*dt){
    petals.emit(rnd(26,-26),9+rand()*3,rnd(8,-20),(rand()-.5)*1.2,-.8-rand(),(rand()-.5)*.6,7,.5);
  }
  // fireflies at dusk/outro
  if(mood===4&&Math.random()<40*dt){
    fireflies.emit(rnd(24,-24),1+rand()*4,rnd(4,-18),(rand()-.5)*.4,rand()*.3,(rand()-.5)*.4,3+rand()*3,.3);
  }
  petals.update(dt);sparks.update(dt);gold.update(dt);fireflies.update(dt);

  // ---- lanterns rise during hook ----
  lanterns.forEach(l=>{
    const on=hookMode>.3||mood===4;
    l.userData.body.visible=on;l.userData.lt.intensity=on?(.8+A.pulse):0;
    if(on){l.position.y+=l.userData.vy*dt*(1+A.rms);l.position.x+=Math.sin(elapsed+l.userData.ph)*dt*.6;
      if(l.position.y>26){l.position.y=1.5;l.position.x=rnd(24,-24)}}
  });

  // ---- water canal shimmer ----
  if(CANAL){CANAL.material.color.setHSL(.54,.5,.42+A.air*.18);CANAL.material.opacity=.75+A.pulse*.2}
  if(SPARKS){
    const pa=SPARKS.geometry.attributes.position;
    for(let i=0;i<pa.count;i++){pa.setX(i,pa.getX(i)+SPARKS.userData.spd[i%pa.count]*dt*2);if(pa.getX(i)>30)pa.setX(i,-30);pa.setY(i,.15+Math.abs(Math.sin(elapsed*3+i))*.35)}
    pa.needsUpdate=true;SPARKS.material.opacity=.4+A.air*.6;
  }

  // ---- UI updates ----
  if(playing){seekEl.value=t;timeText.textContent=fmt(t)+' / '+fmt(media.duration||161.31)}
  const eqVals=[A.bass,A.mid,A.high,A.air,A.rms,A.mid*.7,A.bass*.8];
  eqBars.forEach((b,i)=>b.style.height=(8+clamp(eqVals[i],0,1.4)*66)+'%');

  renderer.render(scene,camera);
}

// ---------- boot ----------
loadPayload().then(data=>{
  TL=data;FPSV=data.fps;rleFPS=Math.ceil(data.dur*FPSV);
  BAND.bass=decodeRLE(data.bands.bass);BAND.mid=decodeRLE(data.bands.mid);
  BAND.high=decodeRLE(data.bands.high);BAND.air=decodeRLE(data.bands.air);BAND.rms=decodeRLE(data.bands.rms);
  ONSETS=data.onsets;
  CUES=data.cues.map(c=>({s:c.s,e:c.e,kn:c.kn,en:c.en,t:c.t}));
  media.volume=+volEl.value;
  document.fonts.ready.then(()=>{});
  animate();
});
