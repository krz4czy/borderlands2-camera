(function () {
'use strict';
const $ = (id) => document.getElementById(id);
const canvas = $('canvas'), video = $('video'), statusEl = $('status');
const Q = new URLSearchParams(location.search);
const TEST = Q.get('test'); // ?test=URL obrazka/wideo zamiast kamery
const RAW = Q.has('raw');   // ukryj interfejs (do zrzutów)
if (RAW) document.body.classList.add('raw');

// ---------------- ustawienia ----------------
const DEFAULTS = { hud: true, plates: true, skag: true, hay: false, chest: false, gun: true, hatch: true, thick: 1, strength: 100 };
let S = Object.assign({}, DEFAULTS);
try { Object.assign(S, JSON.parse(localStorage.getItem('bl2cam') || '{}')); } catch (e) {}
if (Q.get('cfg')) { try { Object.assign(S, JSON.parse(Q.get('cfg'))); } catch (e) {} }
const saveS = () => { try { localStorage.setItem('bl2cam', JSON.stringify(S)); } catch (e) {} };
const THICK = [{ n: 'CIENKIE', r: 1.6, t: 0.32 }, { n: 'GRUBE', r: 2.6, t: 0.26 }, { n: 'MEGA', r: 3.8, t: 0.22 }];

function status(t, ms) { statusEl.textContent = t; statusEl.style.opacity = 1; clearTimeout(status.t); if (ms) status.t = setTimeout(() => statusEl.style.opacity = 0, ms); }

// ---------------- WebGL ----------------
const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false, alpha: false });
if (!gl) { status('Twoja przeglądarka nie ma WebGL - filtr nie zadziała.'); return; }

