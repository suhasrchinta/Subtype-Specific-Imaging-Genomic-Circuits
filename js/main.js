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

const TIMEPOINTS = ["T0", "T1", "T2", "T3"];

// ============================================================
// Stage builders. Each returns a function update(step) that
// mutates the already-built DOM in place, so switching steps
// does not rebuild the whole stage (keeps the slider state etc).
// ============================================================

function buildImageStage(stage, meta) {
  stage.innerHTML = `<span class="stage-label">Real DCE-MRI, patient ${meta.patientId}</span>`;

  const wrap = document.createElement("div");
  wrap.className = "compare-wrap";
  const beforeImg = document.createElement("img");
  const afterImg = document.createElement("img");
  afterImg.className = "compare-after";
  const handle = document.createElement("div");
  handle.className = "compare-handle";
  wrap.appendChild(beforeImg);
  wrap.appendChild(afterImg);
  wrap.appendChild(handle);
  stage.appendChild(wrap);

  const labels = document.createElement("div");
  labels.className = "compare-labels";
  labels.innerHTML = `<span id="lbl-before">T0</span><span id="lbl-after">T3</span>`;
  stage.appendChild(labels);

  const caption = document.createElement("div");
  caption.className = "compare-caption";
  caption.textContent = "Drag to compare timepoints. Tumor segmentation outlined in red.";
  stage.appendChild(caption);

  const readout = document.createElement("div");
  readout.className = "stage-signal-readout";
  TIMEPOINTS.forEach((tp, i) => {
    const item = document.createElement("div");
    item.className = "readout-item";
    item.innerHTML = `<span class="readout-tp">${tp}</span><span class="readout-val" data-tp-idx="${i}">${meta.signalTrend[i]}</span>`;
    readout.appendChild(item);
  });
  stage.appendChild(readout);

  function imgPath(tp) { return `assets/images/${meta.patientId}/${tp}_overlay.png`; }

  let beforeIdx = 0, afterIdx = 3;
  function refresh() {
    beforeImg.src = imgPath(TIMEPOINTS[beforeIdx]);
    afterImg.src = imgPath(TIMEPOINTS[afterIdx]);
    labels.querySelector("#lbl-before").textContent = TIMEPOINTS[beforeIdx];
    labels.querySelector("#lbl-after").textContent = TIMEPOINTS[afterIdx];
    readout.querySelectorAll(".readout-val").forEach(el => {
      el.classList.toggle("readout-current", parseInt(el.dataset.tpIdx) === afterIdx);
    });
  }
  refresh();

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

  // step 0: show T0 vs T3 default. step 1: animate afterIdx forward to emphasize decline.
  return function update(step) {
    if (step === 0) {
      beforeIdx = 0; afterIdx = 3;
      refresh();
      setSplit(wrap.getBoundingClientRect().left + wrap.getBoundingClientRect().width / 2);
    } else if (step === 1) {
      beforeIdx = 0; afterIdx = 3;
      refresh();
    }
  };
}

