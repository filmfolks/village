// Minimal DOM + THREE stub to smoke-test app logic (no rendering)
const fs=require('fs');
global.window=global;
const listeners={};
function makeEl(tag='div'){
  const el={
    tag,children:[],style:{setProperty(k,v){this[k]=v}},dataset:{},classList:{_s:new Set(),add(...c){c.forEach(x=>this._s.add(x))},remove(...c){c.forEach(x=>this._s.delete(x))},toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c)},contains(c){return this._s.has(c)}},
    appendChild(c){this.children.push(c);return c},removeChild(c){},remove(){},
    addEventListener(ev,fn){(listeners[this.id||tag+ev]=listeners[this.id||tag+ev]||[]).push(fn)},
    querySelector(sel){return makeEl()},querySelectorAll(sel){return []},
    getBoundingClientRect(){return {width:100,height:50,left:0,top:0}},
    clientWidth:800,clientHeight:450,offsetWidth:100,
    textContent:'',innerHTML:'',value:'0',onclick:null,oninput:null,
    getContext(){return new Proxy({},{get:(t,k)=>{ if(k==='createImageData')return (w,h)=>({data:new Uint8Array(w*h*4)}); if(k==='createRadialGradient'||k==='createLinearGradient')return ()=>({addColorStop(){}}); return ()=>{} },set:()=>true})},
    width:0,height:0,
  };
  Object.defineProperty(el,'textContent',{get(){return this._tc||''},set(v){this._tc=v}});
  return el;
}
const els={};
['stage','c','lyric-layer','section-title','flash','media','seek','time-text','play-btn','vol','start','btn-cine','btn-reset','big-play','hint'].forEach(id=>els[id]=makeEl());
els.media.currentTime=0;els.media.duration=161.31;els.media.volume=1;
els.media.play=()=>{};els.media.pause=()=>{};
global.document={
  getElementById:id=>els[id]||makeEl(),
  createElement:t=>{const e=makeEl(t);if(t==='canvas'){e.width=0;e.height=0;}return e},
  fonts:{ready:Promise.resolve()},
  body:makeEl(),documentElement:makeEl(),
};
global.addEventListener=(ev,fn)=>{(listeners[ev]=listeners[ev]||[]).push(fn)};
global.performance={now:()=>Date.now()};
global.requestAnimationFrame=fn=>{global.__raf=fn;return 1};
global.devicePixelRatio=1;