const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const COMMON = `precision highp float;varying vec2 v;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
`;
// 1+2: filtr bilateralny (wygładza teksturę, zostawia krawędzie) -> płaskie plamy koloru
const FS_BILAT = COMMON + `uniform sampler2D t;uniform vec2 px;uniform float mir,stp;
vec3 S(vec2 u){u.x=mix(u.x,1.-u.x,mir);return texture2D(t,u).rgb;}
void main(){vec3 c0=S(v);vec3 s=vec3(0.);float ws=0.;
for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){vec2 o=vec2(float(i),float(j));vec3 c=S(v+o*px*stp);vec3 d=c-c0;
float w=exp(-dot(o,o)*.18-dot(d,d)*28.);s+=c*w;ws+=w;}
gl_FragColor=vec4(s/ws,1.);}`;
// 3: krawędzie (Sobel kolorów + DoG jasności) na wygładzonym obrazie
const FS_EDGE = COMMON + `uniform sampler2D t;uniform vec2 px;uniform float thr,sc;
vec3 T(vec2 o){return texture2D(t,v+o*px*2.*sc).rgb;}
void main(){
vec3 a=T(vec2(-1,1)),b=T(vec2(0,1)),c=T(vec2(1,1)),d=T(vec2(-1,0)),f=T(vec2(1,0)),g=T(vec2(-1,-1)),h=T(vec2(0,-1)),i=T(vec2(1,-1));
vec3 gx=-a-2.*d-g+c+2.*f+i, gy=-a-2.*b-c+g+2.*h+i;
float sob=sqrt(dot(gx,gx)+dot(gy,gy));
float l0=lum(texture2D(t,v).rgb);
float g1=0.,g2=0.;
for(int k=0;k<8;k++){float an=float(k)*.785398;vec2 dd=vec2(cos(an),sin(an));
g1+=lum(texture2D(t,v+dd*px*2.*sc).rgb);g2+=lum(texture2D(t,v+dd*px*5.*sc).rgb);}
g1=(g1+l0)/9.;g2/=8.;
float dog=max(0.,g2-g1-.02)*4.; // ciemna strona krawędzi
float e=smoothstep(thr,thr+.25,sob*.5+dog);
gl_FragColor=vec4(e,l0,0.,1.);}`;
// 3b: rozmycie mapy krawędzi - usuwa pojedyncze kropki z tekstur (trawa, liście)
const FS_EBLUR = COMMON + `uniform sampler2D t;uniform vec2 px;uniform float sc;
void main(){float s=0.;for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++)s+=texture2D(t,v+vec2(float(i),float(j))*px*sc).r;
gl_FragColor=vec4(s/25.,0.,0.,1.);}`;
// 4: kompozycja: tusz, pasma cieni, kreskowanie, paleta, ziarno, winieta, nakładka HUD
const FS_FINAL = COMMON + `uniform sampler2D tc,te,to,tr;uniform vec2 px,res;uniform float rad,hatch,str,useOv,mir,dbg;
vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*q.x+e)),d/(q.x+e),q.x);}
vec3 hsv2rgb(vec3 c){vec4 K=vec4(1.,2./3.,1./3.,3.);vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);}
void main(){
vec2 fc=v*res;
vec3 c=texture2D(tc,v).rgb;
float L=lum(c);
// --- grube, nieregularne kontury: dylatacja mapy krawędzi
float wob=vn(fc*.02);
float r=rad*(.65+.7*wob);
float e=texture2D(te,v).r;float m=e;
for(int k=0;k<12;k++){float an=float(k)*.5236;vec2 d=vec2(cos(an),sin(an))*px;
float a1=texture2D(te,v+d*r).r,a2=texture2D(te,v+d*r*.5).r,a3=texture2D(te,v+d*r*2.5).r;
e=max(e,a1);e=max(e,a2*.95);m+=a3;}
m/=13.;
e=smoothstep(.13,.3,e)*(1.-smoothstep(.4,.65,m));
// --- paleta: nasycenie + pasma jasności (3-4 tony)
vec3 hsv=rgb2hsv(c);
hsv.y=clamp(hsv.y*1.35+hsv.y*hsv.y*.4,0.,1.);
hsv.z=min(1.,pow(hsv.z,.72)*1.08);
float vb=hsv.z*3.6;float q=(floor(vb)+smoothstep(.38,.62,fract(vb)))/3.6;
hsv.z=mix(hsv.z,.07+.98*q,.85);
vec3 col=hsv2rgb(hsv);
// ciepłe światła, chłodne (morskie/fioletowe) cienie jak w BL2
float lt=smoothstep(.15,.85,q);
col*=mix(vec3(.84,.92,1.08),vec3(1.08,1.02,.9),lt);
col=mix(col,col*vec3(1.06,.99,.88)+vec3(.03,.015,0.),.5);
// --- kreskowanie piórkiem w cieniach
if(hatch>.5){
 float dark=1.-smoothstep(.26,.44,q+wob*.1);
 float sp=max(4.5,res.y/150.);
 vec2 rp=vec2(fc.x+fc.y,fc.x-fc.y)/sp;
 float j=vn(fc*.02)*.8;
 float l1=1.-smoothstep(.12,.22,abs(fract(rp.x+j)-.5));
 float seg1=step(.48,vn(vec2(rp.y*.35,floor(rp.x+j)*3.1)));
 float l2=1.-smoothstep(.12,.2,abs(fract(rp.y+j*1.3)-.5));
 float seg2=step(.52,vn(vec2(rp.x*.35,floor(rp.y+j)*2.3)));
 float darker=1.-smoothstep(.12,.3,q);
 float hm=max(l1*seg1*dark,l2*seg2*darker);
 col=mix(col,vec3(.06,.045,.035),hm*.9);
}
// --- ziarno malowanej tekstury
float gr=vn(fc*.9)-.5, bl=vn(fc*.012)-.5;
col*=1.+gr*.09+bl*.12;
// --- tusz
col=mix(col,vec3(.05,.035,.03),e);
// --- winieta
vec2 vv=v-.5;col*=1.-dot(vv,vv)*.55;
// siła filtra: miks z oryginałem
vec2 ru=v;ru.x=mix(ru.x,1.-ru.x,mir);
col=mix(texture2D(tr,ru).rgb,col,str);
// --- nakładka (HUD, plakietki, rekwizyty, broń)
if(useOv>.5){vec4 o=texture2D(to,v);col=col*(1.-o.a)+o.rgb;}
if(dbg>.5)col=vec3(1.-texture2D(te,v).r);
gl_FragColor=vec4(clamp(col,0.,1.),1.);}`;

