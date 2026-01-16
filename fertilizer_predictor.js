document.addEventListener("DOMContentLoaded", () => {
  const $ = (s) => document.querySelector(s);

  const STORAGE_KEY = "fert_solver_v1";
  const UNIT_TO_G = { g:1, kg:1000, oz:28.349523125, lb:453.59237 };

  const CORE = ["N","P2O5","K2O","Ca","Mg","S","Fe","Si"];
  const ADV  = ["Mn","Zn","Cu","B","Mo","Cl","Ni"];

  function num(v){ const x = parseFloat(v); return Number.isFinite(x) ? x : NaN; }
  function num0(v){ const x = parseFloat(v); return Number.isFinite(x) ? x : 0; }
  function clampPct(x){ const v = num0(x); return Math.max(0, Math.min(100, v)); }
  function gramsFrom(amount, unit){ return num0(amount) * (UNIT_TO_G[unit] ?? 1); }

  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;")
      .replaceAll(">","&gt;").replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  function escapeAttr(s){ return escapeHtml(s).replaceAll("\n"," "); }

  function getNutrients(){
    return $("#chkAll").checked ? [...CORE, ...ADV] : [...CORE];
  }

  function makeRow(nutrients){
    const analysis = {};
    nutrients.forEach(k => analysis[k] = "");
    return { name:"", analysis, _stash:{} };
  }

  function ensureRowShape(row, nutrients){
    if (!row.analysis || typeof row.analysis !== "object") row.analysis = {};
    if (!row._stash || typeof row._stash !== "object") row._stash = {};

    for (const k of Object.keys(row.analysis)){
      if (!nutrients.includes(k)){
        row._stash[k] = row.analysis[k];
        delete row.analysis[k];
      }
    }
    nutrients.forEach(k => {
      if (!(k in row.analysis)){
        if (k in row._stash){
          row.analysis[k] = row._stash[k];
          delete row._stash[k];
        } else {
          row.analysis[k] = "";
        }
      }
    });
    return row;
  }

  let rows = [];
  let target = {};

  function buildTargetUI(nutrients){
    const grid = $("#targetGrid");
    grid.innerHTML = "";
    nutrients.forEach(n => {
      const div = document.createElement("div");
      div.className = "targetCell";
      div.innerHTML = `
        <div class="tLbl">${escapeHtml(n)} target (%)</div>
        <input class="num" data-t="${escapeAttr(n)}" type="number"
               min="0" max="100" step="0.001"
               placeholder="(ignore)"
               value="${escapeAttr(target[n] ?? "")}">
      `;
      grid.appendChild(div);
    });
  }

  function buildHead(nutrients){
    $("#thead").innerHTML = `
      <tr>
        <th style="min-width:240px;">Fertilizer</th>
        ${nutrients.map(n => `<th style="min-width:86px;">${escapeHtml(n)}%</th>`).join("")}
      </tr>
    `;
  }

  function buildBody(nutrients){
    const tbody = $("#tbody");
    tbody.innerHTML = "";

    rows.forEach((r, i) => {
      ensureRowShape(r, nutrients);

      const nutrientCells = nutrients.map(n => `
        <td>
          <input class="num" data-i="${i}" data-k="analysis.${escapeAttr(n)}"
                 type="number" min="0" max="100" step="0.01"
                 placeholder="0"
                 value="${escapeAttr(r.analysis[n])}">
        </td>
      `).join("");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input data-i="${i}" data-k="name"
                   placeholder="e.g. Calcium nitrate"
                   value="${escapeAttr(r.name)}"></td>
        ${nutrientCells}
      `;
      tbody.appendChild(tr);
    });
  }

  // ---------------- Solver ----------------
  function solveBlend(nutrients){
    const M = gramsFrom($("#inpTotal").value, $("#selTotalUnit").value);
    if (!(M > 0)) return { ok:false, msg:"Enter a total blend mass > 0." };

    const constrained = nutrients.filter(n => Number.isFinite(num(target[n])));
    if (constrained.length === 0) return { ok:false, msg:"Set at least one target nutrient (e.g., N, P2O5, K2O)." };
    if (rows.length === 0) return { ok:false, msg:"Add at least one fertilizer row." };

    const activeIdx = [];
    for (let i=0;i<rows.length;i++){
      let has = false;
      for (const n of constrained){
        if (clampPct(rows[i].analysis[n]) > 0){ has = true; break; }
      }
      if (has) activeIdx.push(i);
    }
    if (activeIdx.length === 0) return { ok:false, msg:"None of your fertilizers contain the nutrients you targeted." };

    const mm = activeIdx.length;
    const k = constrained.length;

    const A = Array.from({length:k}, ()=>Array(mm).fill(0));
    const b = Array(k).fill(0);

    for (let j=0;j<k;j++){
      const n = constrained[j];
      const t = clampPct(target[n]);
      b[j] = (t/100) * M;
      for (let col=0; col<mm; col++){
        const i = activeIdx[col];
        A[j][col] = clampPct(rows[i].analysis[n]) / 100;
      }
    }

    const useReg = $("#chkRegularize").checked;
    const lambdaMass = 1.0;
    const lambdaReg  = useReg ? 1e-6 : 0;

    const ATA = Array.from({length:mm}, ()=>Array(mm).fill(0));
    const ATb = Array(mm).fill(0);

    for (let i=0;i<mm;i++){
      for (let j=0;j<mm;j++){
        let s = 0;
        for (let r=0;r<k;r++) s += A[r][i]*A[r][j];
        ATA[i][j] = s;
      }
      let sb = 0;
      for (let r=0;r<k;r++) sb += A[r][i]*b[r];
      ATb[i] = sb;
    }

    for (let i=0;i<mm;i++){
      for (let j=0;j<mm;j++){
        ATA[i][j] += lambdaMass; // 11^T
      }
      ATA[i][i] += lambdaReg;
      ATb[i] += lambdaMass * M;
    }

    function matVec(Mm, v){
      const out = Array(Mm.length).fill(0);
      for (let i=0;i<Mm.length;i++){
        let s=0;
        const row = Mm[i];
        for (let j=0;j<v.length;j++) s += row[j]*v[j];
        out[i]=s;
      }
      return out;
    }

    let x = Array(mm).fill(M/mm);
    const diagMax = Math.max(...ATA.map((row,i)=>row[i]));
    const alpha = diagMax > 0 ? 1/(diagMax*2) : 1e-3;

    const maxIter = 4000;
    const tol = 1e-7;

    for (let it=0; it<maxIter; it++){
      const g = matVec(ATA, x).map((v,i)=>v - ATb[i]);
      let maxChange = 0;
      for (let i=0;i<mm;i++){
        const xi = x[i];
        const xn = xi - alpha*g[i];
        const xp = xn < 0 ? 0 : xn;
        x[i] = xp;
        maxChange = Math.max(maxChange, Math.abs(xp - xi));
      }
      if (maxChange < tol) break;
    }

    const amounts = Array(rows.length).fill(0);
    for (let col=0; col<mm; col++){
      amounts[activeIdx[col]] = x[col];
    }

    const sumX = amounts.reduce((s,v)=>s+v,0);
    if (!(sumX > 0)) return { ok:false, msg:"Solver returned zero mass. Check inputs." };

    const gramsN = {};
    nutrients.forEach(n => gramsN[n] = 0);

    for (let i=0;i<rows.length;i++){
      for (const n of nutrients){
        gramsN[n] += amounts[i] * (clampPct(rows[i].analysis[n]) / 100);
      }
    }

    const achievedPct = {};
    nutrients.forEach(n => achievedPct[n] = (gramsN[n]/sumX)*100);

    let rmse = 0;
    let mae = 0;
    const errors = {};
    for (const n of constrained){
      const t = clampPct(target[n]);
      const a = achievedPct[n] ?? 0;
      const err = a - t; // percentage points
      errors[n] = err;
      rmse += err*err;
      mae += Math.abs(err);
    }
    rmse = Math.sqrt(rmse / constrained.length);
    mae  = mae / constrained.length;

    const massErr = sumX - M;

    return { ok:true, M, sumX, amounts, achievedPct, constrained, rmse, mae, massErr, errors };
  }

  // ---------------- Persistence ----------------
  function save(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        chkAll: $("#chkAll").checked,
        rows,
        target,
        total: $("#inpTotal").value,
        totalUnit: $("#selTotalUnit").value,
        regularize: $("#chkRegularize").checked
      }));
    }catch(e){}
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (typeof data.chkAll === "boolean") $("#chkAll").checked = data.chkAll;
      if (Array.isArray(data.rows)) rows = data.rows;
      if (data.target && typeof data.target === "object") target = data.target;
      if (typeof data.total === "string") $("#inpTotal").value = data.total;
      if (typeof data.totalUnit === "string") $("#selTotalUnit").value = data.totalUnit;
      if (typeof data.regularize === "boolean") $("#chkRegularize").checked = data.regularize;
      return true;
    }catch(e){
      return false;
    }
  }

  // ---------------- Friendly output helpers ----------------
  function setPill(kind, text){
    const pill = $("#pillStatus");
    pill.classList.remove("pillGood","pillOk","pillBad");
    if (kind === "good") pill.classList.add("pillGood");
    if (kind === "ok") pill.classList.add("pillOk");
    if (kind === "bad") pill.classList.add("pillBad");
    pill.textContent = text;
  }

  function formatSolution(res){
    const lines = [];
    for (let i=0;i<rows.length;i++){
      const g = res.amounts[i];
      if (g > 1e-6){
        const name = (rows[i].name || `Fertilizer ${i+1}`).trim();
        lines.push(`${name}: ${g.toFixed(3)} g`);
      }
    }
    return lines.length ? lines.join("\n") : "No nonzero amounts found.";
  }

  function formatAchieved(res, nutrients){
    const lines = [];
    lines.push("Target → Result (points high/low)");
    for (const n of res.constrained){
      const t = clampPct(target[n]);
      const a = res.achievedPct[n] ?? 0;
      const err = a - t;
      const dir = err >= 0 ? "high" : "low";
      lines.push(`${n}: ${t.toFixed(2)}% → ${a.toFixed(2)}%  (${Math.abs(err).toFixed(2)} points ${dir})`);
    }

    // also show any other nonzero nutrients (unconstrained) for context
    const extras = nutrients.filter(n => !res.constrained.includes(n))
      .filter(n => (res.achievedPct[n] ?? 0) > 1e-6);

    if (extras.length){
      lines.push("");
      lines.push("Other nutrients present (not targeted):");
      for (const n of extras){
        lines.push(`${n}: ${(res.achievedPct[n] ?? 0).toFixed(3)}%`);
      }
    }
    return lines.join("\n");
  }

  function formatFit(res){
    const lines = [];
    lines.push(`Blend check: target ${res.M.toFixed(1)} g, result ${res.sumX.toFixed(1)} g (${res.massErr>=0?"+":""}${res.massErr.toFixed(1)} g)`);
    lines.push("");
    lines.push(`Average miss: ${res.mae.toFixed(2)} points`);
    return lines.join("\n");
  }

  function fertRankFor(nut){
    const arr = rows.map((r, i) => ({
      i,
      name: (r.name || `Fertilizer ${i+1}`).trim(),
      pct: clampPct(r.analysis[nut]),
      usedG: 0
    }));
    arr.sort((a,b)=>b.pct - a.pct);
    return arr;
  }

  function buildTightenSuggestions(res){
    const lines = [];
    lines.push("Suggestions to tighten the fit:");

    const worst = [...res.constrained]
      .map(n => ({ n, err: res.errors[n] }))
      .sort((a,b)=>Math.abs(b.err)-Math.abs(a.err))
      .slice(0, 3);

    for (const w of worst){
      const nut = w.n;
      const err = w.err;

      const ranked = fertRankFor(nut);
      const top = ranked.filter(x => x.pct > 0).slice(0, 2);

      if (top.length === 0){
        lines.push(`• ${nut}: none of your listed fertilizers contain ${nut}. Add a ${nut} source or remove this target.`);
        continue;
      }

      if (err < -0.15){
        lines.push(`• ${nut} is low by ${Math.abs(err).toFixed(2)} points. Add/increase a stronger ${nut} source (best listed: ${top.map(x=>`${x.name} ${x.pct}%`).join(", ")}).`);
        if (top[0].pct < 10){
          lines.push(`  ↳ Bottleneck: your strongest ${nut} source is only ${top[0].pct}%. That often makes a tight target impossible.`);
        }
      } else if (err > 0.15){
        // find biggest contributors among used fertilizers
        const contributors = rows
          .map((r,i)=>({
            name:(r.name || `Fertilizer ${i+1}`).trim(),
            pct: clampPct(r.analysis[nut]),
            usedG: res.amounts[i] || 0,
            gramsNut: (res.amounts[i] || 0) * (clampPct(r.analysis[nut])/100)
          }))
          .filter(x => x.usedG > 1e-6 && x.pct > 0)
          .sort((a,b)=>b.gramsNut - a.gramsNut)
          .slice(0,2);

        if (contributors.length){
          lines.push(`• ${nut} is high by ${err.toFixed(2)} points. Reduce: ${contributors.map(x=>`${x.name} (~${x.usedG.toFixed(1)} g)`).join(", ")}.`);
        } else {
          lines.push(`• ${nut} is high by ${err.toFixed(2)} points. Reduce a ${nut}-rich ingredient (best listed: ${top.map(x=>`${x.name} ${x.pct}%`).join(", ")}).`);
        }
      } else {
        lines.push(`• ${nut}: already close.`);
      }
    }

    lines.push("");
    lines.push("Quick knobs:");
    lines.push("• Add a more concentrated single-purpose ingredient (especially for the biggest miss).");
    lines.push("• Constrain fewer nutrients (leave targets blank for anything you don't care about).");
    lines.push("• Add more candidate fertilizers (more options = easier fit).");
    return lines.join("\n");
  }

  function formatNotes(res){
    const notes = [];

    const massOk = Math.abs(res.massErr) <= Math.max(1e-3, 0.001 * res.M);
    notes.push(massOk ? "Mass: on target." : "Mass: slightly off (solver balances mass + targets).");

    // traffic light logic based on average miss (points)
    // Good: <=0.25 points; OK: <=1.0 points; else Not possible (with current list)
    if (res.mae <= 0.25){
      notes.push("Fit: good match with the current ingredients.");
      return notes.join("\n");
    }

    if (res.mae <= 1.0){
      notes.push("Fit: OK, but not tight. You can probably improve it.");
      notes.push("");
      notes.push(buildTightenSuggestions(res));
      return notes.join("\n");
    }

    notes.push("Fit: not tight. With the current ingredient list, this target likely isn’t achievable.");
    notes.push("");
    notes.push(buildTightenSuggestions(res));
    return notes.join("\n");
  }

  function classifyPill(res){
    if (res.mae <= 0.25) return { kind:"good", text:"Good fit" };
    if (res.mae <= 1.0) return { kind:"ok", text:"OK fit" };
    return { kind:"bad", text:"Not possible (as listed)" };
  }

  // ---------------- Render ----------------
  function renderAll(){
    const nutrients = getNutrients();

    nutrients.forEach(n => { if (!(n in target)) target[n] = ""; });

    if (rows.length === 0){
      rows = [makeRow(nutrients), makeRow(nutrients), makeRow(nutrients)];
    }
    rows = rows.map(r => ensureRowShape(r, nutrients));

    buildTargetUI(nutrients);
    buildHead(nutrients);
    buildBody(nutrients);

    $("#outSolution").textContent = "—";
    $("#outAchieved").textContent = "—";
    $("#outFit").textContent = "—";
    $("#outNotes").textContent = "—";
    $("#status").innerHTML = "";
    setPill("", "Not solved");

    save();
  }

  // ---------------- Safe binder ----------------
  function bind(id, event, fn){
    const el = $(id);
    if (!el){
      console.error("Missing element:", id);
      return;
    }
    el.addEventListener(event, fn);
  }

  // ---------------- Events ----------------
  document.addEventListener("input", (e) => {
    const el = e.target;

    if (el.hasAttribute("data-t")){
      const n = el.getAttribute("data-t");
      target[n] = el.value;
      save();
      return;
    }

    const i = el.getAttribute("data-i");
    const k = el.getAttribute("data-k");
    if (i !== null && k){
      const idx = Number(i);
      const nutrients = getNutrients();
      const r = rows[idx];
      if (!r) return;
      ensureRowShape(r, nutrients);

      if (k.startsWith("analysis.")){
        const n = k.slice("analysis.".length);
        r.analysis[n] = el.value;
      } else {
        r[k] = el.value;
      }
      save();
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.id === "chkAll"){ renderAll(); return; }
    if (el.id === "selTotalUnit" || el.id === "chkRegularize"){ save(); return; }
  });

  bind("#btnAddRow", "click", () => {
    rows.push(makeRow(getNutrients()));
    renderAll();
  });

  bind("#btnReset", "click", () => {
    localStorage.removeItem(STORAGE_KEY);
    rows = [];
    target = {};
    $("#chkAll").checked = false;
    $("#chkRegularize").checked = true;
    $("#inpTotal").value = "";
    $("#selTotalUnit").value = "g";
    renderAll();
  });

  bind("#btnExample", "click", () => {
    $("#chkAll").checked = false;
    $("#inpTotal").value = "1000";
    $("#selTotalUnit").value = "g";
    $("#chkRegularize").checked = true;

    const nutrients = getNutrients();
    rows = [makeRow(nutrients), makeRow(nutrients), makeRow(nutrients), makeRow(nutrients)];

    rows[0].name = "Calcium Nitrate";
    rows[0].analysis.N = "15.5";
    rows[0].analysis.Ca = "19";

    rows[1].name = "MKP";
    rows[1].analysis.P2O5 = "52";
    rows[1].analysis.K2O = "34";

    rows[2].name = "K2SO4 (SOP)";
    rows[2].analysis.K2O = "50";
    rows[2].analysis.S = "18";

    rows[3].name = "Urea";
    rows[3].analysis.N = "46";

    target = {};
    nutrients.forEach(n => target[n] = "");
    target.N = "3";
    target.P2O5 = "5";
    target.K2O = "3";

    renderAll();
  });

  bind("#btnSolve", "click", () => {
    const nutrients = getNutrients();
    const res = solveBlend(nutrients);

    if (!res.ok){
      $("#status").innerHTML = `<span class="bad"><b>Error:</b></span> ${escapeHtml(res.msg)}`;
      $("#outSolution").textContent = "—";
      $("#outAchieved").textContent = "—";
      $("#outFit").textContent = "—";
      $("#outNotes").textContent = "—";
      setPill("bad", "Not possible (as listed)");
      return;
    }

    const pill = classifyPill(res);
    setPill(pill.kind, pill.text);

    $("#status").innerHTML = `<span class="good"><b>Solved.</b></span> Best-fit nonnegative blend found.`;
    $("#outSolution").textContent = formatSolution(res);
    $("#outAchieved").textContent = formatAchieved(res, nutrients);
    $("#outFit").textContent = formatFit(res);
    $("#outNotes").textContent = formatNotes(res);
    save();
  });

  // ---------------- Init ----------------
  const hadSaved = load();
  if (!hadSaved){
    $("#chkAll").checked = false;
    $("#chkRegularize").checked = true;
    $("#selTotalUnit").value = "g";
  }
  renderAll();
});
