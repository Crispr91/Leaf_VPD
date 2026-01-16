const $ = (s) => document.querySelector(s);

const STORAGE_KEY = "fert_blend_simple_v1"; // keep same key unless you want a fresh reset
const UNIT_TO_G = { g:1, kg:1000, oz:28.349523125, lb:453.59237 };

// Default columns (core) per your spec:
const CORE = ["N","P2O5","K2O","Ca","Mg","S","Fe","Si"];

// Remaining essential micros
const ADV  = ["Mn","Zn","Cu","B","Mo","Cl","Ni"];

function num(v){ const x = parseFloat(v); return Number.isFinite(x) ? x : 0; }
function fmt(n, d=2){ return Number.isFinite(n) ? n.toFixed(d) : "0"; }
function gramsFrom(amount, unit){ return num(amount) * (UNIT_TO_G[unit] ?? 1); }
function clampPct(x){ const v = num(x); return Math.max(0, Math.min(100, v)); }

function convertMassFromG(g, unit){
  if (unit === "g") return g;
  if (unit === "kg") return g / 1000;
  if (unit === "oz") return g / UNIT_TO_G.oz;
  if (unit === "lb") return g / UNIT_TO_G.lb;
  return g;
}

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
  return { name:"", amount:"", unit:"g", analysis, _stash:{} };
}

// Preserve hidden nutrient values when toggling columns
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

let rows = []; // fertilizers

function save(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      chkAll: $("#chkAll").checked,
      rows,
      vol: $("#inpVol").value,
      volUnit: $("#selVolUnit").value,
      massUnit: $("#selMassUnit")?.value || "g"
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
    if (typeof data.vol === "string") $("#inpVol").value = data.vol;
    if (typeof data.volUnit === "string") $("#selVolUnit").value = data.volUnit;
    if (typeof data.massUnit === "string" && $("#selMassUnit")) $("#selMassUnit").value = data.massUnit;
    return true;
  }catch(e){
    return false;
  }
}