function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function prog(fs) {
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
  return { p, u };
}
let P;
try { P = { bil: prog(FS_BILAT), edge: prog(FS_EDGE), fin: prog(FS_FINAL), eb: prog(FS_EBLUR) }; }
catch (e) { status('Błąd shadera: ' + e.message); console.error(e); return; }
const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
function tex() { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  return t; }
function fbo(w, h) { const t = tex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, f }; }
const srcTex = tex(), ovTex = tex();
let W = 0, H = 0, FA, FB, FE;
function setSize(w, h) {
  const k = Math.min(1, 1280 / Math.max(w, h)); W = Math.round(w * k); H = Math.round(h * k);
  canvas.width = W; canvas.height = H; ov.width = W; ov.height = H;
  for (const f of [FA, FB, FE]) if (f) { gl.deleteTexture(f.t); gl.deleteFramebuffer(f.f); }
  FA = fbo(W, H); FB = fbo(W, H); FE = fbo(W, H);
}
function pass(pr, target, texs, uni) {
  gl.useProgram(pr.p); gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null); gl.viewport(0, 0, W, H);
  let i = 0; for (const name in texs) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texs[name]); gl.uniform1i(pr.u[name], i); i++; }
  for (const k in uni) { const v = uni[k]; if (pr.u[k] == null) continue; if (Array.isArray(v)) gl.uniform2f(pr.u[k], v[0], v[1]); else gl.uniform1f(pr.u[k], v); }
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// ---------------- nakładka 2D ----------------
const ov = document.createElement('canvas'); const octx = ov.getContext('2d');
const Art = window.BL2Art;
const hudState = { health: 0.82, shield: 0.64, clip: 6, reserve: 84, grenades: 3, xp: 0.62, level: 31, heading: 0, weaponName: '' };
let kick = 0;

// ---------------- źródło: kamera / test ----------------
let source = null, facing = 'environment', stream = null, mirror = false;
async function startCamera() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
    video.srcObject = stream; await video.play();
    mirror = facing === 'user'; source = video;
    status('GOTOWE • WITAJ NA PANDORZE', 2500);
  } catch (err) { status('Błąd kamery: ' + err.message); console.error(err); }
}
async function startTest(url) {
  if (/\.(mp4|webm|mov|y4m)(\?|$)/i.test(url)) {
    video.src = url; video.loop = true; video.crossOrigin = 'anonymous'; await video.play(); source = video;
  } else {
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url; await img.decode(); source = img;
  }
  mirror = false; status('TRYB TESTOWY', 1500);
}
const srcW = () => source.videoWidth || source.naturalWidth || 0, srcH = () => source.videoHeight || source.naturalHeight || 0;

