// ============================================================
// Utility
// ============================================================
function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  return num / Math.sqrt(dx2 * dy2);
}

// ============================================================
// Image comparison slider
// ============================================================
function buildCompareSlider(container, patientId, timepoints) {
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "compare-wrap";

  const beforeImg = document.createElement("img");
  beforeImg.className = "compare-before";
  const afterImg = document.createElement("img");
  afterImg.className = "compare-after";
  const handle = document.createElement("div");
  handle.className = "compare-handle";

  wrap.appendChild(beforeImg);
  wrap.appendChild(afterImg);
  wrap.appendChild(handle);
  container.appendChild(wrap);

  const labels = document.createElement("div");
  labels.className = "compare-labels";
  labels.innerHTML = `<span id="label-before">T0</span><span id="label-after">T3</span>`;
  container.appendChild(labels);

  const caption = document.createElement("div");
  caption.className = "compare-caption";
  caption.textContent = "Drag to compare \u2014 signal-enhancement map, real tumor segmentation overlaid in red.";
  container.appendChild(caption);

  const scrubber = document.createElement("div");
  scrubber.className = "timepoint-scrubber";
  container.appendChild(scrubber);

  let beforeIdx = 0, afterIdx = timepoints.length - 1;

  function imgPath(tp) {
    return `assets/images/${patientId}/${tp}_overlay.png`;
  }

  function refreshImages() {
    beforeImg.src = imgPath(timepoints[beforeIdx]);
    afterImg.src = imgPath(timepoints[afterIdx]);
    labels.querySelector("#label-before").textContent = timepoints[beforeIdx];
    labels.querySelector("#label-after").textContent = timepoints[afterIdx];
  }

  function renderScrubberButtons() {
    scrubber.innerHTML = "";
    timepoints.forEach((tp, i) => {
      const btn = document.createElement("button");
      btn.className = "timepoint-btn" + (i === afterIdx ? " active" : "");
      btn.textContent = tp;
      btn.title = "Set as right-hand (after) image";
      btn.addEventListener("click", () => {
        afterIdx = i;
        beforeIdx = 0;
        refreshImages();
        renderScrubberButtons();
      });
      scrubber.appendChild(btn);
    });
  }

  refreshImages();
  renderScrubberButtons();

  // drag logic
  let dragging = false;
  function setSplit(clientX) {
    const rect = wrap.getBoundingClientRect();
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));
    afterImg.style.clipPath = `inset(0 0 0 ${pct}%)`;
    handle.style.left = `${pct}%`;
  }
  wrap.addEventListener("pointerdown", (e) => { dragging = true; setSplit(e.clientX); });
  window.addEventListener("pointermove", (e) => { if (dragging) setSplit(e.clientX); });
  window.addEventListener("pointerup", () => { dragging = false; });
  setSplit(wrap.getBoundingClientRect().left + wrap.getBoundingClientRect().width / 2);
}

// ============================================================
// Circuit SVG diagram
// ============================================================
function buildCircuitDiagram(container, meta) {
  container.innerHTML = "";
  const svg = svgEl("svg", { viewBox: "0 0 480 200" });

  const nodes = [
    { x: 40, y: 100, w: 120, h: 64, label: meta.imagingNode, sub: "Imaging feature" },
    { x: 200, y: 100, w: 110, h: 64, label: meta.geneNode, sub: "Gene(s)" },
    { x: 350, y: 100, w: 110, h: 64, label: meta.pathwayNode, sub: "Pathway (GSEA)" }
  ];

  nodes.forEach((n, i) => {
    const g = svgEl("g", {});
    const rect = svgEl("rect", {
      x: n.x, y: n.y - n.h / 2, width: n.w, height: n.h, rx: 8,
      class: "circuit-node" + (i === 1 ? " active-node" : "")
    });
    g.appendChild(rect);

    const label = svgEl("text", {
      x: n.x + n.w / 2, y: n.y - 2, "text-anchor": "middle", class: "circuit-label"
    });
    label.textContent = n.label;
    g.appendChild(label);

    const sub = svgEl("text", {
      x: n.x + n.w / 2, y: n.y + 16, "text-anchor": "middle", class: "circuit-sublabel"
    });
    sub.textContent = n.sub;
    g.appendChild(sub);

    svg.appendChild(g);
  });

  // connecting paths
  const path1 = svgEl("path", {
    d: `M 160 100 L 200 100`, class: "circuit-path"
  });
  const path2 = svgEl("path", {
    d: `M 310 100 L 350 100`, class: "circuit-path"
  });
  path2.style.animationDelay = "0.3s";
  svg.appendChild(path1);
  svg.appendChild(path2);

  const nesLabel = svgEl("text", { x: 240, y: 40, "text-anchor": "middle", class: "circuit-stat" });
  nesLabel.textContent = meta.nes;
  svg.appendChild(nesLabel);

  container.appendChild(svg);
}

