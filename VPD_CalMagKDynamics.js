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
  const leafTc = airTc + (2 * 5 / 9); // assumes leaf ~2°F warmer
  return svp(leafTc) * (1 - rh / 100);
}

// Stage-specific thresholds
const STAGES = {
  seedling: { low:0.85, elev:1.15 },
  veg:      { low:0.90, elev:1.35 },
  flower:   { low:1.15, elev:1.60 }
};

// Notes aligned with classify() labels
const NOTES = {
  LOW: `
    <b>Ca:</b> Delivery limited by reduced transpiration<br>
    <b>Mg:</b> Uptake may lag behind growth demand; plant relies more on internal stores<br>
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
    <b>Ca:</b> Delivery can fall behind demand as high VPD tightens control<br>
    <b>Mg:</b> Uptake may lag due to water-saving responses; deficiency expression increases<br>
    <b>K:</b> Buffering capacity becomes strained, reducing effective turgor control
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
  meterText.textContent = `${res.label} (${vpd.toFixed(2)} kPa)`;
  ionNotes.innerHTML = NOTES[res.label];
}

[tempEl, rhEl, stageEl].forEach(el =>
  el.addEventListener("input", update)
);

update();