// ---------------- detekcja ludzi i zwierząt (MediaPipe, COCO) ----------------
const NAMES = {
  person: ['Psycho', 'Badass Psycho', 'Bandit', 'Marauder', 'Nomad', 'Goliath', 'Psycho Midget', 'Bruiser', 'Nomad Taskmaster', 'Badass Marauder'],
  cat: ['Feral Kitty', 'Badass Skag', 'Skag Kitty', 'Spitter Skag', 'Rabid Kitty', 'Alpha Kitty'],
  dog: ['Skag Pup', 'Alpha Skag', 'Adult Skag', 'Rabid Skag', 'Badass Skag', 'Chubby Skag'],
  bird: ['Rakk', 'Badass Rakk', 'Rakk Hive Spawn', 'Bloodwing Rakk'],
  horse: ['Bullymong', 'Bullymong Slinger', 'Badass Bullymong'], cow: ['Bullymong', 'Badass Bullymong', 'Bullymong Tosser'], sheep: ['Bullymong Pup', 'Bullymong'],
  bear: ['Badass Bullymong', 'Bullymong Brute'], elephant: ['Thresher', 'Badass Thresher'], zebra: ['Stalker', 'Badass Stalker'], giraffe: ['Thresher', 'Stalker']
};
const ALLOW = Object.keys(NAMES);
let detector = null, detLoading = false, tracks = [], lastDet = 0, nextId = 1;
const detCanvas = document.createElement('canvas'); const dctx = detCanvas.getContext('2d');
async function loadDetector() {
  if (detector || detLoading) return; detLoading = true;
  try {
    const V = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
    const fs = await V.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
    detector = await V.ObjectDetector.createFromOptions(fs, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite', delegate: 'CPU' },
      runningMode: 'VIDEO', scoreThreshold: 0.35, maxResults: 8, categoryAllowlist: ALLOW
    });
    window.__detReady = true;
  } catch (e) { console.error(e); status('Nie wczytałem detektora wrogów', 2500); }
  detLoading = false;
}
let detTs = 0;
function runDetection(now) {
  if (!detector || !source) return;
  const sw = srcW(), shh = srcH(); if (!sw) return;
  const k = 416 / Math.max(sw, shh); detCanvas.width = Math.round(sw * k); detCanvas.height = Math.round(shh * k);
  dctx.drawImage(source, 0, 0, detCanvas.width, detCanvas.height);
  detTs = Math.max(detTs + 1, Math.round(now));
  let res; try { res = detector.detectForVideo(detCanvas, detTs); } catch (e) { console.error(e); return; }
  const sx = W / detCanvas.width, sy = H / detCanvas.height;
  const dets = res.detections.map(d => {
    const b = d.boundingBox; let x = b.originX * sx; const w = b.width * sx;
    if (mirror) x = W - x - w;
    return { cls: d.categories[0].categoryName, x, y: b.originY * sy, w, h: b.height * sy, score: d.categories[0].score };
  });
  const used = new Set();
  for (const d of dets) {
    let best = null, bi = 0.15;
    for (const t of tracks) { if (used.has(t) || t.cls !== d.cls) continue; const i = iou(t, d); if (i > bi) { bi = i; best = t; } }
    if (best) { used.add(best); best.tx = d.x; best.ty = d.y; best.tw = d.w; best.th = d.h; best.seen = now; }
    else {
      const pool = NAMES[d.cls] || ['Varkid']; const name = pool[Math.floor(Math.random() * pool.length)];
      const badass = /Badass|Alpha/.test(name);
      const t = { id: nextId++, cls: d.cls, name, badass, level: 5 + Math.floor(Math.random() * 46), hp: 0.55 + Math.random() * 0.45, shield: badass || Math.random() < 0.3 ? 0.4 + Math.random() * 0.6 : 0,
        x: d.x, y: d.y, w: d.w, h: d.h, tx: d.x, ty: d.y, tw: d.w, th: d.h, seen: now };
      tracks.push(t); used.add(t);
    }
  }
  tracks = tracks.filter(t => now - t.seen < 900);
  window.__dets = dets;
}
function iou(a, b) { const ax = a.tx ?? a.x, ay = a.ty ?? a.y, aw = a.tw ?? a.w, ah = a.th ?? a.h;
  const x1 = Math.max(ax, b.x), y1 = Math.max(ay, b.y), x2 = Math.min(ax + aw, b.x + b.w), y2 = Math.min(ay + ah, b.y + b.h);
  const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1); return i / (aw * ah + b.w * b.h - i + 1e-6); }