// ---- THREE stub ----
class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this}set(x,y,z){this.x=x;this.y=y;this.z=z;return this}lerp(v,t){this.x+=(v.x-this.x)*t;this.y+=(v.y-this.y)*t;this.z+=(v.z-this.z)*t;return this}}
class Col{constructor(h=0){this.r=1;this.g=1;this.b=1}copy(v){return this}set(v){return this}setHSL(h,s,l){return this}lerp(v,t){return this}}
class Obj{constructor(){this.position=new V3();this.rotation={x:0,y:0,z:0};this.scale=new V3(1,1,1);this.userData={};this.children=[];this.visible=true}add(...c){this.children.push(...c);return this}clone(){const o=new Obj();o.userData=this.userData;o.material=this.material;return o}remove(){}}
class Mat extends Obj{constructor(p={}){super();Object.assign(this,p);this.needsUpdate=false}}
class Geo{constructor(){this.attributes={};this.parameters={}}setFromPoints(p){return this}setAttribute(n,a){this.attributes[n]=a}computeVertexNormals(){}translate(){}rotateZ(){}dispose(){}}
function mkGeo(name){return function(...args){const g=new Geo();g.name=name;return g}}
class BufAttr{constructor(arr,itemSize){this.array=arr;this.itemSize=itemSize;this.count=arr.length/itemSize;this.needsUpdate=false}}
const THREE={
  WebGLRenderer:function(){return {setPixelRatio(){},setSize(){},render(){},domElement:els.c,shadowMap:{},capabilities:{isWebGL2:true},getExtension:()=>null,setClearColor(){}}},
  Scene:function(){const s=new Obj();s.fog=null;s.background=null;return s},
  PerspectiveCamera:function(fov,a,n,f){const c=new Obj();c.aspect=a;c.updateProjectionMatrix=()=>{};c.lookAt=()=>{};return c},
  Fog:function(c,n,f){return {color:new Col(),near:n,far:f}},
  Color:Col,Vector3:V3,Quaternion:function(){return {setFromAxisAngle:()=>{}}},
  Matrix4:function(){return {compose:()=>{}}},
  Mesh:function(g,m){const o=new Obj();o.geometry=g;o.material=m;return o},
  Sprite:function(m){const o=new Obj();o.material=m;return o},
  Line:function(g,m){const o=new Obj();o.material=m;return o},
  Points:function(g,m){const o=new Obj();o.geometry=g;o.material=m;return o},
  InstancedMesh:function(g,m,n){const o=new Obj();o.setMatrixAt=()=>{};o.setColorAt=()=>{};o.instanceMatrix={needsUpdate:false};return o},
  Group:function(){return new Obj()},
  BufferGeometry:Geo,BufferAttribute:BufAttr,
  PlaneGeometry:mkGeo('Plane'),SphereGeometry:mkGeo('Sphere'),BoxGeometry:mkGeo('Box'),ConeGeometry:mkGeo('Cone'),
  CylinderGeometry:mkGeo('Cyl'),TorusGeometry:mkGeo('Torus'),CircleGeometry:mkGeo('Circle'),TubeGeometry:mkGeo('Tube'),
  CapsuleGeometry:mkGeo('Capsule'),
  MeshBasicMaterial:Mat,MeshStandardMaterial:Mat,SpriteMaterial:Mat,PointsMaterial:Mat,LineBasicMaterial:Mat,
  HemisphereLight:function(){const o=new Obj();o.intensity=1;return o},
  AmbientLight:function(c,i){const o=new Obj();o.color=new Col();o.intensity=i||1;return o},
  DirectionalLight:function(){const o=new Obj();o.shadow={mapSize:{set(){}},camera:{},bias:0};o.intensity=1;o.color=new Col();return o},
  PointLight:function(){const o=new Obj();o.intensity=1;return o},
  CanvasTexture:function(c){return {encoding:0,wrapS:0,wrapT:0,repeat:{set(){}},anisotropy:0,needsUpdate:false}},
  TextureLoader:function(){return {load:()=>({encoding:0})}},
  CatmullRomCurve3:function(pts){return {getPoint:()=>new V3(),getPointAt:()=>new V3()}},
  AdditiveBlending:2,NormalBlending:1,BackSide:1,DoubleSide:2,sRGBEncoding:3001,
  ACESFilmicToneMapping:4,PCFSoftShadowMap:2,RepeatWrapping:1000,
};
global.THREE=THREE;

// load app
let src=fs.readFileSync('/workspace/app.js','utf8');
src=src.replace(/const EMBEDDED[\s\S]*?loadPayload\(\)\.then/g,'const EMBEDDED=__DATA__;async function loadPayload(){return Promise.resolve(EMBEDDED)}loadPayload().then');
const data=JSON.parse(fs.readFileSync('/workspace/data/timeline.json','utf8'));
global.__DATA__=data;
try{
  eval(src);
}catch(e){console.log('EVAL ERROR:',e.message);process.exit(1)}
// simulate frames
let t=0;
function frame(){
  t+=0.05;els.media.currentTime=t;
  global.__raf&&global.__raf();
}
let errors=0;
for(let i=0;i<3200;i++){ // ~160s at 50fps sim steps
  try{frame()}catch(e){errors++;if(errors<5)console.log('FRAME ERR @',t.toFixed(1),e.message)}
}
console.log('frames done, errors:',errors,'| cues shown up to t=',t.toFixed(1));