// ============================================================
// Scatter plot (real data points)
// ============================================================
function buildScatter(container, xs, ys, pcrFlags, xLabel, yLabel) {
  container.innerHTML = "";
  const W = 420, H = 280, M = 44;

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}` });

  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xScale = (v) => M + ((v - xMin) / (xMax - xMin || 1)) * (W - M - 20);
  const yScale = (v) => H - M - ((v - yMin) / (yMax - yMin || 1)) * (H - M - 20);

  // axes
  svg.appendChild(svgEl("line", { x1: M, y1: H - M, x2: W - 20, y2: H - M, class: "scatter-axis" }));
  svg.appendChild(svgEl("line", { x1: M, y1: 20, x2: M, y2: H - M, class: "scatter-axis" }));

  const xAxisLabel = svgEl("text", { x: (W) / 2, y: H - 6, "text-anchor": "middle", class: "scatter-axis-label" });
  xAxisLabel.textContent = xLabel;
  svg.appendChild(xAxisLabel);

  const yAxisLabel = svgEl("text", {
    x: 14, y: H / 2, "text-anchor": "middle", class: "scatter-axis-label",
    transform: `rotate(-90, 14, ${H / 2})`
  });
  yAxisLabel.textContent = yLabel;
  svg.appendChild(yAxisLabel);

  xs.forEach((x, i) => {
    const c = svgEl("circle", {
      cx: xScale(x), cy: yScale(ys[i]), r: 3,
      class: pcrFlags[i] ? "scatter-point-pcr" : "scatter-point-nopcr",
      opacity: 0.85
    });
    svg.appendChild(c);
  });

  const r = pearson(xs, ys);
  const stat = svgEl("text", { x: W - 24, y: 30, "text-anchor": "end", class: "scatter-stat-line", fill: "var(--accent-teal)" });
  stat.textContent = `r = ${r.toFixed(3)}`;
  svg.appendChild(stat);

  container.appendChild(svg);

  const legend = document.createElement("div");
  legend.className = "scatter-legend";
  legend.innerHTML = `
    <span><span class="legend-dot" style="background: var(--accent-coral)"></span>pCR</span>
    <span><span class="legend-dot" style="background: var(--text-faint)"></span>Non-pCR</span>
  `;
  container.parentElement.appendChild(legend);
}

// ============================================================
// Circuit panel renderer
// ============================================================
const CIRCUIT_TIMEPOINTS = ["T0", "T1", "T2", "T3"];

function renderCircuitPanel(key) {
  const meta = CIRCUIT_META[key];
  const data = CIRCUIT_DATA[key];
  const root = document.getElementById("panel-root");
  root.innerHTML = "";

  const left = document.createElement("div");
  left.className = "panel-col";

  const imgCard = document.createElement("div");
  imgCard.className = "card";
  imgCard.innerHTML = `<h3>Patient ${meta.patientId} &middot; ${meta.subtypeLabel}</h3>`;
  const sliderMount = document.createElement("div");
  imgCard.appendChild(sliderMount);
  left.appendChild(imgCard);
  buildCompareSlider(sliderMount, meta.patientId, CIRCUIT_TIMEPOINTS);

  const noteCard = document.createElement("div");
  noteCard.className = "circuit-note";
  noteCard.textContent = meta.note;
  left.appendChild(noteCard);

  const right = document.createElement("div");
  right.className = "panel-col";

  const diagramCard = document.createElement("div");
  diagramCard.className = "card circuit-diagram-wrap";
  diagramCard.innerHTML = `<h3>Circuit</h3>`;
  const diagramMount = document.createElement("div");
  diagramCard.appendChild(diagramMount);
  right.appendChild(diagramCard);
  buildCircuitDiagram(diagramMount, meta);

  const scatterCard = document.createElement("div");
  scatterCard.className = "card scatter-wrap";
  scatterCard.innerHTML = `<h3>Real gene correlation (n = ${data.points.length})</h3>`;
  const scatterMount = document.createElement("div");
  scatterCard.appendChild(scatterMount);
  right.appendChild(scatterCard);

  if (key === "hr_her2neg") {
    const xs = data.points.map(p => p.x);
    const ys = data.points.map(p => p.y);
    const pcr = data.points.map(p => p.pCR);
    buildScatter(scatterMount, xs, ys, pcr, data.imaging_label, data.gene);
  } else if (key === "her2pos") {
    const xs = data.points.map(p => p.x);
    const ys = data.points.map(p => p.erbb2);
    const pcr = data.points.map(p => p.pCR);
    buildScatter(scatterMount, xs, ys, pcr, data.imaging_label, "ERBB2");
  } else if (key === "tnbc") {
    const xs = data.points.map(p => p.x);
    const ys = data.points.map(p => p.flt1);
    const pcr = data.points.map(p => p.pCR);
    buildScatter(scatterMount, xs, ys, pcr, data.imaging_label, "FLT1");
  }

  const mediationCard = document.createElement("div");
  mediationCard.className = "card";
  mediationCard.innerHTML = `
    <h3>Mediation &amp; replication</h3>
    <p style="font-size:0.85rem;color:var(--text-muted);margin:0 0 0.6rem 0;">${meta.mediation}</p>
    <p style="font-size:0.85rem;color:var(--text-muted);margin:0;">${meta.replication}</p>
  `;
  right.appendChild(mediationCard);

  root.appendChild(left);
  root.appendChild(right);
}

// ============================================================
// Tabs
// ============================================================
document.querySelectorAll(".circuit-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".circuit-tab").forEach(t => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    renderCircuitPanel(tab.dataset.circuit);
  });
});

// ============================================================
// AUC comparison chart
// ============================================================
let activeSubtypes = new Set(["pooled", "hr_her2neg", "her2pos", "tnbc"]);

function renderAucChart() {
  const svg = document.getElementById("auc-chart");
  svg.innerHTML = "";
  const keys = Array.from(activeSubtypes);
  const barW = 46, gap = 26, groupGap = 50;
  const chartH = 260, baseY = 300;
  let x = 60;

  svg.appendChild(svgEl("line", { x1: 40, y1: baseY, x2: 620, y2: baseY, class: "scatter-axis" }));

  [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach(v => {
    const y = baseY - v * chartH;
    svg.appendChild(svgEl("line", { x1: 40, y1: y, x2: 620, y2: y, stroke: "#1c2027", "stroke-width": 1 }));
    const t = svgEl("text", { x: 30, y: y + 4, "text-anchor": "end", class: "axis-text" });
    t.textContent = v.toFixed(1);
    svg.appendChild(t);
  });

  keys.forEach(key => {
    const d = AUC_DATA[key];
    const groupX = x;

    const dceH = d.dce * chartH;
    const dceBar = svgEl("rect", {
      x: groupX, y: baseY - dceH, width: barW, height: dceH, rx: 3, fill: "var(--accent-teal)"
    });
    svg.appendChild(dceBar);
    const dceLabel = svgEl("text", { x: groupX + barW / 2, y: baseY - dceH - 8, "text-anchor": "middle", class: "bar-label" });
    dceLabel.textContent = d.dce.toFixed(3);
    svg.appendChild(dceLabel);

    if (d.mp !== null) {
      const mpX = groupX + barW + 6;
      const mpH = d.mp * chartH;
      const mpBar = svgEl("rect", {
        x: mpX, y: baseY - mpH, width: barW, height: mpH, rx: 3, fill: "var(--text-faint)"
      });
      svg.appendChild(mpBar);
      const mpLabel = svgEl("text", { x: mpX + barW / 2, y: baseY - mpH - 8, "text-anchor": "middle", class: "bar-label" });
      mpLabel.setAttribute("fill", "var(--text-muted)");
      mpLabel.textContent = d.mp.toFixed(3);
      svg.appendChild(mpLabel);
    }

    const groupLabel = svgEl("text", {
      x: groupX + barW, y: baseY + 20, "text-anchor": "middle", class: "axis-text"
    });
    groupLabel.textContent = d.label;
    svg.appendChild(groupLabel);

    x += barW * 2 + groupGap;
  });

  // legend
  const legendY = 20;
  svg.appendChild(svgEl("rect", { x: 420, y: legendY - 10, width: 10, height: 10, fill: "var(--accent-teal)" }));
  const l1 = svgEl("text", { x: 435, y: legendY, class: "axis-text" });
  l1.textContent = "DCE-MRI";
  svg.appendChild(l1);
  svg.appendChild(svgEl("rect", { x: 510, y: legendY - 10, width: 10, height: 10, fill: "var(--text-faint)" }));
  const l2 = svgEl("text", { x: 525, y: legendY, class: "axis-text" });
  l2.textContent = "MammaPrint";
  svg.appendChild(l2);
}

function buildAucToggles() {
  const mount = document.getElementById("auc-toggles");
  mount.innerHTML = "";
  Object.keys(AUC_DATA).forEach(key => {
    const btn = document.createElement("button");
    btn.className = "auc-toggle" + (activeSubtypes.has(key) ? " active" : "");
    btn.innerHTML = `<span class="swatch" style="background:var(--accent-teal)"></span>${AUC_DATA[key].label}`;
    btn.addEventListener("click", () => {
      if (activeSubtypes.has(key)) {
        if (activeSubtypes.size > 1) activeSubtypes.delete(key);
      } else {
        activeSubtypes.add(key);
      }
      buildAucToggles();
      renderAucChart();
    });
    mount.appendChild(btn);
  });
}

// ============================================================
// Init
// ============================================================
renderCircuitPanel("hr_her2neg");
buildAucToggles();
renderAucChart();
