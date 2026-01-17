const tempEl  = document.getElementById("temp");
const rhEl    = document.getElementById("rh");
const stageEl = document.getElementById("stage");

const tempVal = document.getElementById("tempVal");
const rhVal   = document.getElementById("rhVal");

const meterFill = document.getElementById("meterFill");
const meterText = document.getElementById("meterText");
const ionNotes  = document.getElementById("ionNotes");

function svp(Tc){
  return 0.6108 * Math.exp((17.27 * Tc) / (Tc + 237.3));
}

function leafVPD(tempF, rh){
  const airTc  = (tempF - 32) * 5 / 9;
  const leafTc = airTc + (2 * 5 / 9);
  return svp(leafTc) * (1 - rh / 100);
}

// Stage thresholds (unchanged)
const STAGES = {
  seedling: { low:0.85, elev:1.15 },
  veg:      { low:0.90, elev:1.25 },
  flower:   { low:1.15, elev:1.60 }
};

// ✅ Updated notes reflecting regulation + distribution effects
const NOTES = {
  LOW: `
    <b>Ca:</b> Delivery limited by low xylem mass flow<br>
    <b>Mg:</b> Flux reduced; uptake may lag behind growth demand<br>
    <b>K:</b> Largely unaffected due to high mobility
  `,
  ELEVATED: `
    <b>Transpiration regulation increases.</b><br>
    The plant begins actively managing hydraulic flow to maintain stability.<br>
    <b>Ca:</b> Delivery becomes more dependent on local transpiration rates<br>
    <b>Mg:</b> Flux can become limiting in rapidly growing tissues<br>
    <b>K:</b> Mobile buffering maintains function
  `,
  EXCESSIVE: `
    <b>Ca:</b> Delivery failure likely due to hydraulic bottlenecks<br>
    <b>Mg:</b> Flux-limited; deficiency expression common<br>
    <b>K:</b> Buffering strained; turgor regulation impaired
  `
};

function classify(vpd, cfg){
  if (vpd <= cfg.low){
    return { label:"LOW", score:0.40 };
  }
  if (vpd <= cfg.elev){
    const t = (vpd - cfg.low) / (cfg.elev - cfg.low);
    return { label:"ELEVATED", score:0.60 + 0.20 * t };
  }
  return { label:"EXCESSIVE", score:0.90 };
}

function update(){
  const temp  = +tempEl.value;
  const rh    = +rhEl.value;
  const stage = stageEl.value;

  tempVal.textContent = `${temp} °F`;
  rhVal.textContent   = `${rh} %`;

  const vpd = leafVPD(temp, rh);
  const res = classify(vpd, STAGES[stage]);

  meterFill.style.width = `${Math.round(20 + res.score * 75)}%`;
  meterText.textContent = `${res.label}  (${vpd.toFixed(2)} kPa)`;
  ionNotes.innerHTML = NOTES[res.label];
}

[tempEl, rhEl, stageEl].forEach(el =>
  el.addEventListener("input", update)
);

update();
