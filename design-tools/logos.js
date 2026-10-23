const fs = require("fs");
const path = require("path");
const opentype = require("opentype.js");
const sharp = require("sharp");

const OUT = process.argv[2] || path.resolve(__dirname, "../logos");
const FS = path.join(__dirname, "node_modules/@fontsource");
const load = (p) => { const b = fs.readFileSync(path.join(FS, p)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const F = {
  outfit5: load("outfit/files/outfit-latin-500-normal.woff"),
  outfit6: load("outfit/files/outfit-latin-600-normal.woff"),
  outfit7: load("outfit/files/outfit-latin-700-normal.woff"),
  grotesk: load("space-grotesk/files/space-grotesk-latin-700-normal.woff"),
  fredoka: load("fredoka/files/fredoka-latin-600-normal.woff"),
};

const P = {
  dark: "#1C1433", ink: "#231A3B", light: "#F5F1FC", violet: "#8B5CF6", deep: "#6D3FC9",
  lav: "#C9B8FF", lavSoft: "#E4DCF5", pink: "#F472B6", pinkSoft: "#FDB4D9", muted: "#5B5470",
  brand: "#AE02EE", tagline: "#C9C6D9",
};

// ---------- text → outlined paths ----------
// Serialize path commands ourselves: opentype.js's toPathData occasionally writes "NaN" coordinates.
function cleanPath(p) {
  const n = (v) => +v.toFixed(2);
  return p.commands.map((c) => {
    if (c.type === "M" || c.type === "L") return `${c.type}${n(c.x)} ${n(c.y)}`;
    if (c.type === "Q") return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
    if (c.type === "C") return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
    return "Z";
  }).join("");
}

// Glyph-by-glyph (no shaping: opentype.js chokes on some fonts' GSUB tables), with pair kerning.
function text(str, x, y, size, fill, font = F.outfit6, tracking = 0) {
  const k = size / font.unitsPerEm;
  let cx = x, out = "", prev = null;
  for (const ch of str) {
    const g = font.charToGlyph(ch);
    if (prev) cx += font.getKerningValue(prev, g) * k;
    out += cleanPath(g.getPath(cx, y, size)) + " ";
    cx += g.advanceWidth * k + tracking * size;
    prev = g;
  }
  return { d: `<path d="${out}" fill="${fill}"/>`, w: cx - x - tracking * size };
}
const sparkle = (cx, cy, s, fill) =>
  `<path d="M${cx},${cy - s} Q${cx},${cy} ${cx + s},${cy} Q${cx},${cy} ${cx},${cy + s} Q${cx},${cy} ${cx - s},${cy} Q${cx},${cy} ${cx},${cy - s} Z" fill="${fill}"/>`;

// ---------- icons (512×512 artboard; `id` keeps gradient ids unique when nested) ----------
const ICONS = {
  chat: (id) => `
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#BB03F1"/><stop offset="0.5" stop-color="#9D0FE1"/><stop offset="1" stop-color="#7F2FDE"/></linearGradient></defs>
    <rect width="512" height="512" rx="112" fill="url(#${id}g)"/>
    <rect x="150" y="112" width="226" height="196" rx="98" fill="#FFFFFF"/>
    <rect x="150" y="190" width="72" height="214" rx="36" fill="#FFFFFF"/>
    <circle cx="225" cy="210" r="17" fill="${P.brand}"/><circle cx="265" cy="210" r="17" fill="${P.brand}"/><circle cx="305" cy="210" r="17" fill="${P.brand}"/>`,

  sunset: (id) => `
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.pinkSoft}"/><stop offset="0.45" stop-color="${P.pink}"/><stop offset="1" stop-color="${P.violet}"/></linearGradient>
      <mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
        <circle cx="256" cy="226" r="178" fill="#FFFFFF"/><path d="M102,290 L66,470 L236,392 Z" fill="#FFFFFF"/>
        <rect x="0" y="292" width="512" height="7" fill="#000000"/><rect x="0" y="322" width="512" height="10" fill="#000000"/>
        <rect x="0" y="354" width="512" height="12" fill="#000000"/><rect x="0" y="388" width="512" height="14" fill="#000000"/>
        <rect x="0" y="424" width="512" height="16" fill="#000000"/>
      </mask></defs>
    <rect width="512" height="512" fill="url(#${id}g)" mask="url(#${id}m)"/>`,

  wave: (id) => `
    <defs><linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="140" y1="0" x2="400" y2="0">
      <stop offset="0" stop-color="${P.pink}"/><stop offset="1" stop-color="${P.lav}"/></linearGradient></defs>
    <rect width="512" height="512" rx="112" fill="${P.dark}"/>
    <rect x="140" y="112" width="58" height="290" rx="29" fill="url(#${id}g)"/>
    <rect x="226" y="122" width="36" height="176" rx="18" fill="url(#${id}g)"/>
    <rect x="280" y="112" width="36" height="196" rx="18" fill="url(#${id}g)"/>
    <rect x="334" y="125" width="36" height="170" rx="18" fill="url(#${id}g)"/>
    <rect x="388" y="158" width="36" height="104" rx="18" fill="url(#${id}g)"/>`,

  check: (id) => `
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.violet}"/><stop offset="1" stop-color="${P.deep}"/></linearGradient></defs>
    <rect x="62" y="78" width="268" height="200" rx="62" fill="${P.lav}"/>
    <path d="M100,262 L80,336 L170,276 Z" fill="${P.lav}"/>
    <rect x="176" y="178" width="270" height="214" rx="66" fill="url(#${id}g)"/>
    <path d="M384,372 L440,444 L322,390 Z" fill="${P.deep}"/>
    <polyline points="250,288 296,334 376,250" fill="none" stroke="#FFFFFF" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
    ${sparkle(436, 104, 34, P.pink)}${sparkle(470, 158, 15, P.pink)}`,

  fella: (id) => `
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A98BFA"/><stop offset="1" stop-color="#7448E6"/></linearGradient></defs>
    <path d="M120,252 A136,136 0 0 1 392,252" fill="none" stroke="${P.pink}" stroke-width="22" stroke-linecap="round"/>
    <path d="M350,356 L400,440 L288,390 Z" fill="#7448E6"/>
    <rect x="116" y="150" width="280" height="244" rx="112" fill="url(#${id}g)"/>
    <rect x="94" y="226" width="46" height="86" rx="22" fill="${P.pink}"/>
    <rect x="372" y="226" width="46" height="86" rx="22" fill="${P.pink}"/>
    <path d="M117,306 Q120,384 196,376" fill="none" stroke="${P.pink}" stroke-width="12" stroke-linecap="round"/>
    <circle cx="204" cy="375" r="15" fill="${P.pink}"/>
    <ellipse cx="208" cy="262" rx="22" ry="30" fill="#FFFFFF"/><ellipse cx="304" cy="262" rx="22" ry="30" fill="#FFFFFF"/>
    <circle cx="212" cy="270" r="11" fill="${P.dark}"/><circle cx="308" cy="270" r="11" fill="${P.dark}"/>
    <path d="M222,322 Q256,350 290,322" fill="none" stroke="#FFFFFF" stroke-width="13" stroke-linecap="round"/>`,

  sparkle: (id) => {
    const g = F.outfit7.charToGlyph("p").getPath(0, 0, 420);
    const bb = g.getBoundingBox();
    const dx = 256 - (bb.x1 + bb.x2) / 2 - 16, dy = 256 - (bb.y1 + bb.y2) / 2;
    return `
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.violet}"/><stop offset="1" stop-color="${P.deep}"/></linearGradient></defs>
    <rect width="512" height="512" rx="112" fill="url(#${id}g)"/>
    <path transform="translate(${dx.toFixed(1)},${dy.toFixed(1)})" d="${cleanPath(g)}" fill="#FFFFFF"/>
    ${sparkle(392, 136, 52, P.pink)}${sparkle(432, 216, 20, P.pinkSoft)}`;
  },
};

const CONCEPTS = [
  { key: "chat", name: "Chat P", line: "A P whose bowl is a chat bubble, mid-reply", font: F.outfit6, brand: true },
  { key: "sunset", name: "Sunset Bubble", line: "Miami striped sun, shaped like a speech bubble", font: F.outfit6 },
  { key: "wave", name: "Wave P", line: "Voice waveform bars that spell the P", font: F.grotesk },
  { key: "check", name: "Pass Check", line: "Interviewer + candidate bubbles, with a pass", font: F.outfit6 },
  { key: "fella", name: "The Fella", line: "A friendly interviewer buddy with a headset", font: F.fredoka },
  { key: "sparkle", name: "Sparkle p", line: "Lowercase p with an AI sparkle; split wordmark", font: F.outfit7, split: true },
];

// ---------- lockups ----------
function wordmark(c, x, baseline, size, onDark) {
  const main = onDark ? P.light : P.ink;
  if (c.brand) {
    const a = text("Prep", x, baseline, size, onDark ? "#FFFFFF" : P.ink, c.font, -0.01);
    const b = text("Fella.", x + a.w - 0.01 * size, baseline, size, P.brand, c.font, -0.01);
    return { svg: a.d + b.d, w: a.w + b.w };
  }
  if (!c.split) {
    const t = text("PrepFella", x, baseline, size, main, c.font, -0.01);
    return { svg: t.d, w: t.w };
  }
  const a = text("prep", x, baseline, size, onDark ? P.lav : P.deep, c.font, -0.01);
  const b = text("Fella", x + a.w + (-0.01 * size), baseline, size, main, c.font, -0.01);
  const end = x + a.w + b.w;
  return { svg: a.d + b.d + sparkle(end + size * 0.2, baseline - size * 0.78, size * 0.16, P.pink), w: a.w + b.w + size * 0.38 };
}
function lockup(c, onDark, id, tagline = true) {
  const H = 160, gap = 30, size = 92;
  const icon = `<svg x="0" y="0" width="${H}" height="${H}" viewBox="0 0 512 512">${ICONS[c.key](id)}</svg>`;
  if (c.brand && !tagline) {
    // icon + wordmark only, cap height centred on the icon
    const wm = wordmark(c, H + gap + 2, 116, 104, onDark);
    return { W: Math.ceil(H + gap + 2 + wm.w), H, inner: icon + wm.svg };
  }
  if (c.brand) {
    // wordmark over a tracked-out tagline, as in the approved PrepFella lockup
    const wm = wordmark(c, H + gap + 2, 94, 100, onDark);
    const tg = text("AI JOB READINESS PREPARATION", H + gap + 6, 138, 20.5, onDark ? P.tagline : P.muted, F.outfit5, 0.2);
    const W = Math.ceil(H + gap + Math.max(wm.w, tg.w) + 16);
    return { W, H, inner: icon + wm.svg + tg.d };
  }
  const wm = wordmark(c, H + gap, 112, size, onDark);
  const W = Math.ceil(H + gap + wm.w + 12);
  return { W, H, inner: icon + wm.svg };
}
const doc = (w, h, inner, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""}${inner}</svg>`;

// ---------- sheet ----------
function card(c, i, x, y) {
  const W = 780, H = 820, pad = 44;
  let s = `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="36" fill="#FFFFFF"/>`;
  s += text(String(i + 1).padStart(2, "0"), x + pad, y + 70, 28, P.deep, F.grotesk).d;
  s += text(c.name, x + pad + 52, y + 70, 34, P.ink, F.outfit6).d;
  s += text(c.line, x + pad, y + 112, 22, P.muted, F.outfit6).d;
  // hero icon on a soft tile
  s += `<rect x="${x + pad}" y="${y + 140}" width="300" height="300" rx="28" fill="${P.light}"/>`;
  s += `<svg x="${x + pad + 30}" y="${y + 170}" width="240" height="240" viewBox="0 0 512 512">${ICONS[c.key](`s${i}a`)}</svg>`;
  // small sizes
  const sizes = [110, 64, 36, 22];
  let sx = x + pad + 340;
  s += `<rect x="${sx}" y="${y + 140}" width="${W - pad * 2 - 340}" height="300" rx="28" fill="${P.dark}"/>`;
  let ix = sx + 30;
  sizes.forEach((sz, k) => {
    s += `<svg x="${ix}" y="${y + 290 - sz / 2}" width="${sz}" height="${sz}" viewBox="0 0 512 512">${ICONS[c.key](`s${i}z${k}`)}</svg>`;
    ix += sz + 22;
  });
  // lockups
  const lw = W - pad * 2;
  [false, true].forEach((dark, k) => {
    const ly = y + 470 + k * 165;
    s += `<rect x="${x + pad}" y="${ly}" width="${lw}" height="145" rx="28" fill="${dark ? P.dark : P.light}"/>`;
    const L = lockup(c, dark, `s${i}l${k}`);
    const scale = Math.min(0.62, (lw - 60) / L.W);
    const lx = x + pad + (lw - L.W * scale) / 2, lyy = ly + (145 - L.H * scale) / 2;
    s += `<g transform="translate(${lx.toFixed(1)},${lyy.toFixed(1)}) scale(${scale.toFixed(3)})">${L.inner}</g>`;
  });
  return s;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [i, c] of CONCEPTS.entries()) {
    const dir = path.join(OUT, `${String(i + 1).padStart(2, "0")}-${c.key}`);
    fs.mkdirSync(dir, { recursive: true });
    const icon = doc(512, 512, ICONS[c.key]("i"));
    fs.writeFileSync(path.join(dir, "icon.svg"), icon);
    await sharp(Buffer.from(doc(1024, 1024, `<svg width="1024" height="1024" viewBox="0 0 512 512">${ICONS[c.key]("i")}</svg>`))).png().toFile(path.join(dir, "icon-1024.png"));
    // name-only wordmark, for layouts that place the icon separately
    for (const dark of [false, true]) {
      const size = 200, asc = (c.font.ascender / c.font.unitsPerEm) * size, desc = (-c.font.descender / c.font.unitsPerEm) * size;
      const wm = wordmark(c, 0, asc, size, dark);
      const W = Math.ceil(wm.w + 8), H = Math.ceil(asc + desc);
      const name = dark ? "wordmark-dark" : "wordmark-light";
      fs.writeFileSync(path.join(dir, name + ".svg"), doc(W, H, wm.svg));
      await sharp(Buffer.from(doc(W * 2, H * 2, `<g transform="scale(2)">${wm.svg}</g>`))).png().toFile(path.join(dir, name + ".png"));
    }
    for (const dark of [false, true]) {
      const L = lockup(c, dark, "l");
      const name = dark ? "lockup-dark" : "lockup-light";
      fs.writeFileSync(path.join(dir, name + ".svg"), doc(L.W, L.H, L.inner));
      const s = 4;
      await sharp(Buffer.from(doc(L.W * s, L.H * s, `<g transform="scale(${s})">${L.inner}</g>`, dark ? P.dark : null))).png().toFile(path.join(dir, name + ".png"));
      if (dark) await sharp(Buffer.from(doc(L.W * s, L.H * s, `<g transform="scale(${s})">${L.inner}</g>`))).png().toFile(path.join(dir, name + "-transparent.png"));
    }
    if (c.brand) {
      for (const dark of [false, true]) {
        const L = lockup(c, dark, "n", false), s = 4;
        const name = dark ? "lockup-notagline-dark" : "lockup-notagline-light";
        fs.writeFileSync(path.join(dir, name + ".svg"), doc(L.W, L.H, L.inner));
        await sharp(Buffer.from(doc(L.W * s, L.H * s, `<g transform="scale(${s})">${L.inner}</g>`))).trim({ threshold: 1 }).png().toFile(path.join(dir, name + ".png")); // trimmed to the ink so it centres exactly
      }
    }
  }
  const cols = 3, cw = 780, ch = 820, g = 40, top = 210, m = 60;
  const SW = m * 2 + cols * cw + (cols - 1) * g, SH = top + 2 * ch + g + m;
  let sheet = `<rect width="${SW}" height="${SH}" fill="${P.lavSoft}"/>`;
  sheet += text("PrepFella", m, 120, 76, P.ink, F.outfit6).d;
  sheet += text("Logo concepts · soft Miami purple", m + 360, 120, 34, P.muted, F.outfit6).d;
  const sw = ["dark", "violet", "deep", "lav", "pink", "pinkSoft", "light"];
  sw.forEach((k, j) => { sheet += `<circle cx="${SW - m - 30 - j * 66}" cy="104" r="26" fill="${P[k]}" stroke="#FFFFFF" stroke-width="4"/>`; });
  CONCEPTS.forEach((c, i) => { sheet += card(c, i, m + (i % cols) * (cw + g), top + Math.floor(i / cols) * (ch + g)); });
  const sheetSvg = doc(SW, SH, sheet);
  fs.writeFileSync(path.join(OUT, "prepfella-logo-sheet.svg"), sheetSvg);
  await sharp(Buffer.from(sheetSvg)).png().toFile(path.join(OUT, "prepfella-logo-sheet.png"));
  console.log("done", SW, SH);
})().catch((e) => { console.error(e); process.exit(1); });