function buildScatterStage(stage, meta, data, key) {
  stage.innerHTML = `<span class="stage-label">Real gene correlation</span>`;
  const mount = document.createElement("div");
  mount.className = "scatter-wrap";
  stage.appendChild(mount);

  function render(geneKey, geneLabel) {
    mount.innerHTML = "";
    const xs = data.points.map(p => p.x);
    const ys = data.points.map(p => p[geneKey]);
    const pcr = data.points.map(p => p.pCR);

    const W = 420, H = 300, M = 46;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}` });
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xScale = (v) => M + ((v - xMin) / (xMax - xMin || 1)) * (W - M - 20);
    const yScale = (v) => H - M - ((v - yMin) / (yMax - yMin || 1)) * (H - M - 20);

    svg.appendChild(svgEl("line", { x1: M, y1: H - M, x2: W - 20, y2: H - M, class: "scatter-axis" }));
    svg.appendChild(svgEl("line", { x1: M, y1: 20, x2: M, y2: H - M, class: "scatter-axis" }));

    const xLabel = svgEl("text", { x: W / 2, y: H - 6, "text-anchor": "middle", class: "scatter-axis-label" });
    xLabel.textContent = data.imaging_label;
    svg.appendChild(xLabel);

    const yLabel = svgEl("text", {
      x: 14, y: H / 2, "text-anchor": "middle", class: "scatter-axis-label",
      transform: `rotate(-90, 14, ${H / 2})`
    });
    yLabel.textContent = geneLabel + " expression";
    svg.appendChild(yLabel);

    xs.forEach((x, i) => {
      svg.appendChild(svgEl("circle", {
        cx: xScale(x), cy: yScale(ys[i]), r: 3,
        class: pcr[i] ? "scatter-point-pcr" : "scatter-point-nopcr",
        opacity: 0.85
      }));
    });

    const r = pearson(xs, ys);
    const stat = svgEl("text", { x: W - 24, y: 30, "text-anchor": "end", class: "scatter-stat-line", fill: "var(--flag)" });
    stat.textContent = `r = ${r.toFixed(3)}  (n=${xs.length})`;
    svg.appendChild(stat);

    mount.appendChild(svg);

    const legend = document.createElement("div");
    legend.className = "scatter-legend";
    legend.innerHTML = `
      <span><span class="legend-dot" style="background: var(--flag)"></span>pCR</span>
      <span><span class="legend-dot" style="background: var(--ink-faint)"></span>Non-pCR</span>
    `;
    mount.appendChild(legend);
  }

  if (key === "hr_her2neg") render("y", meta.geneNode);
  else if (key === "her2pos") render("erbb2", "ERBB2");
  else if (key === "tnbc") render("flt1", "FLT1");

  return function update(step) {}; // static once built
}

function buildCircuitDiagramStage(stage, meta) {
  stage.innerHTML = `<span class="stage-label">Imaging to gene to pathway</span>`;
  const mount = document.createElement("div");
  mount.className = "circuit-diagram-wrap";

  function makeBox(label, sublabel) {
    const box = document.createElement("div");
    box.className = "circuit-box";
    box.innerHTML = `<div class="box-label">${label}</div><div class="box-sublabel">${sublabel}</div>`;
    return box;
  }
  function makeArrow() {
    const a = document.createElement("div");
    a.className = "circuit-arrow";
    a.textContent = "\u2192";
    return a;
  }

  const boxImaging = makeBox(meta.imagingNode, "Imaging feature");
  const arrow1 = makeArrow();
  const boxGene = makeBox(meta.geneNode, "Gene(s)");
  const arrow2 = makeArrow();
  const boxPathway = makeBox(meta.pathwayNode, "Pathway (GSEA)");

  mount.appendChild(boxImaging);
  mount.appendChild(arrow1);
  mount.appendChild(boxGene);
  mount.appendChild(arrow2);
  mount.appendChild(boxPathway);
  stage.appendChild(mount);

  const nesLine = document.createElement("div");
  nesLine.className = "circuit-nes-callout";
  nesLine.textContent = meta.nes;
  stage.appendChild(nesLine);

  return function update(step) {
    boxGene.classList.remove("active-node");
    boxPathway.classList.remove("active-node");
    arrow1.classList.remove("arrow-active");
    arrow2.classList.remove("arrow-active");
    if (step >= 2) {
      boxGene.classList.add("active-node");
      arrow1.classList.add("arrow-active");
    }
    if (step >= 3) {
      boxPathway.classList.add("active-node");
      arrow2.classList.add("arrow-active");
    }
  };
}

// ============================================================
// Model pipeline stage: raw scan -> extracted feature ->
// Random Forest (simulated forest of trees) -> prediction.
// CNN-Explainer-style walk through the actual ML pipeline.
// ============================================================
function treeIconSVG(active) {
  return `<svg width="22" height="26" viewBox="0 0 22 26" class="tree-icon${active ? ' tree-voting' : ''}">
    <polygon class="tree-canopy" points="11,2 20,16 2,16" fill="${active ? '' : '#EDEBE3'}" stroke="${active ? '' : '#B8B4A6'}" stroke-width="1.3"/>
    <rect class="tree-trunk" x="9.5" y="16" width="3" height="8" fill="${active ? 'var(--data-blue)' : '#B8B4A6'}" stroke="none"/>
  </svg>`;
}

function buildModelPipelineStage(stage, meta) {
  stage.innerHTML = `<span class="stage-label">From scan to prediction</span>`;
  const pipeline = document.createElement("div");
  pipeline.className = "model-pipeline";

  // Row 1: scan thumbnail -> extracted feature value
  const row1 = document.createElement("div");
  row1.className = "pipeline-row";

  const scanNode = document.createElement("div");
  scanNode.className = "pipeline-node";
  scanNode.innerHTML = `<div class="pn-title">Raw scan (T0)</div>`;
  const scanImg = document.createElement("img");
  scanImg.src = `assets/images/${meta.patientId}/T0_overlay.png`;
  scanNode.appendChild(scanImg);
  row1.appendChild(scanNode);

  const track1 = document.createElement("div");
  track1.className = "pipeline-flow-track";
  const dot1 = document.createElement("div");
  dot1.className = "pipeline-dot";
  track1.appendChild(dot1);
  row1.appendChild(track1);

  const featureNode = document.createElement("div");
  featureNode.className = "pipeline-node";
  featureNode.innerHTML = `
    <div class="pn-title">Extracted feature</div>
    <div class="pn-value">${meta.extractedFeatureLabel}</div>
    <div class="pn-value" style="margin-top:0.2rem;color:var(--flag)">${meta.extractedFeatureValue}</div>
  `;
  row1.appendChild(featureNode);

  pipeline.appendChild(row1);

  // Row 2: feature vector -> RF (forest) -> prediction
  const row2 = document.createElement("div");
  row2.className = "pipeline-row";
  row2.style.marginTop = "0.3rem";

  const arrow2 = document.createElement("div");
  arrow2.className = "pipeline-arrow";
  arrow2.textContent = "\u2193";
  arrow2.style.margin = "0 auto";
  const arrowWrap = document.createElement("div");
  arrowWrap.style.textAlign = "center";
  arrowWrap.style.width = "100%";
  arrowWrap.appendChild(arrow2);
  pipeline.appendChild(arrowWrap);

  const rfNode = document.createElement("div");
  rfNode.className = "pipeline-node";
  rfNode.style.flex = "1";
  const forestRow = document.createElement("div");
  forestRow.className = "forest-row";
  for (let i = 0; i < 7; i++) {
    const treeWrap = document.createElement("div");
    treeWrap.className = "tree-slot";
    treeWrap.innerHTML = treeIconSVG(false);
    forestRow.appendChild(treeWrap);
  }
  rfNode.innerHTML = `<div class="pn-title">Random Forest, 500 trees (7 shown)</div>`;
  rfNode.appendChild(forestRow);
  const rfSub = document.createElement("div");
  rfSub.className = "pn-value";
  rfSub.style.fontSize = "0.72rem";
  rfSub.style.color = "var(--ink-muted)";
  rfSub.textContent = "Each tree votes on the full 28-feature panel; majority vote decides.";
  rfNode.appendChild(rfSub);

  const row3 = document.createElement("div");
  row3.className = "pipeline-row";
  row3.style.marginTop = "0.6rem";
  row3.appendChild(rfNode);

  const track2 = document.createElement("div");
  track2.className = "pipeline-flow-track";
  const dot2 = document.createElement("div");
  dot2.className = "pipeline-dot";
  track2.appendChild(dot2);
  row3.appendChild(track2);

  const outputNode = document.createElement("div");
  outputNode.className = "pipeline-node";
  outputNode.innerHTML = `
    <div class="pn-title">Model output</div>
    <div class="pn-value" style="font-size:1.1rem;color:var(--flag)">AUC = ${meta.subtypeAUC.toFixed(3)}</div>
    <div class="pn-value" style="font-size:0.7rem;color:var(--ink-muted);margin-top:0.2rem">This subtype, 5-fold CV</div>
  `;
  row3.appendChild(outputNode);

  pipeline.appendChild(row3);
  stage.appendChild(pipeline);

  const trees = forestRow.querySelectorAll(".tree-slot");

  return function update(step) {
    dot1.classList.remove("dot-run");
    dot2.classList.remove("dot-run");
    scanNode.classList.remove("pipeline-active");
    featureNode.classList.remove("pipeline-active");
    rfNode.classList.remove("pipeline-active");
    outputNode.classList.remove("pipeline-active");
    trees.forEach(t => t.innerHTML = treeIconSVG(false));

    if (step >= 6) {
      scanNode.classList.add("pipeline-active");
      featureNode.classList.add("pipeline-active");
      dot1.classList.add("dot-run");
    }
    if (step >= 7) {
      rfNode.classList.add("pipeline-active");
      dot2.classList.add("dot-run");
      trees.forEach(t => t.innerHTML = treeIconSVG(true));
    }
    if (step >= 7) {
      outputNode.classList.add("pipeline-active");
    }
  };
}

function buildMediationStage(stage, meta) {
  stage.innerHTML = `<span class="stage-label">Mediation and replication</span>`;

  const calloutMediation = document.createElement("div");
  calloutMediation.className = "stat-callout";
  calloutMediation.textContent = meta.mediation;
  stage.appendChild(calloutMediation);

  const repGrid = document.createElement("div");
  repGrid.className = "replication-grid";
  meta.replicationCohorts.forEach(c => {
    const cell = document.createElement("div");
    cell.className = "rep-cell" + (c.sig ? " rep-sig" : "");
    cell.innerHTML = `<span class="rep-cohort">${c.cohort}</span><span class="rep-p">p=${c.p}</span>`;
    repGrid.appendChild(cell);
  });
  stage.appendChild(repGrid);

  const calloutRep = document.createElement("div");
  calloutRep.className = "stat-callout callout-neutral";
  calloutRep.style.marginTop = "0.6rem";
  calloutRep.textContent = meta.replication;
  stage.appendChild(calloutRep);

  return function update(step) {
    calloutMediation.style.display = step >= 4 ? "block" : "none";
    repGrid.style.display = step >= 5 ? "grid" : "none";
    calloutRep.style.display = step >= 5 ? "block" : "none";
  };
}

// ============================================================
// Build one full stage per circuit: a stack of the 4 stage
// blocks (image, scatter, diagram, mediation), each shown or
// hidden depending on which step range is active.
// ============================================================
function initScrollySection(sectionEl) {
  const key = sectionEl.dataset.circuit;
  const meta = CIRCUIT_META[key];
  const data = CIRCUIT_DATA[key];
  const stageRoot = sectionEl.querySelector(".scrolly-stage");

  const imageBlock = document.createElement("div");
  const diagramBlock = document.createElement("div");
  diagramBlock.style.marginTop = "1.4rem";
  const scatterBlock = document.createElement("div");
  scatterBlock.style.marginTop = "1.4rem";
  const mediationBlock = document.createElement("div");
  mediationBlock.style.marginTop = "1.4rem";
  const modelBlock = document.createElement("div");
  modelBlock.style.marginTop = "1.4rem";

  stageRoot.appendChild(imageBlock);
  stageRoot.appendChild(diagramBlock);
  stageRoot.appendChild(scatterBlock);
  stageRoot.appendChild(mediationBlock);
  stageRoot.appendChild(modelBlock);

  const updateImage = buildImageStage(imageBlock, meta);
  const updateDiagram = buildCircuitDiagramStage(diagramBlock, meta);
  const updateScatter = buildScatterStage(scatterBlock, meta, data, key);
  const updateMediation = buildMediationStage(mediationBlock, meta);
  const updateModel = buildModelPipelineStage(modelBlock, meta);

  diagramBlock.style.display = "none";
  scatterBlock.style.display = "none";
  mediationBlock.style.display = "none";
  modelBlock.style.display = "none";

  function setStep(step) {
    updateImage(step);
    updateDiagram(step);
    updateScatter(step);
    updateMediation(step);
    updateModel(step);

    diagramBlock.style.display = step >= 3 ? "block" : "none";
    scatterBlock.style.display = step >= 2 ? "block" : "none";
    mediationBlock.style.display = step >= 4 ? "block" : "none";
    modelBlock.style.display = step >= 6 ? "block" : "none";
  }

  setStep(0);

  const steps = sectionEl.querySelectorAll(".scrolly-step");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        steps.forEach(s => s.classList.remove("step-active"));
        entry.target.classList.add("step-active");
        setStep(parseInt(entry.target.dataset.step));
      }
    });
  }, { rootMargin: "-40% 0px -50% 0px", threshold: 0 });

  steps.forEach(s => observer.observe(s));
}

document.querySelectorAll(".scrolly-section").forEach(initScrollySection);

// ============================================================
// AUC comparison chart
// ============================================================
let activeSubtypes = new Set(["pooled", "hr_her2neg", "her2pos", "tnbc"]);

function renderAucChart() {
  const svg = document.getElementById("auc-chart");
  svg.innerHTML = "";
  const keys = Array.from(activeSubtypes);
  const barW = 46, groupGap = 50;
  const chartH = 260, baseY = 300;
  let x = 60;

  svg.appendChild(svgEl("line", { x1: 40, y1: baseY, x2: 620, y2: baseY, class: "scatter-axis" }));

  [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach(v => {
    const y = baseY - v * chartH;
    svg.appendChild(svgEl("line", { x1: 40, y1: y, x2: 620, y2: y, stroke: "#E4E1D6", "stroke-width": 1 }));
    const t = svgEl("text", { x: 30, y: y + 4, "text-anchor": "end", class: "axis-text" });
    t.textContent = v.toFixed(1);
    svg.appendChild(t);
  });

  keys.forEach(key => {
    const d = AUC_DATA[key];
    const groupX = x;
    const dceH = d.dce * chartH;
    svg.appendChild(svgEl("rect", { x: groupX, y: baseY - dceH, width: barW, height: dceH, fill: "var(--flag)" }));
    const dceLabel = svgEl("text", { x: groupX + barW / 2, y: baseY - dceH - 8, "text-anchor": "middle", class: "bar-label" });
    dceLabel.textContent = d.dce.toFixed(3);
    svg.appendChild(dceLabel);

    if (d.mp !== null) {
      const mpX = groupX + barW + 6;
      const mpH = d.mp * chartH;
      svg.appendChild(svgEl("rect", { x: mpX, y: baseY - mpH, width: barW, height: mpH, fill: "#B8B4A6" }));
      const mpLabel = svgEl("text", { x: mpX + barW / 2, y: baseY - mpH - 8, "text-anchor": "middle", class: "bar-label" });
      mpLabel.setAttribute("fill", "var(--ink-muted)");
      mpLabel.textContent = d.mp.toFixed(3);
      svg.appendChild(mpLabel);
    }

    const groupLabel = svgEl("text", { x: groupX + barW, y: baseY + 20, "text-anchor": "middle", class: "axis-text" });
    groupLabel.textContent = d.label;
    svg.appendChild(groupLabel);

    x += barW * 2 + groupGap;
  });

  svg.appendChild(svgEl("rect", { x: 420, y: 10, width: 10, height: 10, fill: "var(--flag)" }));
  const l1 = svgEl("text", { x: 435, y: 20, class: "axis-text" });
  l1.textContent = "DCE-MRI";
  svg.appendChild(l1);
  svg.appendChild(svgEl("rect", { x: 510, y: 10, width: 10, height: 10, fill: "#B8B4A6" }));
  const l2 = svgEl("text", { x: 525, y: 20, class: "axis-text" });
  l2.textContent = "MammaPrint";
  svg.appendChild(l2);
}

function buildAucToggles() {
  const mount = document.getElementById("auc-toggles");
  mount.innerHTML = "";
  Object.keys(AUC_DATA).forEach(key => {
    const btn = document.createElement("button");
    btn.className = "auc-toggle" + (activeSubtypes.has(key) ? " active" : "");
    btn.innerHTML = `<span class="swatch" style="background:var(--flag)"></span>${AUC_DATA[key].label}`;
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

buildAucToggles();
renderAucChart();
