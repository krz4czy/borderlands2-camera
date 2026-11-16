// Ręcznie rysowane (Canvas 2D) elementy w stylu BL2: HUD, plakietki wrogów, rekwizyty AR, broń.
// Wszystko narysowane od zera - żadnych plików z gry.
(function () {
'use strict';
const INK = '#0d0a08';
const FONT = 'Bangers, Impact, sans-serif';

// ---------- helpery ----------
function P(ctx, d) { // mini parser: tablica komend [['M',x,y],['C',...],...]
  ctx.beginPath();
  for (const c of d) {
    const k = c[0];
    if (k === 'M') ctx.moveTo(c[1], c[2]);
    else if (k === 'L') ctx.lineTo(c[1], c[2]);
    else if (k === 'C') ctx.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
    else if (k === 'Q') ctx.quadraticCurveTo(c[1], c[2], c[3], c[4]);
    else if (k === 'Z') ctx.closePath();
  }
}
function inkShape(ctx, d, fill, lw, opt) {
  opt = opt || {};
  P(ctx, d);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (opt.shade) { ctx.save(); P(ctx, d); ctx.clip(); opt.shade(ctx); ctx.restore(); P(ctx, d); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
function strokes(ctx, lines, lw, color) {
  ctx.strokeStyle = color || INK; ctx.lineWidth = lw; ctx.lineCap = 'round';
  for (const l of lines) {
    ctx.beginPath(); ctx.moveTo(l[0], l[1]);
    if (l.length === 6) ctx.quadraticCurveTo(l[2], l[3], l[4], l[5]); else ctx.lineTo(l[2], l[3]);
    ctx.stroke();
  }
}
// kreskowanie w obszarze (wywołać wewnątrz clip)
function hatchRect(ctx, x0, y0, x1, y1, gap, lw, ang, alpha, seed) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineCap = 'round';
  const dx = Math.cos(ang), dy = Math.sin(ang); const L = Math.hypot(x1 - x0, y1 - y0);
  let s = seed || 1;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let t = -L; t < L; t += gap) {
    const cx = (x0 + x1) / 2 - dy * t, cy = (y0 + y1) / 2 + dx * t;
    const a = -L * (0.2 + rnd() * 0.5), b = L * (0.2 + rnd() * 0.5);
    ctx.beginPath(); ctx.moveTo(cx + dx * a, cy + dy * a); ctx.lineTo(cx + dx * b + rnd() * 2, cy + dy * b + rnd() * 2); ctx.stroke();
  }
  ctx.restore();
}
function shadeBottom(color, y0, y1) {
  return (ctx) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, color); ctx.fillStyle = g; ctx.fillRect(-1000, -1000, 3000, 3000); };
}