// ---------------- render ----------------
let lastSize = '';
function drawOverlay(time) {
  octx.clearRect(0, 0, W, H);
  const u = Math.min(W, H) / 720 * (W < H ? 1.25 : 1);
  // rekwizyty AR na "ziemi"
  const gy = H * (W < H ? 0.76 : 0.8), ps = Math.min(W, H * 1.3) / 1280;
  if (S.hay) Art.drawHay(octx, W * 0.15, gy - 10 * ps, 1.3 * ps);
  if (S.chest) Art.drawChest(octx, W * (S.gun ? 0.7 : 0.8), gy - 10 * ps, 1.1 * ps, time);
  if (S.skag) Art.drawSkag(octx, W * (W > H ? 0.36 : 0.42), gy + 40 * ps, 1.0 * ps, time, false);
  // plakietki
  if (S.plates) for (const t of tracks) {
    t.x += (t.tx - t.x) * 0.35; t.y += (t.ty - t.y) * 0.35; t.w += (t.tw - t.w) * 0.35; t.h += (t.th - t.h) * 0.35;
    t.scale = Math.max(0.75, Math.min(1.4, Math.sqrt(t.w * t.h) / (300 * u)));
    const y = Math.max((S.hud ? 110 : 60) * u, t.y - 8 * u);
    const cx = Math.max(90 * u, Math.min(W - 90 * u, t.x + t.w / 2));
    Art.drawPlate(octx, cx, y, u, t);
  }
  if (S.gun) Art.drawGun(octx, W, H, u, time, kick);
  if (S.hud) { hudState.heading = (time * 4) % 360; hudState.weaponName = S.gun ? 'Kowbojski Rustler' : ''; Art.drawHUD(octx, W, H, u, hudState); }
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!source) return;
  if (source === video && video.readyState < 2) return;
  const sw = srcW(), shh = srcH(); if (!sw) return;
  if (sw + 'x' + shh !== lastSize) { lastSize = sw + 'x' + shh; setSize(sw, shh); }
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  const px = [1 / W, 1 / H], sc = Math.min(W, H) / 720;
  pass(P.bil, FA, { t: srcTex }, { px, mir: mirror ? 1 : 0, stp: 1.5 * sc });
  pass(P.bil, FB, { t: FA.t }, { px, mir: 0, stp: 2.5 * sc });
  pass(P.bil, FA, { t: FB.t }, { px, mir: 0, stp: 1.5 * sc });
  pass(P.bil, FB, { t: FA.t }, { px, mir: 0, stp: 3.5 * sc });
  const th = THICK[S.thick] || THICK[1];
  pass(P.edge, FE, { t: FB.t }, { px, thr: th.t, sc });
  pass(P.eb, FA, { t: FE.t }, { px, sc: 1.1 * sc });
  const time = now / 1000;
  if ((S.plates) && now - lastDet > 160) { lastDet = now; if (!detector) loadDetector(); else runDetection(now); }
  kick *= 0.85;
  const useOv = S.hud || S.plates || S.skag || S.hay || S.chest || S.gun;
  if (useOv) {
    drawOverlay(time);
    gl.bindTexture(gl.TEXTURE_2D, ovTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ov);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }
  pass(P.fin, null, { tc: FB.t, te: FA.t, to: ovTex, tr: srcTex }, { px, res: [W, H], rad: th.r * sc * 1.0, hatch: S.hatch ? 1 : 0, str: S.strength / 100, useOv: useOv ? 1 : 0, mir: mirror ? 1 : 0, dbg: Q.has('dbg') ? 1 : 0 });
  window.__frames = (window.__frames || 0) + 1;
}

