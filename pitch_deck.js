/**
 * FlowSecure — Pitch Deck generator.
 * Produces FlowSecure_Pitch.pptx (exported to PDF separately).
 */

const pptxgen = require("pptxgenjs");

// ── Palette ──────────────────────────────────────────────────────────────
const NAVY_DEEP   = "0A1F3D"; // dominant background
const NAVY_CARD   = "132D54"; // elevated card
const NAVY_LINE   = "1E3A66"; // subtle divider
const ORANGE      = "FF6B35"; // single alert accent (triggers, disruption)
const TEAL        = "14B8A6"; // protection / payout accent
const INK         = "E8EEF5"; // primary text on navy
const MUTED       = "94A3B8"; // secondary text on navy
const MUTED_DIM   = "64748B"; // tertiary / captions

const HEAD_FONT = "Georgia";
const BODY_FONT = "Calibri";

// ── Helpers ──────────────────────────────────────────────────────────────
const card = (slide, { x, y, w, h, fill = NAVY_CARD, accent = null }) => {
  slide.addShape("rect", {
    x, y, w, h,
    fill: { color: fill },
    line: { color: NAVY_LINE, width: 0.75 },
  });
  if (accent) {
    slide.addShape("rect", {
      x, y, w: 0.06, h,
      fill: { color: accent },
      line: { type: "none" },
    });
  }
};

const eyebrow = (slide, text, y = 0.45) => {
  slide.addText(text, {
    x: 0.6, y, w: 8.8, h: 0.3,
    fontSize: 10, fontFace: BODY_FONT, bold: true,
    color: ORANGE, charSpacing: 8, margin: 0,
  });
};

const title = (slide, text, y = 0.8) => {
  slide.addText(text, {
    x: 0.6, y, w: 8.8, h: 0.9,
    fontSize: 32, fontFace: HEAD_FONT, bold: true,
    color: INK, margin: 0,
  });
};