function buildHead(nutrients){
  $("#thead").innerHTML = `
    <tr>
      <th style="min-width:180px;">Fertilizer</th>
      <th style="min-width:140px;">Amount</th>
      <th style="min-width:78px;">Unit</th>
      ${nutrients.map(n => `<th style="min-width:78px;">${escapeHtml(n)}%</th>`).join("")}
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
          type="number" min="0" max="100" step="0.01" placeholder="0"
          value="${escapeAttr(r.analysis[n])}">
      </td>
    `).join("");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input data-i="${i}" data-k="name" placeholder="e.g. Calcium nitrate" value="${escapeAttr(r.name)}"></td>
      <td><input class="num" data-i="${i}" data-k="amount" type="number" min="0" step="0.01" placeholder="0" value="${escapeAttr(r.amount)}"></td>
      <td>
        <select data-i="${i}" data-k="unit">
          ${["g","kg","oz","lb"].map(u => `<option value="${u}" ${r.unit===u?"selected":""}>${u}</option>`).join("")}
        </select>
      </td>
      ${nutrientCells}
    `;
    tbody.appendChild(tr);
  });
}

function compute(nutrients){
  const active = rows.map(r => {
    ensureRowShape(r, nutrients);
    const w = gramsFrom(r.amount, r.unit);
    const a = {};
    nutrients.forEach(n => a[n] = clampPct(r.analysis[n]));
    return { w, a };
  }).filter(x => x.w > 0);

  const totalG = active.reduce((s,x)=>s+x.w, 0);

  const totalsG = {};
  nutrients.forEach(n => totalsG[n] = 0);

  for (const row of active){
    for (const n of nutrients){
      totalsG[n] += row.w * (row.a[n] / 100);
    }
  }

  const pct = {};
  for (const n of nutrients){
    pct[n] = totalG > 0 ? (totalsG[n] / totalG) * 100 : 0;
  }
  return { totalG, totalsG, pct, activeCount: active.length };
}

function computePpm(gramsNutrient, vol, volUnit){
  const L = (volUnit === "gal") ? vol * 3.785411784 : vol;
  if (!Number.isFinite(L) || L <= 0) return 0;
  return (gramsNutrient * 1000) / L;
}

function renderResults(nutrients){
  const { totalG, totalsG, pct, activeCount } = compute(nutrients);

  // NEW: display unit for the total mass only
  const displayUnit = $("#selMassUnit")?.value || "g";
  const totalDisplay = convertMassFromG(totalG, displayUnit);
  $("#kpiTotal").textContent = `${fmt(totalDisplay,2)} ${displayUnit}`;

  if (totalG <= 0){
    $("#outPct").textContent = "—";
    $("#outG").textContent = "—";
    $("#outPpm").textContent = "Enter a volume to see ppm.";
    $("#status").innerHTML = `<span class="bad"><b>No mass entered yet.</b></span> Add amounts to compute.`;
    return;
  }

  $("#outPct").textContent = nutrients.map(n => `${n}: ${fmt(pct[n], 3)}%`).join("\n");
  $("#outG").textContent   = nutrients.map(n => `${n}: ${fmt(totalsG[n], 4)} g`).join("\n");

  const vol = num($("#inpVol").value);
  const volUnit = $("#selVolUnit").value;
  if (vol > 0){
    $("#outPpm").textContent = nutrients.map(n => `${n}: ${fmt(computePpm(totalsG[n], vol, volUnit), 1)} ppm`).join("\n");
  } else {
    $("#outPpm").textContent = "Enter a volume to see ppm.";
  }

  $("#status").innerHTML = `<span class="good"><b>Computed.</b></span> Using ${activeCount} row(s) with nonzero amount.`;
}

function autoAddRowIfNeeded(nutrients){
  const last = rows[rows.length - 1];
  if (!last) return;
  ensureRowShape(last, nutrients);

  const hasSomething =
    (String(last.name || "").trim().length > 0) ||
    (num(last.amount) > 0) ||
    nutrients.some(n => String(last.analysis[n] ?? "").trim().length > 0);

  if (hasSomething){
    rows.push(makeRow(nutrients));
  }
}

function renderAll(){
  const nutrients = getNutrients();

  if (rows.length === 0) {
    rows = [makeRow(nutrients), makeRow(nutrients), makeRow(nutrients)];
  }

  rows = rows.map(r => ensureRowShape(r, nutrients));

  buildHead(nutrients);
  buildBody(nutrients);
  renderResults(nutrients);
  save();
}

// ---- Events ----
document.addEventListener("input", (e) => {
  const el = e.target;
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

    if (idx === rows.length - 1){
      autoAddRowIfNeeded(nutrients);
    }

    renderAll();
    return;
  }

  if (el.id === "inpVol"){
    renderAll();
    return;
  }
});

document.addEventListener("change", (e) => {
  const el = e.target;

  if (el.id === "chkAll"){
    renderAll();
    return;
  }
  if (el.id === "selVolUnit"){
    renderAll();
    return;
  }
  if (el.id === "selMassUnit"){
    // Only the display changes, but easiest is re-render
    renderAll();
    return;
  }

  const i = el.getAttribute("data-i");
  const k = el.getAttribute("data-k");
  if (i !== null && k){
    const idx = Number(i);
    if (!rows[idx]) return;
    rows[idx][k] = el.value;
    renderAll();
  }
});

$("#btnAddRow").addEventListener("click", () => {
  rows.push(makeRow(getNutrients()));
  renderAll();
});

$("#btnExample").addEventListener("click", () => {
  $("#chkAll").checked = true;
  const nutrients = getNutrients();

  rows = [
    makeRow(nutrients),
    makeRow(nutrients),
    makeRow(nutrients),
  ];

  rows[0].name = "Calcium Nitrate";
  rows[0].amount = "10";
  rows[0].unit = "g";
  rows[0].analysis.N = "15.5";
  rows[0].analysis.Ca = "19";

  rows[1].name = "MKP";
  rows[1].amount = "5";
  rows[1].unit = "g";
  rows[1].analysis.P2O5 = "52";
  rows[1].analysis.K2O = "34";

  rows[2].name = "Potassium Silicate (example)";
  rows[2].amount = "2";
  rows[2].unit = "g";
  rows[2].analysis.Si = "20";

  $("#inpVol").value = "1";
  $("#selVolUnit").value = "gal";

  rows.push(makeRow(nutrients));
  renderAll();
});

$("#btnReset").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  $("#chkAll").checked = false;
  $("#inpVol").value = "";
  $("#selVolUnit").value = "gal";
  $("#selMassUnit").value = "g";
  rows = [];
  renderAll();
});

// ---- Init ----
const hadSaved = load();
if (!hadSaved){
  $("#chkAll").checked = false;
  $("#selMassUnit").value = "g";
  rows = [];
}
renderAll();
