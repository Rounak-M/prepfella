const pptxgen = require("pptxgenjs");
const React = require("react");
const RDS = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");
// apply_theme.js ships with the Claude pptx skill; without it the deck still builds but keeps Office stock theme colours.
const SKILL = process.env.PPTX_SKILL_DIR || "C:/Users/Asus/.claude/skills/synced/ca55eb85-9097-478f-a3a3-52f4c8b0db7e_6e0e3ad7-04a3-4036-981b-404b502f8c7e/pptx";
const { applyTheme } = require(SKILL + "/scripts/apply_theme.js");

const path = require("path");
const OUT = process.argv[2] || path.resolve(__dirname, "../Prepfella.pptx");
const LOGOS = path.resolve(__dirname, "../logos");
const LOGO_ICON = LOGOS + "/01-chat/icon-1024.png";
const LOGO_LOCKUP = LOGOS + "/01-chat/lockup-notagline-dark.png";
const FELLA_ICON = LOGOS + "/05-fella/icon-1024.png";

const THEME = {
  name: "Interview Coach",
  headFontFace: "Arial",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "231A3B", lt1: "FFFFFF", dk2: "1C1433", lt2: "F5F1FC",
    accent1: "8B5CF6", accent2: "F472B6", accent3: "6D3FC9", accent4: "C9B8FF",
    accent5: "5B5470", accent6: "E4DCF5", hlink: "6D3FC9", folHlink: "B03C86",
  },
};
const HEX = THEME.colors;
const MONO = "Consolas";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "PrepFella — Idea & Implementation";
pres.author = "Rounak M, Jaron D, Manjunath M";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ---------- assets ----------
async function icon(name, color = "#FFFFFF") {
  const Cmp = fa[name];
  if (!Cmp) throw new Error("missing icon " + name);
  const svg = RDS.renderToStaticMarkup(React.createElement(Cmp, { color, size: "256" }));
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

async function glowBackground() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs>
    <radialGradient id="g" cx="82%" cy="18%" r="75%"><stop offset="0" stop-color="#5A3496"/><stop offset="0.6" stop-color="#${HEX.dk2}" stop-opacity="0"/></radialGradient>
    <radialGradient id="p" cx="8%" cy="105%" r="60%"><stop offset="0" stop-color="#7A2E6E"/><stop offset="0.7" stop-color="#${HEX.dk2}" stop-opacity="0"/></radialGradient></defs>
    <rect width="1920" height="1080" fill="#${HEX.dk2}"/><rect width="1920" height="1080" fill="url(#g)"/><rect width="1920" height="1080" fill="url(#p)"/></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

async function waveform() {
  const hs = [20, 44, 70, 36, 90, 110, 64, 30, 52, 84, 120, 96, 58, 28, 46, 78, 104, 72, 40, 22, 60, 88, 50, 32, 18, 40];
  const bars = hs.map((h, i) => `<rect x="${i * 20}" y="${(120 - h) / 2}" width="10" height="${h}" rx="5"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="240" viewBox="0 0 520 120"><defs>
    <linearGradient id="w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#${HEX.accent2}"/><stop offset="1" stop-color="#${HEX.accent4}"/></linearGradient></defs>
    <g fill="url(#w)">${bars}</g></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// ---------- helpers ----------
function T(slide, text, o) {
  slide.addText(text, { isTextBox: true, margin: 0, valign: "top", ...o });
}
const shadow = () => ({ type: "outer", color: HEX.dk2, opacity: 0.08, blur: 8, offset: 2, angle: 90 });

function card(slide, x, y, w, h, name, fill = C.background1, line = C.accent6) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: line, width: 0.75 },
    shadow: fill === C.background1 ? shadow() : undefined, objectName: name,
  });
}
function darkCard(slide, x, y, w, h, name) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.12, fill: { color: C.text2 }, line: { color: C.text2 }, objectName: name,
  });
}
function iconCircle(slide, data, x, y, d, fill = C.accent1, name = "Icon") {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: name + " circle" });
  slide.addImage({ data, x: x + d * 0.26, y: y + d * 0.26, w: d * 0.48, h: d * 0.48, objectName: name, altText: name });
}
function label(slide, text, x, y, w, color = C.accent3, size = 11) {
  T(slide, text.toUpperCase(), { x, y, w, h: 0.28, fontFace: MONO, fontSize: size, bold: true, color, charSpacing: 1.5 });
}
function chip(slide, text, x, y, fill, color) {
  const w = 0.3 + text.length * 0.1;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.38, rectRadius: 0.19, fill: { color: fill }, line: { color: fill }, objectName: "Chip " + text });
  T(slide, text, { x, y, w, h: 0.38, fontSize: 13, bold: true, color, align: "center", valign: "middle" });
  return x + w + 0.12;
}
const bullets = (items, o = {}) =>
  items.map((t, i) => ({ text: t, options: { bullet: { indent: 14 }, paraSpaceAfter: 6, breakLine: i < items.length - 1, ...o } }));

// ---------- layouts ----------
function defineLayouts(glow) {
  const footer = (color) => ({
    text: { text: "PrepFella · AI mock interviews", options: { x: 0.6, y: 7.0, w: 8, h: 0.3, fontSize: 10, color, margin: 0 } },
  });
  const cornerLogo = { image: { x: 12.33, y: 0.38, w: 0.4, h: 0.4, path: LOGO_ICON, altText: "PrepFella logo" } };
  const content = (title, bg, eyebrowColor, titleColor, footColor) =>
    pres.defineSlideMaster({
      title,
      background: { color: bg },
      margin: [0.5, 0.6, 0.6, 0.6],
      objects: [
        cornerLogo,
        { placeholder: { options: { name: "eyebrow", type: "body", x: 0.6, y: 0.45, w: 12.13, h: 0.3, fontFace: MONO, fontSize: 12, bold: true, color: eyebrowColor, charSpacing: 2, margin: 0, valign: "top" }, text: "" } },
        { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.8, w: 12.13, h: 0.8, fontSize: 32, bold: true, color: titleColor, margin: 0, valign: "top", align: "left" }, text: "" } },
        footer(footColor),
      ],
      slideNumber: { x: 12.13, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: footColor, align: "right" },
    });
  content("CONTENT", C.background2, C.accent3, C.text1, C.accent5);
  content("CONTENT_DARK", C.text2, C.accent2, C.background1, C.accent4);
  pres.defineSlideMaster({
    title: "COVER",
    background: { data: glow },
    objects: [
      { placeholder: { options: { name: "eyebrow", type: "body", x: 0.6, y: 0.55, w: 12.13, h: 0.35, fontFace: MONO, fontSize: 13, bold: true, color: C.accent2, charSpacing: 2, margin: 0, align: "center", valign: "top" }, text: "" } },
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.2, w: 12.13, h: 0.75, fontSize: 40, bold: true, color: C.background1, margin: 0, align: "center", valign: "middle" }, text: "" } },
      { placeholder: { options: { name: "subtitle", type: "body", x: 1.67, y: 2.02, w: 10.0, h: 0.45, fontSize: 18, color: C.background2, margin: 0, align: "center", valign: "top" }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "TITLE_DARK",
    background: { data: glow },
    objects: [
      cornerLogo,
      { placeholder: { options: { name: "eyebrow", type: "body", x: 0.6, y: 0.6, w: 12.13, h: 0.35, fontFace: MONO, fontSize: 14, bold: true, color: C.accent2, charSpacing: 2, margin: 0, valign: "top" }, text: "" } },
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.9, w: 12.13, h: 1.9, fontSize: 54, bold: true, color: C.background1, margin: 0, valign: "bottom", align: "left" }, text: "" } },
      { placeholder: { options: { name: "subtitle", type: "body", x: 0.6, y: 4.0, w: 10.0, h: 1.0, fontSize: 20, color: C.background2, margin: 0, valign: "top" }, text: "" } },
    ],
  });
}

function slideOf(master, section, eyebrow, title) {
  const s = pres.addSlide({ masterName: master, sectionTitle: section });
  if (eyebrow) s.addText(eyebrow.toUpperCase(), { placeholder: "eyebrow" });
  if (title) s.addText(title, { placeholder: "title" });
  return s;
}

// ---------- build ----------
(async () => {
  const glow = await glowBackground();
  const lockMeta = await sharp(LOGO_LOCKUP).metadata();
  const lockupRatio = lockMeta.width / lockMeta.height;
  const I = {};
  for (const n of ["FaUserClock", "FaListUl", "FaCommentSlash", "FaComments", "FaClipboardCheck", "FaChartLine",
    "FaFileLines", "FaBolt", "FaMicrophone", "FaGraduationCap", "FaLightbulb", "FaBook", "FaPenToSquare",
    "FaCompass", "FaRotate", "FaCode", "FaPuzzlePiece", "FaStar", "FaQuoteLeft", "FaArrowTrendUp",
    "FaRepeat", "FaThumbsUp"]) I[n] = await icon(n);

  defineLayouts(glow);
  const S = { problem: "The problem", idea: "The idea", how: "How it works", impl: "Implementation", why: "Why it wins" };

  // 1 — Cover
  pres.addSection({ title: S.problem });
  {
    const s = pres.addSlide({ masterName: "COVER", sectionTitle: S.problem });
    s.addText("CODEFEST · AI-POWERED WEB APPS × JOB READINESS", { placeholder: "eyebrow" });
    // logo dead centre of the 13.333 × 7.5 slide
    const lockH = 1.6, lockW = lockH * lockupRatio, mid = 13.333 / 2;
    s.addImage({ path: LOGO_LOCKUP, x: mid - lockW / 2, y: 7.5 / 2 - lockH / 2, w: lockW, h: lockH, objectName: "PrepFella logo", altText: "PrepFella logo" });
    s.addText("Practice the interview before it counts", { placeholder: "title" });
    s.addText("An AI mock interviewer that adapts to your role, your resume and every answer you give.", { placeholder: "subtitle" });
    s.addText("TEAM", { x: 0.6, y: 5.5, w: 12.13, h: 0.28, isTextBox: true, margin: 0, fontFace: MONO, fontSize: 12, bold: true, color: C.accent2, charSpacing: 1.5, align: "center" });
    const team = [["Jaron D", "01FE24BCA294"], ["Rounak M", "01FE24BCA298"], ["Manjunath M", "01FE24BCA079"]];
    team.forEach(([n, id], i) => {
      const x = mid - 4.8 + i * 3.2;
      T(s, n, { x, y: 5.85, w: 3.2, h: 0.36, fontSize: 18, bold: true, color: C.background1, align: "center" });
      T(s, id, { x, y: 6.22, w: 3.2, h: 0.3, fontFace: MONO, fontSize: 13, color: C.accent4, align: "center" });
    });
    s.addNotes("Open with the problem in one line: most people never get a realistic mock interview with honest feedback. We built an AI interviewer that adapts to the role, the resume and each answer.");
  }

  // 2 — Problem
  {
    const s = slideOf("CONTENT", S.problem, "The problem", "Why candidates walk into interviews underprepared");
    const items = [
      ["FaUserClock", "No one to practise with", "Real mock interviews need an expert interviewer’s time, so most candidates rehearse alone — or not at all."],
      ["FaListUl", "Generic question banks", "Practice sites serve the same static questions regardless of role, experience, or how you just answered."],
      ["FaCommentSlash", "No honest feedback", "Candidates rarely learn which answers were weak, why, or what to change before the real interview."],
    ];
    items.forEach(([ic, h, d], i) => {
      const x = 0.6 + i * (3.81 + 0.35), y = 1.95;
      card(s, x, y, 3.81, 3.55, "Problem card " + (i + 1));
      iconCircle(s, I[ic], x + 0.35, y + 0.35, 0.7, C.accent1, h);
      T(s, h, { x: x + 0.35, y: y + 1.3, w: 3.11, h: 0.5, fontSize: 20, bold: true, color: C.text1 });
      T(s, d, { x: x + 0.35, y: y + 1.85, w: 3.11, h: 1.5, fontSize: 15, color: C.accent5, lineSpacingMultiple: 1.1 });
    });
    T(s, [
      { text: "The cost: ", options: { bold: true, color: C.accent3 } },
      { text: "capable people underperform on the day — and never find out why.", options: { color: C.text1 } },
    ], { x: 0.6, y: 5.85, w: 12.13, h: 0.5, fontSize: 20 });
    s.addNotes("Three gaps from the problem statement: access to practice, personalisation, and feedback. Our platform targets all three.");
  }

  // 3 — Solution
  pres.addSection({ title: S.idea });
  {
    const s = slideOf("CONTENT", S.idea, "The idea", "An AI interviewer that adapts like a real panel");
    T(s, "Candidates set up the interview they’re actually facing. The AI runs it, scores it and coaches them on what to fix.",
      { x: 0.6, y: 1.65, w: 11.5, h: 0.75, fontSize: 18, color: C.text1 });
    label(s, "1 · Set up", 0.6, 2.55, 4);
    const tiles = [["Role", "Backend Engineer"], ["Experience", "Fresher · 0–1 yr"], ["Interview type", "Technical + HR"], ["Difficulty", "Medium, then adaptive"]];
    tiles.forEach(([k, v], i) => {
      const x = 0.6 + i * (2.808 + 0.3), y = 2.9;
      card(s, x, y, 2.808, 1.3, "Setup tile " + k);
      label(s, k, x + 0.25, y + 0.22, 2.3);
      T(s, v, { x: x + 0.25, y: y + 0.55, w: 2.4, h: 0.6, fontSize: 18, bold: true, color: C.text1 });
    });
    label(s, "2 · Then the AI", 0.6, 4.5, 4);
    const steps = [
      ["FaComments", "Asks relevant questions", "Generated for that role, level and resume — not pulled from a fixed bank."],
      ["FaClipboardCheck", "Evaluates every answer", "Communication, technical knowledge, problem-solving, answer quality."],
      ["FaChartLine", "Coaches the next attempt", "Personalised feedback, model answers and a study plan."],
    ];
    steps.forEach(([ic, h, d], i) => {
      const x = 0.6 + i * (3.81 + 0.35), y = 4.85;
      iconCircle(s, I[ic], x, y, 0.55, C.accent1, h);
      T(s, h, { x: x + 0.75, y, w: 3.05, h: 0.35, fontSize: 17, bold: true, color: C.text1 });
      T(s, d, { x: x + 0.75, y: y + 0.4, w: 3.05, h: 0.8, fontSize: 14, color: C.accent5 });
    });
    T(s, [
      { text: "ONE AI LAYER  ", options: { bold: true, color: C.accent3 } },
      { text: "profile review · question generation · answer evaluation · in-app assistant", options: { color: C.accent5 } },
    ], { x: 0.6, y: 6.35, w: 12.13, h: 0.35, fontFace: MONO, fontSize: 12 });
    s.addNotes("The core idea in one sentence. Users choose role, experience, interview type and difficulty — exactly the four inputs the problem statement asks for. One LLM sits behind all the AI features.");
  }

  // 4 — Journey
  {
    const s = slideOf("CONTENT", S.idea, "User journey", "From sign-up to a sharper second attempt");
    const steps = [
      ["Build profile", "Upload a resume and project links; AI Profile Review maps strengths and gaps.", true],
      ["Set the interview", "Choose role, experience level, interview type and difficulty.", false],
      ["Interview live", "Voice or text. The AI asks, listens and follows up on weak spots.", true],
      ["Get scored", "Every answer is rated on four skill dimensions, with evidence.", true],
      ["Learn", "A report with model answers, a focus list and an AI coach to ask.", true],
      ["Go again", "The next session targets your weakest areas. Progress is tracked.", false],
    ];
    const w = 1.82, gap = (12.133 - 6 * w) / 5;
    steps.forEach(([h, d, ai], i) => {
      const x = 0.6 + i * (w + gap), y = 1.95;
      card(s, x, y, w, 3.75, "Step " + (i + 1));
      s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.25, w: 0.55, h: 0.55, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: "Step number " + (i + 1) });
      T(s, String(i + 1), { x: x + 0.2, y: y + 0.25, w: 0.55, h: 0.55, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
      T(s, h, { x: x + 0.2, y: y + 0.95, w: 1.45, h: 0.6, fontSize: 16, bold: true, color: C.text1 });
      T(s, d, { x: x + 0.2, y: y + 1.6, w: 1.45, h: 1.5, fontSize: 14, color: C.accent5 });
      if (ai) {
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.2, y: y + 3.2, w: 1.05, h: 0.3, rectRadius: 0.15, fill: { color: C.accent2 }, line: { color: C.accent2 }, objectName: "AI tag " + (i + 1) });
        T(s, "AI-POWERED", { x: x + 0.2, y: y + 3.2, w: 1.05, h: 0.3, fontFace: MONO, fontSize: 10, bold: true, color: C.text2, align: "center", valign: "middle" });
      }
      if (i < 5) s.addShape(pres.shapes.CHEVRON, { x: x + w + gap / 2 - 0.07, y: 3.7, w: 0.14, h: 0.26, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: "Arrow " + (i + 1) });
    });
    iconCircle(s, I.FaRotate, 0.6, 5.95, 0.45, C.accent3, "Loop");
    T(s, "Steps 3–6 repeat — every session shapes the next one’s questions.", { x: 1.2, y: 5.95, w: 11, h: 0.45, fontSize: 16, color: C.text1, valign: "middle" });
    s.addNotes("Walk the six steps. Point out which ones are AI-powered. The loop is the product: each session feeds the next.");
  }

  // 5 — Features
  {
    const s = slideOf("CONTENT", S.idea, "Core features", "Six capabilities in one practice loop");
    const f = [
      ["FaFileLines", "Resume-aware questions", "Questions come from the candidate’s own projects, skills and claims — then get probed."],
      ["FaBolt", "Adaptive difficulty", "Each answer’s score decides the next move: go deeper, follow up, or ease off."],
      ["FaMicrophone", "Voice interviews", "Speak naturally; speech-to-text transcribes and the interviewer replies aloud."],
      ["FaClipboardCheck", "Automated evaluation", "Rubric-based scoring for every answer, with quoted evidence behind each score."],
      ["FaChartLine", "Performance analytics", "Scores by dimension and topic, tracked across sessions to show real progress."],
      ["FaGraduationCap", "Personalised learning", "Weak areas become a study plan with model answers and targeted drills."],
    ];
    f.forEach(([ic, h, d], i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.6 + col * (3.81 + 0.35), y = 1.95 + row * (2.15 + 0.3);
      card(s, x, y, 3.81, 2.15, "Feature " + h);
      iconCircle(s, I[ic], x + 0.3, y + 0.3, 0.6, C.accent1, h);
      T(s, h, { x: x + 1.05, y: y + 0.3, w: 2.55, h: 0.6, fontSize: 18, bold: true, color: C.text1, valign: "middle" });
      T(s, d, { x: x + 0.3, y: y + 1.1, w: 3.2, h: 0.9, fontSize: 14, color: C.accent5 });
    });
    s.addNotes("Each card maps to an item in the problem statement: adaptive questions, resume-based personalisation, voice interviewing, automated evaluation, performance analysis, personalised learning.");
  }

  // 6 — AI Profile Review
  {
    const s = slideOf("CONTENT", S.idea, "AI feature · profile review", "AI Profile Review: know where you stand first");
    T(s, "Before the first question, the AI reads the candidate’s resume, projects and target role — and tells them honestly where they stand.",
      { x: 0.6, y: 1.95, w: 5.7, h: 1.0, fontSize: 16, color: C.text1 });
    label(s, "Reads", 0.6, 3.1, 3);
    T(s, bullets(["Resume (PDF or DOCX)", "GitHub or portfolio links", "Target role and, optionally, a job description"]),
      { x: 0.6, y: 3.42, w: 5.7, h: 1.15, fontSize: 15, color: C.accent5 });
    label(s, "Returns", 0.6, 4.7, 3);
    T(s, bullets(["Role-fit summary", "Strengths and skill gaps", "Resume red flags, with rewrite tips", "A personalised interview plan"]),
      { x: 0.6, y: 5.02, w: 5.7, h: 1.6, fontSize: 15, color: C.accent5 });

    const x = 6.7, y = 1.95;
    darkCard(s, x, y, 6.033, 4.85, "Sample profile review");
    label(s, "Sample output · illustrative", x + 0.4, y + 0.35, 5, C.accent4);
    T(s, "Profile review — Data Analyst, fresher", { x: x + 0.4, y: y + 0.7, w: 5.3, h: 0.45, fontSize: 18, bold: true, color: C.background1 });
    label(s, "Strengths", x + 0.4, y + 1.4, 3, C.accent4);
    let cx = x + 0.4;
    for (const t of ["SQL", "Python", "Power BI"]) cx = chip(s, t, cx, y + 1.72, C.accent4, C.text2);
    label(s, "Gaps to work on", x + 0.4, y + 2.3, 3, C.accent4);
    cx = x + 0.4;
    for (const t of ["Statistics", "Data storytelling", "A/B testing"]) cx = chip(s, t, cx, y + 2.62, C.accent2, C.text2);
    label(s, "Interview plan", x + 0.4, y + 3.2, 3, C.accent4);
    T(s, "3 SQL case questions → 2 statistics probes → 2 behavioural (STAR)", { x: x + 0.4, y: y + 3.5, w: 5.3, h: 0.35, fontSize: 14, color: C.background2 });
    label(s, "Resume tip", x + 0.4, y + 3.98, 3, C.accent4);
    T(s, "Quantify the dashboard project: who used it, and what changed?", { x: x + 0.4, y: y + 4.28, w: 5.3, h: 0.35, fontSize: 14, color: C.background2 });
    s.addNotes("This is the first AI feature. The resume is parsed to text, then the LLM returns structured JSON: role fit, strengths, gaps, red flags and an interview plan. That plan seeds the first mock interview. The values on the right are an illustrative example.");
  }

  // 7 — AI Assistant
  {
    const s = slideOf("CONTENT", S.idea, "AI feature · in-app assistant", "An AI coach that stays with you between interviews");
    const x = 0.6, y = 1.95, w = 6.0;
    darkCard(s, x, y, w, 4.85, "Assistant chat mock");
    s.addImage({ path: FELLA_ICON, x: x + 0.3, y: y + 0.18, w: 0.6, h: 0.6, objectName: "Fella assistant icon", altText: "Fella, the PrepFella assistant" });
    T(s, "Fella", { x: x + 1.0, y: y + 0.2, w: 3, h: 0.32, fontSize: 16, bold: true, color: C.background1 });
    label(s, "AI assistant · context: last session", x + 1.0, y + 0.5, 4.6, C.accent4);
    const bubble = (text, bx, by, bw, bh, user) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: bx, y: by, w: bw, h: bh, rectRadius: 0.14, objectName: user ? "User message" : "Assistant message",
        fill: user ? { color: C.accent2 } : { color: C.background1, transparency: 88 },
        line: user ? { color: C.accent2 } : { color: C.background1, transparency: 100 },
      });
      T(s, text, { x: bx, y: by, w: bw, h: bh, margin: [6, 10, 6, 10], fontSize: 14, color: user ? C.text2 : C.background2, valign: "middle" });
    };
    bubble("Why did my answer on database indexing score low?", x + w - 0.35 - 4.0, y + 0.98, 4.0, 0.72, true);
    bubble("You defined an index but skipped the trade-off: writes get slower and storage grows. Try: definition → trade-off → an example from your own project.", x + 0.35, y + 1.85, 4.9, 1.15, false);
    bubble("Quiz me on it.", x + w - 0.35 - 2.2, y + 3.2, 2.2, 0.5, true);
    bubble("Q1. When would you choose not to add an index?", x + 0.35, y + 3.9, 4.9, 0.55, false);

    const items = [
      ["FaLightbulb", "Explains low scores", "Shows why an answer missed and what a stronger one sounds like."],
      ["FaBook", "Drills weak topics", "Builds quizzes from the gaps in the user’s last report."],
      ["FaPenToSquare", "Sharpens the resume", "Rewrites resume bullets to match a target job description."],
      ["FaCompass", "Guides the platform", "Answers ‘how do I…’ questions and suggests the next session."],
    ];
    items.forEach(([ic, h, d], i) => {
      const ix = 7.0, iy = 1.95 + i * 1.1;
      iconCircle(s, I[ic], ix, iy, 0.55, C.accent1, h);
      T(s, h, { x: ix + 0.8, y: iy, w: 4.9, h: 0.35, fontSize: 17, bold: true, color: C.text1 });
      T(s, d, { x: ix + 0.8, y: iy + 0.4, w: 4.9, h: 0.6, fontSize: 14, color: C.accent5 });
    });
    T(s, "Grounded in the user’s own profile and session history through retrieval, so advice is specific, not generic.",
      { x: 7.0, y: 6.4, w: 5.73, h: 0.45, fontSize: 14, italic: true, color: C.accent5 });
    s.addNotes("Second AI feature. The assistant is a chat panel available on every page. Each request includes the user's profile summary and the most relevant past answers, retrieved with embeddings, so it can explain their actual scores.");
  }

  // 8 — Adaptive engine
  pres.addSection({ title: S.how });
  {
    const s = slideOf("CONTENT", S.how, "How it works · adaptive engine", "Questions that adapt to every answer");
    const boxes = [
      ["Ask", "Question tuned to role, level and resume"],
      ["Listen", "Transcribe speech; note pace and pauses"],
      ["Score", "Grade on four dimensions, with evidence"],
      ["Decide", "Choose the next move using the rules below"],
    ];
    const w = 2.696, gap = (12.133 - 4 * w) / 3;
    boxes.forEach(([h, d], i) => {
      const x = 0.6 + i * (w + gap), y = 1.95, last = i === 3;
      if (last) darkCard(s, x, y, w, 1.45, "Step " + h); else card(s, x, y, w, 1.45, "Step " + h);
      label(s, "Step " + (i + 1), x + 0.25, y + 0.18, 2, last ? C.accent2 : C.accent3);
      T(s, h, { x: x + 0.25, y: y + 0.45, w: 2.2, h: 0.35, fontSize: 18, bold: true, color: last ? C.background1 : C.text1 });
      T(s, d, { x: x + 0.25, y: y + 0.82, w: 2.25, h: 0.55, fontSize: 14, color: last ? C.background2 : C.accent5 });
      if (i < 3) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + w + gap / 2 - 0.15, y: 2.55, w: 0.3, h: 0.26, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: "Flow arrow " + (i + 1) });
    });
    T(s, "↺  The loop runs once per question, typically 8–12 questions per session.", { x: 0.6, y: 3.5, w: 12.13, h: 0.35, fontSize: 14, italic: true, color: C.accent5 });
    const hdr = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text2 } } });
    const rows = [
      [hdr("If the answer…"), hdr("Next move"), hdr("Example")],
      ["Scores high (8–10)", "Raise difficulty or move to a new topic", "“Now design it for ten million users.”"],
      ["Is partly right (5–7)", "Follow up on the missing piece", "“What happens to writes with that index?”"],
      ["Is weak (0–4)", "Give a hint, ask a simpler variant, log a gap", "“Start with: what is an index for?”"],
      ["Mentions a resume claim", "Verify it", "“You used Kafka — why not RabbitMQ?”"],
    ];
    s.addTable(rows, {
      x: 0.6, y: 4.0, w: 12.133, colW: [3.2, 4.3, 4.633], rowH: 0.5, fontSize: 14, color: C.text1, valign: "middle",
      fill: { color: C.background1 }, border: { type: "solid", pt: 0.75, color: HEX.accent6 }, margin: [0.05, 0.12, 0.05, 0.12], objectName: "Decision rules",
    });
    s.addNotes("The adaptive engine is a small state machine around the LLM. The LLM returns a score per dimension; the rules choose the next action and the LLM writes the next question. Thresholds are tunable.");
  }

  // 9 — Evaluation
  {
    const s = slideOf("CONTENT", S.how, "How it works · evaluation", "Four dimensions of feedback, each backed by evidence");
    const dims = [
      ["FaComments", "Communication", "Clarity, STAR structure, filler words, pace", "Transcript analysis plus speech timing"],
      ["FaCode", "Technical knowledge", "Correctness, depth, right terminology", "LLM grades against role-specific key points"],
      ["FaPuzzlePiece", "Problem-solving", "Approach, trade-offs, edge cases", "Rubric scoring of the reasoning steps"],
      ["FaStar", "Answer quality", "Relevance, completeness, conciseness", "LLM-as-judge with a fixed rubric per question"],
    ];
    dims.forEach(([ic, h, m, how], i) => {
      const x = 0.6 + i * (2.808 + 0.3), y = 1.95;
      card(s, x, y, 2.808, 3.9, "Dimension " + h);
      iconCircle(s, I[ic], x + 0.3, y + 0.3, 0.6, C.accent1, h);
      T(s, h, { x: x + 0.3, y: y + 1.05, w: 2.3, h: 0.65, fontSize: 18, bold: true, color: C.text1 });
      label(s, "What we measure", x + 0.3, y + 1.78, 2.3);
      T(s, m, { x: x + 0.3, y: y + 2.06, w: 2.3, h: 0.7, fontSize: 14, color: C.accent5 });
      label(s, "How", x + 0.3, y + 2.85, 2.3);
      T(s, how, { x: x + 0.3, y: y + 3.13, w: 2.3, h: 0.7, fontSize: 14, color: C.accent5 });
    });
    iconCircle(s, I.FaQuoteLeft, 0.6, 6.05, 0.45, C.accent3, "Evidence");
    T(s, [
      { text: "Explainable by design: ", options: { bold: true, color: C.text1 } },
      { text: "every score cites the part of the answer it came from, so feedback is never a black box.", options: { color: C.text1 } },
    ], { x: 1.2, y: 6.05, w: 11.5, h: 0.45, fontSize: 16, valign: "middle" });
    s.addNotes("These are the four feedback areas named in the problem statement. Each answer gets a JSON result from the LLM: a score per dimension plus the quote that justifies it.");
  }

  // 10 — Report
  {
    const s = slideOf("CONTENT", S.how, "Sample report · illustrative values", "The report a candidate sees after every session");
    card(s, 0.6, 1.95, 6.4, 4.85, "Scores card");
    T(s, "Scores by dimension (out of 10)", { x: 0.9, y: 2.2, w: 5.8, h: 0.4, fontSize: 16, bold: true, color: C.text1 });
    s.addChart(pres.charts.BAR, [{ name: "Score", labels: ["Communication", "Technical knowledge", "Problem-solving", "Answer quality"], values: [6.5, 7.8, 7.0, 6.0] }], {
      x: 0.8, y: 2.65, w: 6.0, h: 3.0, barDir: "bar", chartColors: [HEX.accent1], barGapWidthPct: 60,
      catAxisOrientation: "maxMin", valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 10,
      catAxisLabelFontSize: 13, catAxisLabelColor: HEX.accent5, catAxisLabelFontFace: "+mn-lt", catAxisLineShow: false,
      valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 13, dataLabelColor: HEX.dk1, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "0.0",
      objectName: "Scores chart", altText: "Bar chart of sample scores: Communication 6.5, Technical knowledge 7.8, Problem-solving 7.0, Answer quality 6.0",
    });
    T(s, [
      { text: "Weakest: answer quality. ", options: { bold: true, color: C.accent3 } },
      { text: "Answers ran long and missed the core of the question.", options: { color: C.accent5 } },
    ], { x: 0.9, y: 5.85, w: 5.8, h: 0.7, fontSize: 14 });

    const x = 7.3, w = 5.433;
    card(s, x, 1.95, w, 4.85, "Fixes card");
    T(s, "Top three fixes", { x: x + 0.35, y: 2.2, w: 4.7, h: 0.4, fontSize: 16, bold: true, color: C.text1 });
    const fixes = ["Use STAR — project answers skipped the Result.", "Name the trade-off before the solution.", "Cut filler words: ‘basically’ came up 14 times."];
    T(s, fixes.map((t, i) => ({ text: t, options: { bullet: { type: "number" }, paraSpaceAfter: 14, breakLine: i < fixes.length - 1 } })),
      { x: x + 0.35, y: 2.75, w: 4.75, h: 1.6, fontSize: 16, color: C.accent5 });
    card(s, x + 0.35, 4.5, w - 0.7, 2.0, "Next session", C.background2, C.background2);
    label(s, "Next session · auto-planned", x + 0.6, 4.72, 4.3);
    T(s, [
      { text: "Medium difficulty · 2 behavioural (STAR) + 3 database-indexing questions", options: { breakLine: true, paraSpaceAfter: 8 } },
      { text: "Focus: structure and concise answers", options: { bold: true, color: C.accent3 } },
    ], { x: x + 0.6, y: 5.07, w: 4.3, h: 1.3, fontSize: 15, color: C.text1 });
    s.addNotes("This is what the candidate sees. Scores here are an illustrative example. The fixes and the next-session plan are generated from the per-answer evaluations.");
  }

  // 11 — Architecture
  pres.addSection({ title: S.impl });
  {
    const s = slideOf("CONTENT", S.impl, "Implementation · architecture", "Four layers, one AI backbone");
    const cols = [
      ["Client", "Next.js web app", ["Interview room", "Mic + live transcript", "Reports dashboard", "Assistant chat"]],
      ["Backend", "FastAPI services", ["Demo accounts, profiles", "Session orchestrator", "Adaptive engine", "Scoring service"]],
      ["AI layer", "LLM + speech", ["Hosted LLM (API)", "Speech-to-text", "Text-to-speech", "Resume parsing"]],
      ["Data", "Storage", ["SQLite (SQLAlchemy)", "Profiles + sessions", "Scores + reports", "Cached question audio"]],
    ];
    const w = 2.696, gap = (12.133 - 4 * w) / 3;
    cols.forEach(([k, h, items], i) => {
      const x = 0.6 + i * (w + gap), y = 1.95, ai = i === 2;
      if (ai) darkCard(s, x, y, w, 3.85, "Layer " + k); else card(s, x, y, w, 3.85, "Layer " + k);
      label(s, k, x + 0.25, y + 0.25, 2.2, ai ? C.accent2 : C.accent3);
      T(s, h, { x: x + 0.25, y: y + 0.55, w: 2.25, h: 0.6, fontSize: 16, bold: true, color: ai ? C.background1 : C.text1 });
      items.forEach((t, j) => {
        const iy = y + 1.3 + j * 0.6;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: x + 0.2, y: iy, w: w - 0.4, h: 0.48, rectRadius: 0.08, objectName: k + " item " + (j + 1),
          fill: ai ? { color: C.background1, transparency: 88 } : { color: C.background2 },
          line: ai ? { color: C.background1, transparency: 100 } : { color: C.background2 },
        });
        T(s, t, { x: x + 0.32, y: iy, w: w - 0.6, h: 0.48, fontSize: 14, color: ai ? C.background2 : C.text1, valign: "middle" });
      });
      if (i < 3) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + w + gap / 2 - 0.15, y: 3.75, w: 0.3, h: 0.26, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: "Layer arrow " + (i + 1) });
    });
    T(s, [
      { text: "One answer, end to end: ", options: { bold: true, color: C.text1 } },
      { text: "the browser streams audio → speech-to-text → scoring service → the LLM grades it and picks the next question → text-to-speech asks it.", options: { color: C.accent5 } },
    ], { x: 0.6, y: 6.0, w: 12.13, h: 0.75, fontSize: 15 });
    s.addNotes("The LLM is called through an OpenAI-compatible API, so the model can be swapped by changing one base URL. Speech-to-text can be Whisper or NVIDIA Riva; text-to-speech can start with the browser's built-in voices.");
  }

  // 12 — Tech stack
  {
    const s = slideOf("CONTENT", S.impl, "Implementation · tech stack", "A stack a small team can ship during the hackathon");
    const hdr = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text2 } } });
    const rows = [
      [hdr("Layer"), hdr("Choice"), hdr("Why")],
      ["Frontend", "Next.js, Tailwind CSS", "Fast to build; one codebase for the interview room and dashboard"],
      ["Interview audio", "MediaRecorder + WebSocket", "Streams answers for near-live transcription"],
      ["Backend", "FastAPI (Python)", "Async, and the same language as the AI tooling"],
      ["LLM", "Hosted LLM, OpenAI-compatible API", "One model for all four AI jobs; easy to swap"],
      ["Speech", "Whisper or NVIDIA Riva ASR; browser TTS", "Accurate transcripts; TTS costs nothing on the client"],
      ["Resume parsing", "PyMuPDF + LLM extraction", "Turns any resume layout into structured skills"],
      ["Data", "SQLite via SQLAlchemy", "Zero setup for the demo; moves to PostgreSQL by changing one URL"],
      ["Hosting", "Vercel (web), Docker on Render (API)", "Free tiers cover the demo"],
    ];
    s.addTable(rows, {
      x: 0.6, y: 1.95, w: 12.133, colW: [2.3, 4.1, 5.733], rowH: 0.5, fontSize: 14, color: C.text1, valign: "middle",
      fill: { color: C.background1 }, border: { type: "solid", pt: 0.75, color: HEX.accent6 }, margin: [0.05, 0.12, 0.05, 0.12], objectName: "Tech stack",
    });
    s.addNotes("Every choice favours speed of building. The LLM sits behind one client wrapper, so swapping the model is a configuration change.");
  }

  // 13 — Build plan
  {
    const s = slideOf("CONTENT", S.impl, "Implementation · build plan", "Hackathon build plan in three phases");
    const phases = [
      ["Phase 1", "Core loop", ["Demo accounts and profile setup", "Role, level, type and difficulty picker", "Text interview with AI-generated questions", "Per-answer scoring and session report"]],
      ["Phase 2", "Intelligence", ["Resume upload → AI Profile Review", "Adaptive follow-up questions", "Voice mode (speech-to-text + TTS)", "In-app assistant with session context"]],
      ["Phase 3", "Polish and demo", ["Progress dashboard across sessions", "Study plan generated from gaps", "Seeded demo account", "Pitch and live-demo run-through"]],
    ];
    phases.forEach(([k, h, items], i) => {
      const x = 0.6 + i * (3.81 + 0.35), y = 1.95;
      card(s, x, y, 3.81, 3.3, k);
      label(s, k, x + 0.3, y + 0.28, 3);
      T(s, h, { x: x + 0.3, y: y + 0.6, w: 3.2, h: 0.45, fontSize: 20, bold: true, color: C.text1 });
      T(s, bullets(items), { x: x + 0.3, y: y + 1.2, w: 3.25, h: 1.95, fontSize: 14, color: C.accent5 });
    });
    darkCard(s, 0.6, 5.45, 12.133, 1.3, "Beyond the hackathon");
    label(s, "Beyond the hackathon", 0.95, 5.67, 6, C.accent2);
    T(s, "Video cues (eye contact, posture) · company-specific question packs · college and bootcamp dashboards · interviews in regional languages",
      { x: 0.95, y: 6.0, w: 11.4, h: 0.6, fontSize: 15, color: C.background2 });
    s.addNotes("Phase 1 alone is a working demo. Phase 2 adds the features that make us different. Phase 3 is about a reliable live demo.");
  }

  // 14 — Differentiation
  pres.addSection({ title: S.why });
  {
    const s = slideOf("CONTENT", S.why, "Why it’s different", "How it compares with static practice sites");
    const rows = [
      [
        { text: "", options: { fill: { color: C.background2 } } },
        { text: "Static practice sites", options: { bold: true, color: C.text1, fill: { color: C.accent6 } } },
        { text: "PrepFella", options: { bold: true, color: C.text2, fill: { color: C.accent2 } } },
      ],
      ["Questions", "Fixed question bank", "Generated for role, level and resume"],
      ["Follow-ups", "None", "Adaptive — probes weak or vague answers"],
      ["Answer mode", "Typing, or self-recorded video", "Live two-way voice conversation"],
      ["Feedback", "A model answer to compare against", "Scored on four dimensions, with quoted evidence"],
      ["Profile insight", "Not offered", "AI Profile Review before the first question"],
      ["Between sessions", "Not offered", "AI assistant and a personalised study plan"],
      ["Progress", "Count of sessions done", "Score trends by skill across sessions"],
    ].map((r, i) => i === 0 ? r : [
      { text: r[0], options: { bold: true } }, r[1], { text: r[2], options: { bold: true, color: C.text1 } },
    ]);
    s.addTable(rows, {
      x: 0.6, y: 1.95, w: 12.133, colW: [2.6, 4.2, 5.333], rowH: 0.5, fontSize: 14, color: C.accent5, valign: "middle",
      fill: { color: C.background1 }, border: { type: "solid", pt: 0.75, color: HEX.accent6 }, margin: [0.05, 0.12, 0.05, 0.12], objectName: "Comparison",
    });
    T(s, [
      { text: "Our edge is the loop: ", options: { bold: true, color: C.accent3 } },
      { text: "profile → adaptive interview → evidence-based feedback → targeted practice.", options: { color: C.text1 } },
    ], { x: 0.6, y: 6.2, w: 12.13, h: 0.45, fontSize: 18 });
    s.addNotes("The comparison is against the typical question-bank style of practice site, not any one product.");
  }

  // 15 — Close
  {
    const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: S.why });
    s.addText("THANK YOU", { placeholder: "eyebrow" });
    s.addText("Practice that talks back", { placeholder: "title" });
    s.addText("PrepFella turns every mock interview into specific, evidence-backed coaching.", { placeholder: "subtitle" });
    T(s, [
      { text: "POWERED BY NVIDIA NEMOTRON  ", options: { bold: true, color: C.accent2 } },
      { text: "AI Profile Review · adaptive questions · answer evaluation · in-app assistant", options: { color: C.accent4 } },
    ], { x: 0.6, y: 4.55, w: 12.13, h: 0.35, fontFace: MONO, fontSize: 13 });
    label(s, "How we’ll know it works", 0.6, 5.0, 6, C.accent2, 12);
    const m = [
      ["FaArrowTrendUp", "Scores rise across repeat sessions on the same dimension"],
      ["FaRepeat", "Users finish sessions and come back for more"],
      ["FaThumbsUp", "Users rate the feedback as specific and useful"],
    ];
    m.forEach(([ic, t], i) => {
      const x = 0.6 + i * (3.81 + 0.35), y = 5.4;
      iconCircle(s, I[ic], x, y, 0.5, C.accent1, t);
      T(s, t, { x: x + 0.7, y: y - 0.02, w: 3.1, h: 0.6, fontSize: 15, color: C.background2 });
    });
    T(s, "Questions? · Jaron D · Rounak M · Manjunath M", { x: 0.6, y: 6.55, w: 12.13, h: 0.4, fontSize: 16, bold: true, color: C.background1 });
    s.addNotes("Close on the one-liner. Name the engine: NVIDIA Nemotron, called through NVIDIA's OpenAI-compatible NIM API, powers profile review, adaptive questions, evaluation and the assistant. Then the success measures, and invite questions.");
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote " + OUT);
})().catch((e) => { console.error(e); process.exit(1); });