// ---------------- zapisywanie: zdjęcie / nagranie ----------------
const sheet = $('sheet'), sheetMedia = $('sheetMedia'); let pending = null;
function showSheet(blob, name) {
  pending = { blob, name };
  const url = URL.createObjectURL(blob);
  sheetMedia.innerHTML = '';
  const el = blob.type.startsWith('video') ? Object.assign(document.createElement('video'), { src: url, controls: true, playsInline: true, loop: true, autoplay: true, muted: true }) : Object.assign(document.createElement('img'), { src: url });
  sheetMedia.appendChild(el);
  $('sheetDl').href = url; $('sheetDl').download = name;
  sheet.hidden = false;
}
$('sheetShare').onclick = async () => {
  if (!pending) return;
  const file = new File([pending.blob], pending.name, { type: pending.blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  $('sheetDl').click();
};
$('sheetClose').onclick = () => { sheet.hidden = true; sheetMedia.innerHTML = ''; };

$('snap').onclick = () => {
  kick = 1; hudState.clip = hudState.clip > 1 ? hudState.clip - 1 : 6;
  requestAnimationFrame(() => requestAnimationFrame(() => canvas.toBlob(b => b && showSheet(b, `bl2-${Date.now()}.png`), 'image/png')));
};
let rec = null, chunks = [];
function pickMime() {
  if (!window.MediaRecorder) return null;
  for (const m of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) if (MediaRecorder.isTypeSupported(m)) return m;
  return '';
}
$('rec').onclick = () => {
  if (rec) { rec.stop(); return; }
  const mime = pickMime();
  if (mime === null || !canvas.captureStream) { status('Ta przeglądarka nie umie nagrywać', 3000); return; }
  chunks = [];
  try { rec = new MediaRecorder(canvas.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: 6e6 } : undefined); }
  catch (e) { rec = new MediaRecorder(canvas.captureStream(30)); }
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    showSheet(new Blob(chunks, { type }), `bl2-${Date.now()}.${ext}`);
    rec = null; $('rec').classList.remove('on'); $('rec').textContent = 'REC';
  };
  rec.start(500); $('rec').classList.add('on'); $('rec').textContent = 'STOP';
};
$('flip').onclick = () => { if (TEST) return; facing = facing === 'environment' ? 'user' : 'environment'; tracks = []; startCamera(); };

// ---------------- menu ustawień ----------------
const menu = $('menu');
const ROWS = [
  ['hud', 'HUD GRACZA'], ['plates', 'PLAKIETKI WROGÓW'], ['gun', 'BROŃ'], ['skag', 'SKAG'], ['hay', 'SIANO'], ['chest', 'SKRZYNIA'], ['hatch', 'KRESKOWANIE']
];
function buildMenu() {
  const list = $('menuList'); list.innerHTML = '';
  for (const [k, label] of ROWS) {
    const b = document.createElement('button'); b.className = 'row';
    b.innerHTML = `<span>${label}</span><b>${S[k] ? 'WŁ' : 'WYŁ'}</b>`;
    b.onclick = () => { S[k] = !S[k]; saveS(); buildMenu(); };
    list.appendChild(b);
  }
  const t = document.createElement('button'); t.className = 'row';
  t.innerHTML = `<span>KONTURY</span><b>${THICK[S.thick].n}</b>`;
  t.onclick = () => { S.thick = (S.thick + 1) % THICK.length; saveS(); buildMenu(); };
  list.appendChild(t);
  const r = document.createElement('label'); r.className = 'row';
  r.innerHTML = `<span>SIŁA FILTRA</span><input type="range" min="0" max="100" value="${S.strength}">`;
  r.querySelector('input').oninput = (e) => { S.strength = +e.target.value; saveS(); };
  list.appendChild(r);
  const rs = document.createElement('button'); rs.className = 'row';
  rs.innerHTML = '<span>PRZYWRÓĆ DOMYŚLNE</span><b>↺</b>';
  rs.onclick = () => { S = Object.assign({}, DEFAULTS); saveS(); buildMenu(); };
  list.appendChild(rs);
}
$('gear').onclick = () => { buildMenu(); menu.hidden = false; };
$('menuClose').onclick = () => { menu.hidden = true; };

// ---------------- start ----------------
document.fonts && document.fonts.load('30px Bangers').catch(() => {});
if (S.plates) loadDetector();
(TEST ? startTest(TEST) : startCamera()).catch(e => status('Błąd: ' + e.message));
requestAnimationFrame(frame);
})();