// ---------- SKAG ----------
// Bok, pysk w prawo. Lokalne współrzędne ~ 0..430 x 0..260, ziemia y=252.
const SK = {
  skin: '#e2cfa9', skinMid: '#c8ab80', skinDark: '#8f7152', plate: '#3d342e', plateHi: '#6a5a4c', plateEdge: '#a77b4e',
  claw: '#2a221c', mouth: '#5e1414', mouthIn: '#2a0606', tongue: '#d8606a', teeth: '#f4ecd8'
};
function bodyTop(t) { // punkty grzbietu (3 krzywe), t 0..1
  const segs = [[40, 150, 60, 118, 90, 92, 140, 82], [140, 82, 176, 44, 230, 30, 272, 58], [272, 58, 302, 76, 320, 104, 324, 124]];
  const st = Math.min(2.999, t * 3), i = Math.floor(st), u = st - i, s = segs[i];
  const m = 1 - u;
  const x = m * m * m * s[0] + 3 * m * m * u * s[2] + 3 * m * u * u * s[4] + u * u * u * s[6];
  const y = m * m * m * s[1] + 3 * m * m * u * s[3] + 3 * m * u * u * s[5] + u * u * u * s[7];
  const tx = 3 * m * m * (s[2] - s[0]) + 6 * m * u * (s[4] - s[2]) + 3 * u * u * (s[6] - s[4]);
  const ty = 3 * m * m * (s[3] - s[1]) + 6 * m * u * (s[5] - s[3]) + 3 * u * u * (s[7] - s[5]);
  return { x, y, a: Math.atan2(ty, tx) };
}
function claws(ctx, x, y, dir, lw) {
  for (let i = 0; i < 3; i++) {
    const ox = x + i * 9 * dir, oy = y;
    inkShape(ctx, [['M', ox - 4, oy - 8], ['Q', ox + 8 * dir, oy - 6, ox + 13 * dir, oy + 4], ['Q', ox + 4 * dir, oy + 1, ox - 3, oy], ['Z']], SK.claw, lw * 0.5);
  }
}
function plate(ctx, cx, cy, ang, w, h, lw, spikes, seed) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  const j = (k) => Math.sin(seed * 12.9898 + k * 78.233) * 3;
  const d = [['M', -w / 2, h * 0.35], ['L', -w * 0.42, -h * 0.25 + j(1)], ['Q', -w * 0.1, -h * 0.62 + j(2), w * 0.32, -h * 0.4 + j(3)], ['L', w / 2, h * 0.1], ['Q', w * 0.15, h * 0.5 + j(4), -w / 2, h * 0.35], ['Z']];
  inkShape(ctx, d, SK.plate, lw, { shade: (c) => {
    c.fillStyle = SK.plateHi; c.beginPath(); c.ellipse(-w * 0.05, -h * 0.3, w * 0.35, h * 0.14, -0.15, 0, 7); c.fill();
    c.fillStyle = SK.plateEdge; c.beginPath(); c.ellipse(-w * 0.1, -h * 0.36, w * 0.18, h * 0.06, -0.15, 0, 7); c.fill();
    strokes(c, [[-w * 0.3, h * 0.05, w * 0.1, h * 0.12, w * 0.35, 0]], lw * 0.35);
  } });
  for (let i = 0; i < spikes; i++) {
    const bx = -w * 0.25 + i * w * 0.35, by = -h * 0.42;
    const len = h * (0.45 + 0.35 * Math.abs(Math.sin(seed * 3 + i)));
    inkShape(ctx, [['M', bx - 6, by + 4], ['Q', bx - 8, by - len * 0.5, bx - 20, by - len], ['Q', bx + 0, by - len * 0.4, bx + 8, by + 3], ['Z']], SK.plate, lw * 0.75,
      { shade: (c) => { c.fillStyle = SK.plateHi; c.fillRect(bx - 8, by - len, 5, len); } });
  }
  ctx.restore();
}
function drawSkag(ctx, x, y, scale, time, flip) {
  // x,y = środek pod łapami (ziemia). scale: px na jednostkę.
  const lw = 7;
  // otwieranie paszczy: co ~3.2 s, ryk 1.1 s
  const ph = (time % 3.2) / 1.1;
  const open = ph < 1 ? Math.sin(Math.min(1, ph) * Math.PI) ** 0.6 : 0;
  const breathe = Math.sin(time * 2.2) * 1.5;
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale * (flip ? -1 : 1), scale); ctx.translate(-215, -252);
  // cień
  ctx.fillStyle = 'rgba(30,18,10,0.45)'; ctx.beginPath(); ctx.ellipse(215, 250, 185, 15, 0, 0, 7); ctx.fill();
  // dalsze łapy
  const farFill = SK.skinMid;
  inkShape(ctx, [['M', 118, 128], ['C', 92, 158, 78, 186, 90, 210], ['L', 84, 244], ['L', 108, 247], ['L', 106, 212], ['C', 120, 190, 140, 170, 152, 150], ['Z']], farFill, lw, { shade: shadeBottom('rgba(60,30,10,0.5)', 150, 250) });
  claws(ctx, 84, 246, 1, lw);
  inkShape(ctx, [['M', 268, 118], ['C', 288, 160, 296, 190, 297, 214], ['L', 306, 245], ['L', 328, 246], ['L', 316, 212], ['C', 316, 180, 304, 140, 296, 112], ['Z']], farFill, lw, { shade: shadeBottom('rgba(60,30,10,0.5)', 150, 250) });
  claws(ctx, 306, 247, 1, lw);
  // ogon
  inkShape(ctx, [['M', 48, 146], ['C', 28, 150, 12, 162, 0, 180], ['C', 18, 172, 36, 168, 56, 164], ['Z']], SK.skinMid, lw);
  // tułów
  ctx.save(); ctx.translate(0, breathe * 0.4);
  const body = [['M', 40, 150], ['C', 60, 118, 90, 92, 140, 82], ['C', 176, 44, 230, 30, 272, 58], ['C', 302, 76, 320, 104, 324, 124], ['C', 312, 150, 292, 162, 266, 166], ['C', 232, 176, 192, 172, 162, 170], ['C', 132, 174, 100, 177, 80, 172], ['C', 60, 168, 46, 162, 40, 150], ['Z']];
  inkShape(ctx, body, SK.skin, lw, { shade: (c) => {
    shadeBottom('rgba(110,70,35,0.55)', 120, 175)(c);
    c.fillStyle = 'rgba(120,80,45,0.35)'; c.beginPath(); c.ellipse(230, 150, 50, 20, 0, 0, 7); c.fill();
    hatchRect(c, 90, 140, 300, 180, 7, 1.6, -0.9, 0.75, 3);
    // mięśnie
    strokes(c, [[120, 150, 150, 135, 175, 152], [215, 160, 240, 140, 268, 152], [150, 112, 170, 125, 168, 145]], 2.2);
  } });
  // pory na boku (3 szczeliny)
  for (let i = 0; i < 3; i++) {
    const px = 178 + i * 14, py = 120 - i * 2;
    inkShape(ctx, [['M', px, py - 13], ['Q', px + 7, py, px + 1, py + 13], ['Q', px - 6, py, px, py - 13], ['Z']], '#3a1d14', 3);
    ctx.fillStyle = '#7a2a22'; ctx.beginPath(); ctx.ellipse(px + 0.5, py, 1.6, 8, 0.1, 0, 7); ctx.fill();
  }
  ctx.restore();
  // bliższa tylna łapa (udo)
  inkShape(ctx, [['M', 92, 118], ['C', 128, 102, 166, 122, 166, 154], ['C', 162, 180, 142, 194, 128, 200], ['L', 124, 238], ['L', 112, 249], ['L', 96, 248], ['L', 104, 234], ['L', 104, 200], ['C', 86, 180, 78, 146, 92, 118], ['Z']], SK.skin, lw, { shade: (c) => {
    shadeBottom('rgba(110,70,35,0.6)', 150, 250)(c); hatchRect(c, 100, 165, 170, 205, 6, 1.5, -0.8, 0.8, 7);
    strokes(c, [[100, 130, 125, 120, 150, 140], [110, 205, 118, 220, 116, 236]], 2.2);
  } });
  claws(ctx, 98, 249, 1, lw);
  // bliższa przednia łapa (długa)
  inkShape(ctx, [['M', 250, 104], ['C', 284, 96, 302, 128, 294, 160], ['C', 290, 186, 294, 206, 302, 226], ['L', 320, 247], ['L', 298, 250], ['L', 280, 233], ['C', 270, 210, 260, 186, 254, 166], ['C', 242, 140, 236, 114, 250, 104], ['Z']], SK.skin, lw, { shade: (c) => {
    shadeBottom('rgba(110,70,35,0.6)', 150, 250)(c); hatchRect(c, 250, 160, 300, 235, 6, 1.5, -0.8, 0.8, 11);
    strokes(c, [[258, 120, 280, 118, 288, 145], [268, 180, 282, 200, 290, 222]], 2.2);
  } });
  claws(ctx, 302, 250, 1, lw);
  // skorupa (ciemny pancerz na całym grzbiecie)
  {
    const d = []; const N = 24;
    for (let i = 0; i <= N; i++) { const b = bodyTop(0.06 + 0.92 * i / N); d.push([i ? 'L' : 'M', b.x, b.y - 4]); }
    for (let i = N; i >= 0; i--) { const t = 0.06 + 0.92 * i / N, b = bodyTop(t); const dep = 26 + 22 * Math.sin(Math.PI * t) + 6 * Math.sin(i * 1.9); d.push(['L', b.x - Math.sin(b.a) * dep, b.y + Math.cos(b.a) * dep]); }
    d.push(['Z']);
    ctx.save(); ctx.translate(0, breathe * 0.4);
    inkShape(ctx, d, SK.plate, lw, { shade: (c) => {
      c.fillStyle = SK.plateHi;
      for (let i = 0; i < 14; i++) { const b = bodyTop(0.1 + i * 0.06); c.beginPath(); c.ellipse(b.x - Math.sin(b.a) * 26, b.y + Math.cos(b.a) * 26, 11, 6, b.a + 0.4, 0, 7); c.fill(); }
      hatchRect(c, 40, 60, 330, 160, 5, 1.4, 0.9, 0.6, 17);
    } });
    ctx.restore();
  }
  // pancerz na grzbiecie
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = 0.1 + i * (0.8 / (n - 1)), b = bodyTop(t);
    const sz = 0.75 + 0.5 * Math.sin(Math.PI * t);
    plate(ctx, b.x + Math.sin(b.a) * 6, b.y + 10 * sz - Math.cos(b.a) * 4 + breathe * 0.4, b.a, 52 * sz, 38 * sz, lw * 0.85, i % 2 ? 2 : 1, i + 1);
  }
  // płyty barkowe
  plate(ctx, 262, 92, 0.6, 58, 44, lw * 0.85, 2, 21);
  plate(ctx, 205, 70, 0.05, 64, 44, lw * 0.85, 2, 22);
  // ---- głowa (trójdzielna paszcza), opuszczona nisko jak u skaga ----
  ctx.save(); ctx.translate(300, 118); ctx.rotate(0.13); ctx.scale(1.12, 1.12); ctx.translate(-300, -118);
  const a = open * 0.62;
  // wnętrze paszczy
  if (open > 0.02) inkShape(ctx, [['M', 306, 130], ['L', 330 + 80 * open, 150 - 45 * open], ['L', 345 + 88 * open, 200], ['L', 330 + 78 * open, 232 + 18 * open], ['L', 312, 214], ['Z']], SK.mouth, lw, { shade: (c) => {
    c.fillStyle = SK.mouthIn; c.beginPath(); c.ellipse(330, 172, 26, 30, 0, 0, 7); c.fill();
  } });
  // język
  if (open > 0.05) {
    const tl = 40 + 70 * open;
    inkShape(ctx, [['M', 325, 175], ['C', 350, 168, 330 + tl, 186, 338 + tl, 206 + 10 * open], ['C', 318 + tl, 214, 345, 196, 322, 190], ['Z']], SK.tongue, lw * 0.7, {
      shade: (c) => strokes(c, [[330, 182, 340 + tl * 0.5, 192, 330 + tl, 205]], 2, '#9a2e38')
    });
  }
  const teeth = (pts) => { for (const t of pts) inkShape(ctx, [['M', t[0], t[1]], ['L', t[2], t[3]], ['L', t[4], t[5]], ['Z']], SK.teeth, 2.5); };
  // dolna szczęka
  ctx.save(); ctx.translate(316, 200); ctx.rotate(a * 0.55); ctx.translate(-316, -200);
  teeth([[340, 214, 348, 200, 354, 216], [362, 220, 372, 204, 376, 222], [384, 220, 394, 206, 398, 218]]);
  inkShape(ctx, [['M', 312, 190], ['C', 336, 206, 372, 216, 408, 206], ['C', 398, 228, 366, 238, 334, 230], ['C', 316, 224, 308, 206, 312, 190], ['Z']], SK.skin, lw, { shade: (c) => {
    shadeBottom('rgba(110,70,35,0.7)', 205, 238)(c); hatchRect(c, 315, 215, 400, 240, 5, 1.4, -0.7, 0.8, 5);
    c.fillStyle = SK.plate; c.beginPath(); c.ellipse(372, 226, 30, 8, -0.15, 0, 7); c.fill();
  } });
  ctx.restore();
  // boczna klapa (policzek) - odchyla się do przodu/w dół
  ctx.save(); ctx.translate(312, 168); ctx.rotate(a * 0.45); ctx.scale(1 + open * 0.12, 1 + open * 0.12); ctx.translate(-312 - open * 10, -168 + open * 6);
  teeth([[352, 200, 358, 214, 366, 200], [374, 204, 382, 218, 388, 203]]);
  inkShape(ctx, [['M', 308, 158], ['C', 340, 162, 382, 180, 412, 200], ['C', 398, 212, 366, 214, 340, 206], ['C', 320, 198, 308, 180, 308, 158], ['Z']], SK.skinMid, lw, { shade: (c) => {
    c.fillStyle = SK.plate; c.beginPath(); c.moveTo(310, 160); c.bezierCurveTo(340, 164, 380, 180, 412, 200); c.lineTo(400, 192); c.bezierCurveTo(370, 178, 340, 170, 312, 172); c.fill();
    shadeBottom('rgba(90,50,25,0.7)', 185, 212)(c); hatchRect(c, 320, 190, 400, 212, 5, 1.4, -0.6, 0.8, 9);
  } });
  ctx.restore();
  // górna klapa (czaszka w pancerzu) - unosi się do tyłu
  ctx.save(); ctx.translate(304, 132); ctx.rotate(-a); ctx.translate(-304, -132);
  teeth([[350, 172, 356, 186, 362, 172], [372, 178, 378, 192, 385, 180], [392, 186, 398, 198, 404, 190]]);
  const top = [['M', 298, 116], ['C', 328, 100, 378, 110, 402, 146], ['C', 412, 162, 416, 184, 412, 200], ['C', 392, 190, 362, 176, 332, 166], ['C', 314, 160, 302, 146, 298, 116], ['Z']];
  inkShape(ctx, top, SK.plate, lw, { shade: (c) => {
    // płytki na czaszce
    c.fillStyle = SK.plateHi;
    const blobs = [[320, 122, 16, 9, -0.3], [350, 118, 18, 9, 0.1], [378, 132, 16, 9, 0.6], [396, 160, 11, 8, 1.1], [336, 140, 14, 7, 0.2], [364, 148, 14, 7, 0.4]];
    for (const b of blobs) { c.beginPath(); c.ellipse(b[0], b[1], b[2], b[3], b[4], 0, 7); c.fill(); }
    c.fillStyle = SK.plateEdge; for (const b of blobs) { c.beginPath(); c.ellipse(b[0] - 2, b[1] - 3, b[2] * 0.5, b[3] * 0.35, b[4], 0, 7); c.fill(); }
    strokes(c, [[316, 132, 334, 128, 344, 134], [346, 132, 362, 128, 372, 140], [330, 152, 348, 150, 360, 160], [366, 160, 384, 156, 396, 172], [384, 120, 392, 130, 394, 142]], 2.6);
    hatchRect(c, 320, 160, 410, 200, 5, 1.5, -0.7, 0.7, 13);
  } });
  // malutkie czerwone oko
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(366, 140, 7, 6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff3a20'; ctx.beginPath(); ctx.arc(366, 140, 3.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd0a0'; ctx.beginPath(); ctx.arc(365, 139, 1.2, 0, 7); ctx.fill();
  // kolce na czaszce
  for (const s of [[318, 108, -0.9], [338, 104, -0.6], [358, 106, -0.3]]) {
    ctx.save(); ctx.translate(s[0], s[1]); ctx.rotate(s[2]);
    inkShape(ctx, [['M', -5, 4], ['Q', -4, -10, -10, -24], ['Q', 4, -10, 6, 4], ['Z']], SK.plate, lw * 0.6);
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
  ctx.restore();
}

// ---------- BELA SIANA ----------
function drawHay(ctx, x, y, s) {
  const lw = 6;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-110, -150);
  ctx.fillStyle = 'rgba(30,18,10,0.4)'; ctx.beginPath(); ctx.ellipse(110, 148, 118, 10, 0, 0, 7); ctx.fill();
  const straw = '#e2b445', strawD = '#a8742a', strawL = '#f6d97a';
  // bok (prawa ściana, ciemniejsza)
  inkShape(ctx, [['M', 160, 60], ['L', 210, 40], ['L', 212, 118], ['L', 164, 146], ['Z']], '#c08a32', lw, { shade: (c) => hatchRect(c, 160, 40, 215, 150, 6, 1.6, 1.1, 0.8, 4) });
  // góra
  inkShape(ctx, [['M', 8, 66], ['L', 60, 44], ['L', 210, 40], ['L', 160, 62], ['Z']], strawL, lw);
  // przód
  inkShape(ctx, [['M', 8, 66], ['L', 160, 62], ['L', 164, 146], ['L', 10, 148], ['Z']], straw, lw, { shade: (c) => {
    shadeBottom('rgba(120,60,10,0.55)', 90, 150)(c);
    let sd = 5; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    c.strokeStyle = strawD; c.lineWidth = 2;
    for (let i = 0; i < 70; i++) { const px = 12 + r() * 148, py = 70 + r() * 74, l = 8 + r() * 14, an = (r() - 0.5) * 0.9; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(an) * l, py + Math.sin(an) * l); c.stroke(); }
    c.strokeStyle = strawL; c.lineWidth = 1.6;
    for (let i = 0; i < 40; i++) { const px = 12 + r() * 148, py = 66 + r() * 50, l = 6 + r() * 10, an = (r() - 0.5) * 0.9; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(an) * l, py + Math.sin(an) * l); c.stroke(); }
  } });
  // sznurki
  for (const bx of [50, 118]) {
    strokes(ctx, [[bx, 64, bx + 1, 147], [bx, 64, bx + 30, 52, bx + 54, 43]], 4.5, INK);
    strokes(ctx, [[bx, 64, bx + 1, 147], [bx, 64, bx + 30, 52, bx + 54, 43]], 2, '#6b4a2a');
    strokes(ctx, [[bx + 52, 44, bx + 53, 38, bx + 54, 120 - (bx - 50) * 0.1]], 0, INK);
  }
  // wystające źdźbła
  strokes(ctx, [[10, 70, -4, 60], [12, 100, -6, 104], [12, 130, -2, 138], [30, 62, 26, 48], [90, 60, 92, 46], [164, 100, 176, 104], [140, 146, 146, 158]], 2.4, strawD);
  ctx.restore();
}