const pageNum = (slide, n, total = 10) => {
  slide.addText(`${String(n).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, {
    x: 8.6, y: 5.25, w: 1.1, h: 0.25,
    fontSize: 9, fontFace: BODY_FONT,
    color: MUTED_DIM, align: "right", margin: 0,
  });
};

const footerBrand = (slide) => {
  slide.addText("FlowSecure", {
    x: 0.6, y: 5.25, w: 3, h: 0.25,
    fontSize: 9, fontFace: BODY_FONT, bold: true,
    color: MUTED, charSpacing: 4, margin: 0,
  });
};

// ── Build deck ───────────────────────────────────────────────────────────
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";   // 10 × 5.625
pres.title = "FlowSecure — Pitch Deck";
pres.author = "FlowSecure";

// ════════════════════════════════════════════════════════════════════════
// SLIDE 1 — TITLE
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY_DEEP };

  // Thick accent bar on the left
  s.addShape("rect", { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: ORANGE }, line: { type: "none" } });

  s.addText("FLOWSECURE", {
    x: 0.7, y: 1.4, w: 8.8, h: 1.2,
    fontSize: 72, fontFace: HEAD_FONT, bold: true,
    color: INK, charSpacing: 8, margin: 0,
  });

  s.addShape("rect", { x: 0.72, y: 2.62, w: 0.6, h: 0.04, fill: { color: ORANGE }, line: { type: "none" } });

  s.addText("Parametric Income Protection for India's Delivery Workforce", {
    x: 0.7, y: 2.75, w: 8.8, h: 0.5,
    fontSize: 20, fontFace: BODY_FONT,
    color: INK, margin: 0,
  });

  s.addText("Predict   ·   Optimize   ·   Protect", {
    x: 0.7, y: 3.35, w: 8.8, h: 0.4,
    fontSize: 14, fontFace: BODY_FONT, italic: true,
    color: TEAL, charSpacing: 6, margin: 0,
  });

  // Bottom meta
  s.addText("AI-Powered  ·  Auto-Payout  ·  Zero-Documentation Claims", {
    x: 0.7, y: 4.95, w: 8.8, h: 0.3,
    fontSize: 10, fontFace: BODY_FONT, bold: true,
    color: MUTED, charSpacing: 4, margin: 0,
  });
  s.addText("Hackathon Submission · 2026", {
    x: 0.7, y: 5.22, w: 8.8, h: 0.3,
    fontSize: 9, fontFace: BODY_FONT,
    color: MUTED_DIM, margin: 0,
  });
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 2 — THE PROBLEM
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY_DEEP };

  eyebrow(s, "THE PROBLEM");
  title(s, "When the city stops moving, riders stop earning.");

  // Giant stat callout — the operational surface we actually built against.
  card(s, { x: 0.6, y: 2.0, w: 4.1, h: 2.85, accent: ORANGE });
  s.addText("13,000", {
    x: 0.8, y: 2.15, w: 3.8, h: 1.3,
    fontSize: 64, fontFace: HEAD_FONT, bold: true,
    color: ORANGE, margin: 0,
  });
  s.addText("riders modelled across 13 Indian cities", {
    x: 0.8, y: 3.35, w: 3.8, h: 0.45,
    fontSize: 13, fontFace: BODY_FONT, bold: true,
    color: INK, margin: 0,
  });
  s.addText("Paid per order. No base pay. No sick leave. No safety net when the weather, air, or traffic makes the shift unworkable.", {
    x: 0.8, y: 3.85, w: 3.8, h: 0.9,
    fontSize: 11, fontFace: BODY_FONT,
    color: MUTED, margin: 0,
  });

  // Three disruption cards on the right — thresholds taken from the code.
  const disruptions = [
    { title: "Climate",    body: "Rainfall to 120 mm, heat to 50°C, AQI to 700+, fog visibility to 50 m. Six trigger types, 4-level severity ladders." },
    { title: "Civic",      body: "Partial bandh → full bandh → Section 144. Traffic-speed collapse below 5 km/h. Zones go dark for hours, not minutes." },
    { title: "Structural", body: "No income floor. Our seeded ledger shows 11,097 claim-worthy disruption events in just 8 weeks across the 13 cities." },
  ];
  disruptions.forEach((d, i) => {
    const y = 2.0 + i * 0.98;
    card(s, { x: 4.95, y, w: 4.5, h: 0.88, accent: ORANGE });
    s.addText(d.title, {
      x: 5.15, y: y + 0.1, w: 4.15, h: 0.3,
      fontSize: 14, fontFace: HEAD_FONT, bold: true,
      color: INK, margin: 0,
    });
    s.addText(d.body, {
      x: 5.15, y: y + 0.38, w: 4.15, h: 0.48,
      fontSize: 10, fontFace: BODY_FONT,
      color: MUTED, margin: 0,
    });
  });

  footerBrand(s); pageNum(s, 2);
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 3 — WHY TRADITIONAL INSURANCE FAILS
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY_DEEP };

  eyebrow(s, "DESIGN CHOICES");
  title(s, "Why FlowSecure had to be built from scratch.");

  // Framed as Traditional (ORANGE) vs FlowSecure (TEAL) for each gap we built around.
  const rows = [
    {
      trad: "Documentation-gated claims — bills, FIRs, employer letters",
      fs:   "Zero-documentation: oracle confirms, payout fires automatically",
    },
    {
      trad: "Days-to-weeks adjuster review before any money moves",
      fs:   "Minutes-level disbursement via Razorpay → rider UPI",
    },
    {
      trad: "One generic premium hides fraud cost — priced out of reach",
      fs:   "9-wall fraud gate + XGBoost score keeps loss ratio in check",
    },
    {
      trad: "Flat annual cover ignores the real shape of gig income loss",
      fs:   "City × month × zone-tier pricing on a 10-year IMD/CPCB baseline",
    },
  ];

  const headerY = 1.75;
  // Column headers
  s.addText("TRADITIONAL INSURANCE", {
    x: 0.6, y: headerY, w: 4.4, h: 0.3,
    fontSize: 10, fontFace: BODY_FONT, bold: true,
    color: ORANGE, charSpacing: 6, margin: 0,
  });
  s.addText("FLOWSECURE", {
    x: 5.2, y: headerY, w: 4.3, h: 0.3,
    fontSize: 10, fontFace: BODY_FONT, bold: true,
    color: TEAL, charSpacing: 6, margin: 0,
  });

  const rowY0 = 2.1, rowH = 0.72, rowGap = 0.1;
  rows.forEach((r, i) => {
    const y = rowY0 + i * (rowH + rowGap);
    card(s, { x: 0.6, y, w: 4.4, h: rowH, accent: ORANGE });
    s.addText(r.trad, {
      x: 0.8, y: y + 0.12, w: 4.1, h: rowH - 0.2,
      fontSize: 11, fontFace: BODY_FONT,
      color: INK, valign: "middle", margin: 0,
    });
    card(s, { x: 5.2, y, w: 4.3, h: rowH, accent: TEAL });
    s.addText(r.fs, {
      x: 5.4, y: y + 0.12, w: 4.0, h: rowH - 0.2,
      fontSize: 11, fontFace: BODY_FONT, bold: true,
      color: INK, valign: "middle", margin: 0,
    });
  });

  footerBrand(s); pageNum(s, 3);
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 4 — OUR APPROACH
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY_DEEP };

  eyebrow(s, "OUR APPROACH");
  title(s, "Predict. Optimize. Protect.");

  s.addText("A three-layer stack. Payout is the last resort — not the product.", {
    x: 0.6, y: 1.65, w: 8.8, h: 0.3,
    fontSize: 12, fontFace: BODY_FONT, italic: true,
    color: MUTED, margin: 0,
  });

  const layers = [
    {
      num: "01", title: "PREDICT",
      sub: "7-day zone-level disruption forecast",
      body: "Weather, AQI, traffic, and civic signals fused into a per-zone risk score. Riders and ops see what's coming before it arrives.",
      color: TEAL,
    },
    {
      num: "02", title: "OPTIMIZE",
      sub: "AI shift recommendations",
      body: "When risk spikes, the optimizer suggests alternate shift windows, zone swaps, and surge pockets — so riders avoid the loss before it happens.",
      color: TEAL,
    },
    {
      num: "03", title: "PROTECT",
      sub: "Parametric auto-payout",
      body: "If thresholds breach anyway, an oracle confirms and Razorpay disburses directly to the rider's UPI. Zero forms. Zero adjuster. Payout in minutes.",
      color: ORANGE,
    },
  ];

  const colW = 2.95, startX = 0.6;
  layers.forEach((l, i) => {
    const x = startX + i * (colW + 0.1);
    card(s, { x, y: 2.15, w: colW, h: 3.05, accent: l.color });

    s.addText(l.num, {
      x: x + 0.2, y: 2.3, w: 1.5, h: 0.4,
      fontSize: 10, fontFace: BODY_FONT, bold: true,
      color: MUTED_DIM, charSpacing: 6, margin: 0,
    });
    s.addText(l.title, {
      x: x + 0.2, y: 2.55, w: colW - 0.4, h: 0.45,
      fontSize: 22, fontFace: HEAD_FONT, bold: true,
      color: l.color, charSpacing: 2, margin: 0,
    });
    s.addShape("rect", { x: x + 0.22, y: 3.05, w: 0.3, h: 0.03, fill: { color: l.color }, line: { type: "none" } });
    s.addText(l.sub, {
      x: x + 0.2, y: 3.15, w: colW - 0.4, h: 0.45,
      fontSize: 12, fontFace: BODY_FONT, bold: true,
      color: INK, margin: 0,
    });
    s.addText(l.body, {
      x: x + 0.2, y: 3.6, w: colW - 0.4, h: 1.5,
      fontSize: 11, fontFace: BODY_FONT,
      color: MUTED, margin: 0,
    });
  });

  footerBrand(s); pageNum(s, 4);
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 5 — HOW PARAMETRIC WORKS
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY_DEEP };

  eyebrow(s, "HOW IT WORKS");
  title(s, "Six parametric triggers. One deterministic payout.");

  // Flow strip
  const flow = ["Sensor / Feed", "Threshold Breach", "Oracle Confirms", "Fraud Walls", "Razorpay UPI Payout"];
  const flowY = 1.75, stepW = 1.68, gap = 0.12;
  const flowX0 = 0.6;
  flow.forEach((f, i) => {
    const x = flowX0 + i * (stepW + gap);
    const isLast = i === flow.length - 1;
    s.addShape("rect", {
      x, y: flowY, w: stepW, h: 0.5,
      fill: { color: isLast ? ORANGE : NAVY_CARD },
      line: { color: isLast ? ORANGE : NAVY_LINE, width: 0.75 },
    });
    s.addText(f, {
      x, y: flowY, w: stepW, h: 0.5,
      fontSize: 10, fontFace: BODY_FONT, bold: true,
      color: isLast ? NAVY_DEEP : INK,
      align: "center", valign: "middle", margin: 0,
    });
    if (!isLast) {
      const arrowX = x + stepW + 0.005;
      s.addText("›", {
        x: arrowX, y: flowY, w: gap, h: 0.5,
        fontSize: 18, fontFace: BODY_FONT, bold: true,
        color: TEAL, align: "center", valign: "middle", margin: 0,
      });
    }
  });

  // Triggers table — rendered as cards in a 3×2 grid
  const triggers = [
    { name: "Rainfall",  thr: "65 → 80 → 100 → 120 mm",   unit: "4-level severity" },
    { name: "Heat",      thr: "45 → 47 → 50 °C",          unit: "3-level severity" },
    { name: "AQI",       thr: "500 → 600 → 700",          unit: "3-level severity" },
    { name: "Cold Fog",  thr: "500 → 200 → 50 m visibility", unit: "3-level severity" },
    { name: "Traffic",   thr: "< 10 / < 5 km/h · ≥ 2 hrs",  unit: "sustained collapse" },
    { name: "Civic",     thr: "Partial Bandh → Full Bandh → §144", unit: "3-level severity" },
  ];

  const tW = 2.92, tH = 1.1, tGap = 0.12, tX0 = 0.6, tY0 = 2.55;
  triggers.forEach((t, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = tX0 + col * (tW + tGap);
    const y = tY0 + row * (tH + tGap);
    card(s, { x, y, w: tW, h: tH, accent: ORANGE });
    s.addText(t.name, {
      x: x + 0.2, y: y + 0.12, w: tW - 0.3, h: 0.35,
      fontSize: 14, fontFace: HEAD_FONT, bold: true,
      color: INK, margin: 0,
    });
    s.addText(t.thr, {
      x: x + 0.2, y: y + 0.45, w: tW - 0.3, h: 0.35,
      fontSize: 11, fontFace: BODY_FONT, bold: true,
      color: ORANGE, margin: 0,
    });
    s.addText(t.unit, {
      x: x + 0.2, y: y + 0.78, w: tW - 0.3, h: 0.28,
      fontSize: 9, fontFace: BODY_FONT,
      color: MUTED_DIM, charSpacing: 2, margin: 0,
    });
  });

  footerBrand(s); pageNum(s, 5);
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 6 — ARCHITECTURE & STACK
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY_DEEP };

  eyebrow(s, "ARCHITECTURE");
  title(s, "Three surfaces. One parametric core.");

  // Left: surfaces stack
  const surfaces = [
    { k: "Rider Web",   d: "React + Vite + Tailwind.  OTP login, live risk, payouts ledger." },
    { k: "Admin Web",   d: "Ops console.  Platform stats, live claim feed, fraud graph, actuarial." },
    { k: "Flutter App", d: "On-device wallet, push alerts, offline-tolerant claim flow." },
  ];
  surfaces.forEach((sf, i) => {
    const y = 1.85 + i * 1.15;
    card(s, { x: 0.6, y, w: 4.4, h: 1.02, accent: TEAL });
    s.addText(sf.k, {
      x: 0.8, y: y + 0.13, w: 4.1, h: 0.35,
      fontSize: 15, fontFace: HEAD_FONT, bold: true,
      color: INK, margin: 0,
    });
    s.addText(sf.d, {
      x: 0.8, y: y + 0.5, w: 4.1, h: 0.5,
      fontSize: 10, fontFace: BODY_FONT,
      color: MUTED, margin: 0,
    });
  });

  // Right: tech stack panels
  const stacks = [
    { h: "Backend",    v: "FastAPI · SQLAlchemy async · Supabase Postgres · 68 endpoints" },
    { h: "Intelligence", v: "Trained fraud model · Monte Carlo actuarial engine · trigger oracles" },
    { h: "Integrations", v: "Razorpay sandbox · OpenWeatherMap · Google OAuth · Twilio 2FA" },
    { h: "Scale",      v: "13,000 seeded riders · 13 cities · 8 weeks of ledger history" },
  ];
  const stY0 = 1.85, stH = 0.78, stGap = 0.1;
  stacks.forEach((st, i) => {
    const y = stY0 + i * (stH + stGap);
    card(s, { x: 5.1, y, w: 4.35, h: stH, accent: ORANGE });
    s.addText(st.h, {
      x: 5.3, y: y + 0.1, w: 4, h: 0.3,
      fontSize: 11, fontFace: BODY_FONT, bold: true,
      color: ORANGE, charSpacing: 4, margin: 0,
    });
    s.addText(st.v, {
      x: 5.3, y: y + 0.36, w: 4, h: 0.4,
      fontSize: 10.5, fontFace: BODY_FONT,
      color: INK, margin: 0,
    });
  });

  footerBrand(s); pageNum(s, 6);
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 7 — FRAUD DEFENSE
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY_DEEP };

  eyebrow(s, "FRAUD DEFENSE", 0.4);
  // Tighter title box so the 3×3 grid fits above the footer.
  s.addText("Nine walls between a claim and a payout.", {
    x: 0.6, y: 0.7, w: 8.8, h: 0.55,
    fontSize: 28, fontFace: HEAD_FONT, bold: true,
    color: INK, margin: 0,
  });

  s.addText("Parametric payouts are fast — which makes fraud attractive. Each wall runs in milliseconds, in parallel, before disbursement.", {
    x: 0.6, y: 1.3, w: 8.8, h: 0.3,
    fontSize: 11, fontFace: BODY_FONT, italic: true,
    color: MUTED, margin: 0,
  });

  const walls = [
    { n: "1", t: "Proof of Work",         d: "Delivery history sanity — can't claim for a shift you didn't work." },
    { n: "2", t: "Device Fingerprint",    d: "IMEI, SIM, sensor entropy to catch emulators and shared devices." },
    { n: "3", t: "Location Intelligence", d: "GPS breadcrumb plausibility vs claimed disruption zone." },
    { n: "4", t: "Crowd Oracle",          d: "Nearby riders corroborate — a 'bandh' with 200 active deliveries isn't one." },
    { n: "5", t: "Graph Network",         d: "Syndicate detection: ring-patterns across phone, UPI, device, zone." },
    { n: "6", t: "Temporal Patterns",     d: "Time-of-day and cadence anomalies vs the rider's 8-week baseline." },
    { n: "7", t: "Multi-Source",          d: "Cross-check weather claim against IMD + OpenWeather + AQI feeds." },
    { n: "8", t: "ML Fraud Score",        d: "XGBoost classifier, 19 features, 300 estimators. Returns probability 0–100." },
    { n: "9", t: "Human-in-Loop",         d: "Score > 70 routes to admin review in the claims console." },
  ];

  // Grid fits in y: 1.75 → 4.95 (row3 bottom), leaving 0.3" to the footer at 5.25.
  const wW = 2.92, wH = 1.0, wGap = 0.1, wX0 = 0.6, wY0 = 1.75;
  walls.forEach((w, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = wX0 + col * (wW + wGap);
    const y = wY0 + row * (wH + wGap);
    card(s, { x, y, w: wW, h: wH, accent: ORANGE });
    s.addText(w.n, {
      x: x + 0.15, y: y + 0.12, w: 0.55, h: 0.75,
      fontSize: 28, fontFace: HEAD_FONT, bold: true,
      color: ORANGE, margin: 0,
    });
    s.addText(w.t, {
      x: x + 0.75, y: y + 0.13, w: wW - 0.85, h: 0.3,
      fontSize: 12, fontFace: HEAD_FONT, bold: true,
      color: INK, margin: 0,
    });
    s.addText(w.d, {
      x: x + 0.75, y: y + 0.43, w: wW - 0.85, h: 0.55,
      fontSize: 9.5, fontFace: BODY_FONT,
      color: MUTED, margin: 0,
    });
  });

  footerBrand(s); pageNum(s, 7);
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 8 — ACTUARIAL RIGOR
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY_DEEP };

  eyebrow(s, "LIVE LEDGER");
  title(s, "Eight weeks. Thirteen cities. One honest ledger.");

  s.addText("These numbers are from the seeded database shipped with the repo — not projections.", {
    x: 0.6, y: 1.9, w: 8.8, h: 0.3,
    fontSize: 11, fontFace: BODY_FONT, italic: true,
    color: MUTED, margin: 0,
  });

  // Four KPI cards — all values pulled from /api/admin/actuarial aggregated over 13 cities.
  const kpis = [
    { k: "11,097", u: "claims processed",       c: TEAL },
    { k: "₹48.4L", u: "premium collected",      c: TEAL },
    { k: "₹5.4L",  u: "paid to riders",         c: TEAL },
    { k: "11.17%", u: "system loss ratio",      c: ORANGE },
  ];
  const kW = 2.15, kGap = 0.1;
  kpis.forEach((k, i) => {
    const x = 0.6 + i * (kW + kGap);
    card(s, { x, y: 2.3, w: kW, h: 0.85, accent: k.c });
    s.addText(k.k, {
      x, y: 2.34, w: kW, h: 0.5,
      fontSize: 26, fontFace: HEAD_FONT, bold: true,
      color: k.c, align: "center", margin: 0,
    });
    s.addText(k.u, {
      x, y: 2.78, w: kW, h: 0.3,
      fontSize: 10, fontFace: BODY_FONT,
      color: MUTED, align: "center", margin: 0,
    });
  });

  // Real per-city loss ratio chart — sorted low→high from actuarial endpoint.
  s.addChart(pres.charts.BAR, [{
    name: "Loss ratio (%)",
    labels: ["Indore","Lucknow","Bhopal","Jaipur","Pune","Patna","Hyderabad",
             "Ahmedabad","Chennai","Kolkata","Mumbai","Bangalore","Delhi"],
    values: [7.88, 8.46, 8.66, 9.11, 9.45, 9.73, 10.41, 10.92, 11.57, 12.58, 12.77, 13.27, 14.41],
  }], {
    x: 0.6, y: 3.2, w: 5.7, h: 1.95, barDir: "col",
    chartColors: [TEAL],
    chartColorsOpacity: 90,
    chartArea: { fill: { color: NAVY_CARD } },
    plotArea:  { fill: { color: NAVY_CARD } },
    catAxisLabelColor: MUTED,
    valAxisLabelColor: MUTED_DIM,
    catAxisLabelFontSize: 8,
    valAxisLabelFontSize: 8,
    catAxisLabelRotate: -35,
    valGridLine: { color: NAVY_LINE, size: 0.5 },
    catGridLine: { style: "none" },
    showTitle: true,
    title: "Actual 8-week loss ratio — 13 cities",
    titleColor: INK,
    titleFontSize: 11,
    titleFontFace: HEAD_FONT,
    showValue: false,
    showLegend: false,
  });

  // Right side — methodology facts (code-verified).
  const facts = [
    { k: "₹46.52", v: "average weekly premium per rider" },
    { k: "10-year", v: "IMD · CPCB · TomTom baseline"    },
    { k: "26-week", v: "forward Monte Carlo horizon"      },
    { k: "Weekly",  v: "BCR ledger refresh, per city"     },
  ];
  facts.forEach((f, i) => {
    const y = 3.25 + i * 0.47;
    s.addText(f.k, {
      x: 6.5, y, w: 1.45, h: 0.32,
      fontSize: 14, fontFace: HEAD_FONT, bold: true,
      color: TEAL, margin: 0,
    });
    s.addText(f.v, {
      x: 8.0, y: y + 0.05, w: 1.6, h: 0.3,
      fontSize: 9.5, fontFace: BODY_FONT,
      color: MUTED, margin: 0,
    });
  });

  footerBrand(s); pageNum(s, 8);
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 9 — WHAT'S NOVEL
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY_DEEP };

  eyebrow(s, "INNOVATION");
  title(s, "Four things we built that aren't on the shelf.");

  const innovations = [
    {
      t: "Predict-Optimize-Protect",
      b: "Most parametric products stop at 'pay when bad thing happens.' We add a prevention layer: 72-hour risk forecasts trigger shift recommendations, reducing loss before it occurs.",
    },
    {
      t: "Fraud Syndicate Graph",
      b: "Individual fraud checks miss collusion. Our graph wall links phones, UPIs, devices, and zones — flagging coordinated ring attacks that look clean at the row level.",
    },
    {
      t: "Zero-Documentation Claim",
      b: "Payout fires from deterministic oracles (weather APIs, AQI, traffic), not claim forms. A rider in a hit zone receives payout without opening the app — the opposite of how insurance usually works.",
    },
    {
      t: "Built for ₹ Economies",
      b: "Sub-₹50/week premium tier. UPI-native disbursement. Multi-language copy. Works on feature phones via Twilio fallback. The product respects the wallet of the worker.",
    },
  ];

  const iW = 4.4, iH = 1.55, iGap = 0.2;
  innovations.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * (iW + iGap);
    const y = 1.9 + row * (iH + iGap);
    card(s, { x, y, w: iW, h: iH, accent: TEAL });
    s.addText(`0${i + 1}`, {
      x: x + 0.2, y: y + 0.12, w: 0.8, h: 0.35,
      fontSize: 11, fontFace: BODY_FONT, bold: true,
      color: TEAL, charSpacing: 4, margin: 0,
    });
    s.addText(it.t, {
      x: x + 0.2, y: y + 0.38, w: iW - 0.4, h: 0.4,
      fontSize: 17, fontFace: HEAD_FONT, bold: true,
      color: INK, margin: 0,
    });
    s.addText(it.b, {
      x: x + 0.2, y: y + 0.8, w: iW - 0.4, h: 0.7,
      fontSize: 10.5, fontFace: BODY_FONT,
      color: MUTED, margin: 0,
    });
  });

  footerBrand(s); pageNum(s, 9);
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 10 — DEMO-READY / CLOSING
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY_DEEP };
  s.addShape("rect", { x: 0, y: 0, w: 10, h: 0.15, fill: { color: ORANGE }, line: { type: "none" } });

  s.addText("READY TO DEMO TODAY", {
    x: 0.6, y: 0.9, w: 8.8, h: 0.4,
    fontSize: 11, fontFace: BODY_FONT, bold: true,
    color: ORANGE, charSpacing: 8, margin: 0,
  });

  s.addText("A fully working prototype.", {
    x: 0.6, y: 1.35, w: 8.8, h: 0.9,
    fontSize: 40, fontFace: HEAD_FONT, bold: true,
    color: INK, margin: 0,
  });

  s.addText("Not a mockup. Not slides. A live system with real seeded data, sandbox payments, and an admin dashboard a judge can click through in two minutes.", {
    x: 0.6, y: 2.2, w: 8.8, h: 0.7,
    fontSize: 14, fontFace: BODY_FONT, italic: true,
    color: MUTED, margin: 0,
  });

  // Stats strip
  const stats = [
    { k: "13,000", v: "seeded riders" },
    { k: "13",     v: "cities" },
    { k: "68",     v: "API endpoints" },
    { k: "20",     v: "web pages + Flutter app" },
  ];
  const sx0 = 0.6, sw = 2.2, sy = 3.15;
  stats.forEach((st, i) => {
    const x = sx0 + i * (sw + 0.05);
    card(s, { x, y: sy, w: sw, h: 1.2, accent: TEAL });
    s.addText(st.k, {
      x, y: sy + 0.2, w: sw, h: 0.55,
      fontSize: 30, fontFace: HEAD_FONT, bold: true,
      color: TEAL, align: "center", margin: 0,
    });
    s.addText(st.v, {
      x, y: sy + 0.78, w: sw, h: 0.3,
      fontSize: 10, fontFace: BODY_FONT,
      color: MUTED, align: "center", charSpacing: 2, margin: 0,
    });
  });

  // Evaluator call-to-action
  s.addText([
    { text: "Evaluator access code: ", options: { color: MUTED, fontSize: 11 } },
    { text: "GUIDEWIRE2026", options: { color: ORANGE, fontSize: 13, bold: true, charSpacing: 4 } },
    { text: "     ·     ", options: { color: MUTED_DIM, fontSize: 11 } },
    { text: "./setup.sh  &&  ./start.sh", options: { color: INK, fontSize: 11, fontFace: "Consolas" } },
  ], {
    x: 0.6, y: 4.7, w: 8.8, h: 0.35,
    fontFace: BODY_FONT, margin: 0, align: "left",
  });

  s.addText("FlowSecure   ·   Predict · Optimize · Protect", {
    x: 0.6, y: 5.22, w: 8.8, h: 0.3,
    fontSize: 9, fontFace: BODY_FONT, bold: true,
    color: MUTED_DIM, charSpacing: 6, margin: 0,
  });
  s.addText("10 / 10", {
    x: 8.6, y: 5.22, w: 1.1, h: 0.3,
    fontSize: 9, fontFace: BODY_FONT,
    color: MUTED_DIM, align: "right", margin: 0,
  });
}

// ── Write ────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: "FlowSecure_Pitch.pptx" })
  .then(fn => console.log("Wrote:", fn));
