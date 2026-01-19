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

// Thresholds exactly as specified
const STAGES = {
  seedling: { low:0.85, elev:1.15 },
  veg:      { low:0.90, elev:1.35 },
  flower:   { low:1.15, elev:1.60 }
};

// Human-readable labels (UI only)
const LABELS = {
  LOW: "Low",
  ELEVATED: "Intermediate / Target (For Healthy Plants)",
  EXCESSIVE: "Excessive"
};

const NOTES = {
  LOW: `
    <b>Low VPD:</b> Reduced transpiration slows nutrient delivery rate; higher solution concentrations may be required to maintain adequate delivery <br><br>
    <b>Ca:</b> Uptake and delivery are limited by reduced transpiration. Symptoms would expect to appear in new growth first, possibly patchy across the upper canopy <br>
    <b>Mg:</b> Uptake may lag behind growth demand; delivery rates can suffer and reliance on internal stores increases. Deficiency symptoms may appear in older leaves despite adequate substrate levels due to weak delivery rates<br>
    <b>K:</b> Uptake may lag behind growth demand; delivery rates can suffer and reliance on internal stores increases. Deficiency symptoms may appear in older leaves despite adequate substrate levels due to weak delivery rates. Higher relative levels, and higher relative mobility mean this can show after Mg in balanced substrates
  `,
  ELEVATED: `
    <b>Intermediate / Target (For Healthy Plants)</b><br>
    Transpiration demand is sufficient to drive nutrient delivery. The increased pull on the transpiration stream stimulates the plant to more actively begin regulating transpiration. If an issue occurs here, though, something else is often out of balance besides general VPD <br>
    <b>Ca:</b> Transpiration-driven delivery generally keeps pace with demand. However, it can become locally limiting in rapidly expanding tissues. If a broader deficiency occurs here it could be due to low substrate levels or soil antagonisms<br>
    <b>Mg:</b> Delivery generally keeps pace with demand, but may lag locally in fast-growing tissues. If a broader deficiency occurs in this range it's often due to low substrate levels or soil antagonisms <br>
    <b>K:</b> Delivery generally keeps pace with demand. High relative mobility can delay symptom expression. If symptoms show, it's often due to low levels or soil antagonims, though local antagonisms can still occur
  `,
  EXCESSIVE: `
    <b>High VPD:</b> Higher transpiration increases nutrient delivery rate; lower concentrations may achieve the same delivery. Higher regulation of transpiration can introduce local limitations <br><br>
    <b>Ca:</b> Uptake may lag due to water-saving responses. Staying in this range can increase deficiency pressure <br>
    <b>Mg:</b> Uptake may lag due to water-saving responses; deficiency expression increases and reliance on internal stores becomes more pronounced<br>
    <b>K:</b> Uptake may lag due to water-saving responses; deficiency expression increases and reliance on internal stores becomes more pronounced. K is relatively more mobile so buffering is often stronger.  
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
  meterText.textContent = `${LABELS[res.label]} (${vpd.toFixed(2)} kPa)`;
  ionNotes.innerHTML = NOTES[res.label];
}

[tempEl, rhEl, stageEl].forEach(el =>
  el.addEventListener("input", update)
);

update();