// ---------- SKRZYNIA (czerwona skrzynia z bronią, styl BL2) ----------
function drawChest(ctx, x, y, s, time) {
  const lw = 6;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-130, -150);
  ctx.fillStyle = 'rgba(30,18,10,0.45)'; ctx.beginPath(); ctx.ellipse(130, 148, 135, 11, 0, 0, 7); ctx.fill();
  const red = '#a51e17', redD = '#5e0f0c', redL = '#d8402c', metal = '#8e9296', metalD = '#4a4e52', metalL = '#c9cdd0';
  // korpus
  inkShape(ctx, [['M', 10, 76], ['L', 250, 76], ['L', 244, 146], ['L', 16, 146], ['Z']], red, lw, { shade: (c) => {
    shadeBottom('rgba(40,0,0,0.6)', 95, 146)(c); hatchRect(c, 16, 115, 244, 146, 6, 1.6, -0.9, 0.7, 2);
    c.fillStyle = redL; c.fillRect(18, 80, 224, 6);
  } });
  // biała dekalka-pasek
  inkShape(ctx, [['M', 40, 96], ['L', 104, 96], ['L', 98, 112], ['L', 34, 112], ['Z']], '#efe7d2', 3);
  inkShape(ctx, [['M', 156, 96], ['L', 220, 96], ['L', 226, 112], ['L', 162, 112], ['Z']], '#efe7d2', 3);
  // pokrywa (zaokrąglona)
  inkShape(ctx, [['M', 4, 78], ['C', 6, 46, 30, 30, 60, 28], ['L', 200, 28], ['C', 230, 30, 254, 46, 256, 78], ['Z']], red, lw, { shade: (c) => {
    c.fillStyle = redL; c.beginPath(); c.ellipse(130, 40, 110, 8, 0, 0, 7); c.fill();
    shadeBottom('rgba(40,0,0,0.5)', 50, 80)(c);
    c.fillStyle = redD; c.fillRect(0, 66, 260, 12);
  } });
  // metalowe okucia narożne
  const bracket = (bx) => {
    inkShape(ctx, [['M', bx, 26], ['L', bx + 30, 26], ['L', bx + 30, 148], ['L', bx, 148], ['Z']], metal, lw * 0.8, { shade: (c) => {
      c.fillStyle = metalL; c.fillRect(bx, 26, 8, 122); c.fillStyle = metalD; c.fillRect(bx + 22, 26, 8, 122);
      hatchRect(c, bx, 110, bx + 30, 148, 5, 1.3, -0.9, 0.7, bx);
    } });
    for (const ry of [38, 64, 100, 132]) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(bx + 15, ry, 3.6, 0, 7); ctx.fill(); ctx.fillStyle = metalL; ctx.beginPath(); ctx.arc(bx + 14, ry - 1, 1.5, 0, 7); ctx.fill(); }
  };
  bracket(8); bracket(222);
  // zamek z diodą
  inkShape(ctx, [['M', 108, 62], ['L', 152, 62], ['L', 148, 100], ['L', 112, 100], ['Z']], metalD, lw * 0.8, { shade: (c) => { c.fillStyle = metal; c.fillRect(108, 62, 44, 8); } });
  const glow = 0.6 + 0.4 * Math.sin(time * 4);
  ctx.save(); ctx.shadowColor = '#7dff4a'; ctx.shadowBlur = 18 * glow;
  ctx.fillStyle = `rgba(125,255,74,${0.6 + 0.4 * glow})`; ctx.beginPath(); ctx.arc(130, 82, 7, 0, 7); ctx.fill(); ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(130, 82, 7, 0, 7); ctx.stroke();
  ctx.restore();
}

// ---------- BROŃ: rewolwer w stylu Jakobs (pierwsza osoba, prawy dół) ----------
function drawGun(ctx, W, H, u, time, kick) {
  const lw = 7;
  const bob = Math.sin(time * 1.6) * 3;
  ctx.save();
  const g = Math.min(W, H) / 720 * 1.0;
  ctx.translate(W - 60 * g, H - 110 * g + bob * g + kick * 20 * g);
  ctx.scale(g, g);
  ctx.rotate(0.24 + kick * 0.15);
  // lokalnie: lufa w kierunku -x, chwyt w prawo/dół
  const steel = '#7d8389', steelD = '#3d4247', steelL = '#c2c8cc', wood = '#8a4f22', woodD = '#4e2a10', woodL = '#c07a3a', brass = '#c8962e';
  // chwyt (drewno)
  inkShape(ctx, [['M', -40, -20], ['C', -10, -30, 30, -20, 60, 10], ['C', 90, 40, 110, 90, 120, 140], ['L', 40, 160], ['C', 30, 110, 0, 60, -40, 30], ['Z']], wood, lw, { shade: (c) => {
    c.strokeStyle = woodD; c.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-30 + i * 12, -10 + i * 4); c.bezierCurveTo(20 + i * 8, 20, 50 + i * 6, 80, 60 + i * 10, 160); c.stroke(); }
    c.fillStyle = woodL; c.beginPath(); c.ellipse(20, 0, 30, 8, 0.5, 0, 7); c.fill();
    hatchRect(c, 30, 60, 130, 160, 6, 1.6, -0.6, 0.8, 4);
  } });
  // rama
  inkShape(ctx, [['M', -170, -70], ['L', -40, -72], ['C', -20, -72, -6, -60, -4, -40], ['L', -2, -10], ['C', -20, -2, -40, 0, -60, 0], ['L', -110, -10], ['L', -170, -40], ['Z']], steel, lw, { shade: (c) => {
    c.fillStyle = steelL; c.fillRect(-170, -70, 170, 8); shadeBottom('rgba(10,10,20,0.6)', -40, 0)(c); hatchRect(c, -120, -30, 0, 0, 5, 1.4, -0.8, 0.8, 8);
  } });
  // osłona spustu
  ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(-90, -8); ctx.bezierCurveTo(-96, 40, -40, 44, -30, 0); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = steelD; ctx.stroke();
  inkShape(ctx, [['M', -66, -6], ['C', -70, 10, -66, 22, -56, 28], ['C', -58, 14, -56, 4, -54, -6], ['Z']], brass, 3);
  // bęben
  inkShape(ctx, [['M', -150, -90], ['L', -70, -90], ['C', -60, -70, -60, -40, -70, -24], ['L', -150, -24], ['C', -160, -40, -160, -70, -150, -90], ['Z']], steel, lw, { shade: (c) => {
    c.fillStyle = steelD; for (const fy of [-80, -60, -40]) { c.beginPath(); c.ellipse(-110, fy + 4, 36, 4.5, 0, 0, 7); c.fill(); }
    c.fillStyle = steelL; c.fillRect(-150, -90, 80, 6); shadeBottom('rgba(10,10,20,0.6)', -50, -24)(c);
  } });
  // lufa (długa, ośmiokątna)
  inkShape(ctx, [['M', -440, -88], ['L', -150, -84], ['L', -150, -58], ['L', -440, -66], ['Z']], steel, lw, { shade: (c) => {
    c.fillStyle = steelL; c.beginPath(); c.moveTo(-440, -88); c.lineTo(-150, -84); c.lineTo(-150, -78); c.lineTo(-440, -83); c.fill();
    c.fillStyle = steelD; c.beginPath(); c.moveTo(-440, -70); c.lineTo(-150, -64); c.lineTo(-150, -58); c.lineTo(-440, -66); c.fill();
    strokes(c, [[-430, -76, -160, -71]], 1.6);
  } });
  // pręt wyciora pod lufą
  inkShape(ctx, [['M', -380, -64], ['L', -150, -58], ['L', -150, -46], ['L', -380, -54], ['Z']], steelD, lw * 0.7);
  // muszka + wylot
  inkShape(ctx, [['M', -430, -88], ['L', -424, -104], ['L', -414, -104], ['L', -412, -88], ['Z']], brass, 4);
  inkShape(ctx, [['M', -448, -90], ['L', -436, -90], ['L', -436, -64], ['L', -448, -64], ['Z']], steelD, 5);
  // kurek
  inkShape(ctx, [['M', -30, -66], ['C', -10, -96, 10, -110, 22, -108], ['C', 20, -96, 4, -80, -8, -60], ['Z']], steelD, lw * 0.8);
  // mosiężne śruby
  for (const p of [[-60, -50], [-28, -36], [-120, -30]]) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(p[0], p[1], 5.5, 0, 7); ctx.fill(); ctx.fillStyle = brass; ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, 7); ctx.fill(); }
  // dłoń w rękawicy (bez palców)
  const glove = '#5a3a24', gloveD = '#2e1c10', skin = '#d9a27a';
  inkShape(ctx, [['M', -20, 10], ['C', 10, -10, 70, 0, 110, 40], ['C', 150, 80, 180, 140, 190, 220], ['L', 60, 240], ['C', 50, 170, 20, 110, -20, 70], ['C', -40, 50, -40, 25, -20, 10], ['Z']], glove, lw, { shade: (c) => {
    shadeBottom('rgba(0,0,0,0.6)', 60, 230)(c); hatchRect(c, 40, 120, 200, 240, 6, 1.6, -0.6, 0.8, 6);
    c.strokeStyle = gloveD; c.lineWidth = 3; c.beginPath(); c.moveTo(20, 30); c.bezierCurveTo(60, 40, 90, 70, 110, 110); c.stroke();
  } });
  // palce (wychodzące z rękawicy) owinięte na chwycie
  for (let i = 0; i < 3; i++) {
    const fx = -30 + i * 16, fy = 30 + i * 22;
    inkShape(ctx, [['M', fx, fy], ['C', fx - 30, fy - 6, fx - 46, fy + 6, fx - 44, fy + 20], ['C', fx - 30, fy + 26, fx - 10, fy + 22, fx + 6, fy + 18], ['Z']], skin, 5, { shade: (c) => shadeBottom('rgba(120,50,20,0.6)', fy + 5, fy + 24)(c) });
    inkShape(ctx, [['M', fx - 8, fy - 2], ['L', fx + 10, fy - 4], ['L', fx + 12, fy + 20], ['L', fx - 6, fy + 22], ['Z']], glove, 4);
  }
  // kciuk
  inkShape(ctx, [['M', -10, -12], ['C', -40, -30, -70, -36, -84, -30], ['C', -84, -18, -60, -10, -20, 6], ['Z']], skin, 5, { shade: (c) => shadeBottom('rgba(120,50,20,0.5)', -30, 0)(c) });
  // rękaw
  inkShape(ctx, [['M', 70, 160], ['C', 130, 130, 200, 140, 260, 170], ['L', 260, 300], ['L', 60, 300], ['Z']], '#3c5a62', lw, { shade: (c) => { hatchRect(c, 60, 150, 260, 300, 7, 1.8, -0.7, 0.8, 3); c.fillStyle = '#5f8790'; c.fillRect(70, 150, 190, 14); } });
  ctx.restore();
}

// ---------- HUD gracza ----------
function bar(ctx, x, y, w, h, frac, fill, back, dir, curve) {
  // skośny pasek z lekką krzywizną (dir: 1 = rośnie w prawo)
  const sk = h * 0.6;
  const path = (ww) => {
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.quadraticCurveTo(x + ww * 0.5, y + h - curve, x + ww, y + h - curve * 0.3);
    ctx.lineTo(x + ww + sk * dir, y - curve * 0.3); ctx.quadraticCurveTo(x + ww * 0.5 + sk * dir, y - curve, x + sk * dir, y); ctx.closePath();
  };
  path(w); ctx.fillStyle = back; ctx.fill();
  if (frac > 0) {
    ctx.save(); path(w); ctx.clip();
    ctx.fillStyle = fill;
    if (dir > 0) ctx.fillRect(x - 10, y - curve - 5, (w + sk + 10) * frac + 10, h + curve + 10); else ctx.fillRect(x + w + sk + 10 - (w + sk + 20) * frac, y - curve - 5, (w + sk + 20) * frac + 10, h + curve + 10);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - 10, y - curve - 5, w + 40, h * 0.35 + curve);
    ctx.restore();
  }
  path(w); ctx.lineWidth = Math.max(2, h * 0.16); ctx.strokeStyle = INK; ctx.stroke();
}
function txt(ctx, s, x, y, size, color, align, stroke) {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round'; ctx.lineWidth = stroke == null ? size * 0.22 : stroke; ctx.strokeStyle = INK;
  if (ctx.lineWidth > 0) ctx.strokeText(s, x, y);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function drawHUD(ctx, W, H, u, st) {
  const m = 18 * u;
  // --- kompas u góry ---
  const cw = Math.min(W * 0.55, 420 * u), cx = W / 2, cy = m + 18 * u;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,18,0.55)'; ctx.beginPath();
  ctx.moveTo(cx - cw / 2, cy - 14 * u); ctx.lineTo(cx + cw / 2, cy - 14 * u); ctx.lineTo(cx + cw / 2 - 14 * u, cy + 14 * u); ctx.lineTo(cx - cw / 2 + 14 * u, cy + 14 * u); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2.5 * u; ctx.strokeStyle = '#f7b500'; ctx.stroke();
  ctx.save(); ctx.clip();
  const head = st.heading; // stopnie
  const ppd = cw / 120; // px na stopień
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let d = Math.floor(head - 70); d <= head + 70; d++) {
    const dd = ((d % 360) + 360) % 360; const x = cx + (d - head) * ppd;
    if (dd % 45 === 0) txt(ctx, labels[dd], x, cy + 8 * u, (dd % 90 === 0 ? 22 : 15) * u, dd === 0 ? '#ff6a2a' : '#ffe9a8', 'center', 3 * u);
    else if (dd % 15 === 0) { ctx.fillStyle = '#ffe9a8'; ctx.fillRect(x - 1 * u, cy - 6 * u, 2 * u, 10 * u); }
  }
  ctx.restore();
  // znacznik celu
  ctx.fillStyle = '#f7b500'; ctx.beginPath(); ctx.moveTo(cx, cy + 16 * u); ctx.lineTo(cx - 7 * u, cy + 26 * u); ctx.lineTo(cx + 7 * u, cy + 26 * u); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2 * u; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();

  // --- lewy dół: tarcza + zdrowie ---
  const bw = Math.min(W * 0.32, 250 * u), bh = 20 * u;
  const lx = m + 34 * u, ly = H - m - 34 * u;
  // tarcza
  bar(ctx, lx, ly - 34 * u, bw * 0.9, bh * 0.8, st.shield, '#2fb6ff', 'rgba(8,30,50,0.7)', 1, 8 * u);
  // ikona tarczy
  ctx.save(); ctx.translate(lx - 18 * u, ly - 26 * u);
  ctx.beginPath(); ctx.moveTo(0, -13 * u); ctx.lineTo(11 * u, -8 * u); ctx.quadraticCurveTo(11 * u, 8 * u, 0, 14 * u); ctx.quadraticCurveTo(-11 * u, 8 * u, -11 * u, -8 * u); ctx.closePath();
  ctx.fillStyle = '#2fb6ff'; ctx.fill(); ctx.lineWidth = 3 * u; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  txt(ctx, String(Math.round(st.shield * 2840)), lx + bw * 0.9 + 18 * u, ly - 20 * u, 20 * u, '#bff0ff', 'left');
  // zdrowie
  bar(ctx, lx, ly, bw, bh, st.health, '#e8322a', 'rgba(50,8,8,0.7)', 1, 10 * u);
  // czerwony krzyż
  ctx.save(); ctx.translate(lx - 18 * u, ly + 10 * u);
  const k = 5 * u, L = 13 * u;
  ctx.beginPath(); ctx.moveTo(-k, -L); ctx.lineTo(k, -L); ctx.lineTo(k, -k); ctx.lineTo(L, -k); ctx.lineTo(L, k); ctx.lineTo(k, k); ctx.lineTo(k, L); ctx.lineTo(-k, L); ctx.lineTo(-k, k); ctx.lineTo(-L, k); ctx.lineTo(-L, -k); ctx.lineTo(-k, -k); ctx.closePath();
  ctx.fillStyle = '#e8322a'; ctx.fill(); ctx.lineWidth = 3 * u; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  txt(ctx, String(Math.round(st.health * 1337)), lx + bw + 18 * u, ly + 16 * u, 26 * u, '#ffd9d0', 'left');

  // --- prawy dół: amunicja + granaty ---
  const rx = W - m - 34 * u - bw;
  bar(ctx, rx, ly, bw, bh, st.clip / 6, '#f7b500', 'rgba(50,35,0,0.7)', -1, 10 * u);
  txt(ctx, `${st.clip}`, rx - 16 * u, ly + 18 * u, 30 * u, '#fff3c4', 'right');
  txt(ctx, `/ ${st.reserve}`, rx - 16 * u, ly - 12 * u, 18 * u, '#ffe08a', 'right');
  // ikona naboju
  ctx.save(); ctx.translate(W - m - 14 * u, ly + 10 * u);
  ctx.beginPath(); ctx.moveTo(-5 * u, 12 * u); ctx.lineTo(-5 * u, -4 * u); ctx.quadraticCurveTo(0, -16 * u, 5 * u, -4 * u); ctx.lineTo(5 * u, 12 * u); ctx.closePath();
  ctx.fillStyle = '#d8a83a'; ctx.fill(); ctx.lineWidth = 2.5 * u; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  // granaty
  for (let i = 0; i < st.grenades; i++) {
    const gx = rx + bw - i * 20 * u, gy = ly - 30 * u;
    ctx.beginPath(); ctx.arc(gx, gy, 7 * u, 0, 7); ctx.fillStyle = '#6e8c3a'; ctx.fill(); ctx.lineWidth = 2.5 * u; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(gx - 3 * u, gy - 11 * u, 6 * u, 4 * u);
  }
  // nazwa broni
  if (st.weaponName) {
    txt(ctx, st.weaponName, rx + bw, ly - 46 * u, 17 * u, '#5aa8ff', 'right');
  }

  // --- środek dół: pasek XP i poziom ---
  const xw = Math.min(W * 0.36, 300 * u), xx = W / 2 - xw / 2, xy = H - m - 6 * u;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(xx, xy, xw, 8 * u);
  ctx.fillStyle = '#f7b500'; ctx.fillRect(xx, xy, xw * st.xp, 8 * u);
  ctx.lineWidth = 2 * u; ctx.strokeStyle = INK; ctx.strokeRect(xx, xy, xw, 8 * u);
  for (let i = 1; i < 10; i++) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(xx + xw * i / 10, xy, 1.5 * u, 8 * u); }
  txt(ctx, `LVL ${st.level}`, xx - 8 * u, xy + 9 * u, 18 * u, '#ffe08a', 'right');

  // celownik
  const ch = 9 * u; ctx.lineWidth = 3 * u; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.moveTo(W / 2 - ch * 2, H / 2); ctx.lineTo(W / 2 - ch * 0.7, H / 2); ctx.moveTo(W / 2 + ch * 0.7, H / 2); ctx.lineTo(W / 2 + ch * 2, H / 2);
  ctx.moveTo(W / 2, H / 2 - ch * 2); ctx.lineTo(W / 2, H / 2 - ch * 0.7); ctx.moveTo(W / 2, H / 2 + ch * 0.7); ctx.lineTo(W / 2, H / 2 + ch * 2); ctx.stroke();
}

// ---------- plakietka wroga ----------
function drawPlate(ctx, cx, y, u, tr) {
  const s = u * tr.scale;
  const name = tr.name;
  ctx.font = `${22 * s}px ${FONT}`;
  const nw = ctx.measureText(name).width;
  const bw = Math.max(110 * s, nw + 10 * s);
  const by = y - 6 * s;
  // ikona badass (czaszka) albo poziom
  txt(ctx, name, cx, by - 14 * s, 22 * s, tr.badass ? '#ffb22e' : '#ffffff', 'center', 4.5 * s);
  txt(ctx, String(tr.level), cx - bw / 2 - 6 * s, by + 8 * s, 22 * s, '#ffffff', 'right', 4.5 * s);
  if (tr.badass) {
    // czaszka
    const sx = cx - nw / 2 - 18 * s, sy = by - 22 * s;
    ctx.beginPath(); ctx.arc(sx, sy, 8 * s, Math.PI, 0); ctx.lineTo(sx + 6 * s, sy + 8 * s); ctx.lineTo(sx - 6 * s, sy + 8 * s); ctx.closePath();
    ctx.fillStyle = '#ffb22e'; ctx.fill(); ctx.lineWidth = 3 * s; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sx - 3 * s, sy, 2.2 * s, 0, 7); ctx.arc(sx + 3 * s, sy, 2.2 * s, 0, 7); ctx.fill();
  }
  if (tr.shield > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(cx - bw / 2, by - 8 * s, bw, 6 * s);
    ctx.fillStyle = '#2fb6ff'; ctx.fillRect(cx - bw / 2, by - 8 * s, bw * tr.shield, 6 * s);
    ctx.lineWidth = 2 * s; ctx.strokeStyle = INK; ctx.strokeRect(cx - bw / 2, by - 8 * s, bw, 6 * s);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(cx - bw / 2, by, bw, 10 * s);
  ctx.fillStyle = '#e8322a'; ctx.fillRect(cx - bw / 2, by, bw * tr.hp, 10 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(cx - bw / 2, by, bw * tr.hp, 3 * s);
  ctx.lineWidth = 2.5 * s; ctx.strokeStyle = INK; ctx.strokeRect(cx - bw / 2, by, bw, 10 * s);
}

window.BL2Art = { drawSkag, drawHay, drawChest, drawGun, drawHUD, drawPlate, txt };
})();
