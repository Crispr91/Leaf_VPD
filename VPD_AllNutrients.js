const tempEl  = document.getElementById("temp");
const rhEl    = document.getElementById("rh");
const stageEl = document.getElementById("stage");

const tempVal = document.getElementById("tempVal");
const rhVal   = document.getElementById("rhVal");

const meterFill = document.getElementById("meterFill");
const meterText = document.getElementById("meterText");
const ionNotes  = document.getElementById("ionNotes");

const nutrientChecks = document.querySelectorAll(".nutrients input");

function svp(Tc){
  return 0.6108 * Math.exp((17.27 * Tc) / (Tc + 237.3));
}

function leafVPD(tempF, rh){
  const airTc  = (tempF - 32) * 5 / 9;
  const leafTc = airTc + (2 * 5 / 9);
  return svp(leafTc) * (1 - rh / 100);
}

const STAGES = {
  seedling:{ low:0.85, elev:1.15 },
  veg:{ low:0.90, elev:1.35 },
  flower:{ low:1.15, elev:1.60 }
};

const NOTES = {
  LOW: n =>
    `<b>${n}:</b> Reduced transpiration limits delivery rate. Higher solution concentrations may be required to maintain adequate flux.`,
  ELEVATED: n =>
    `<b>${n}:</b> Transpiration-driven delivery generally keeps pace with demand. Local limitations may still occur in fast-growing tissues.`,
  EXCESSIVE: n =>
    `<b>${n}:</b> Higher transpiration increases delivery rate, but water-saving regulation can introduce local transport limitations.`
};

function classify(vpd, cfg){
  if (vpd <= cfg.low) return { label:"LOW", load:0.40 };
  if (vpd <= cfg.elev){
    const t = (vpd - cfg.low) / (cfg.elev - cfg.low);
    return { label:"ELEVATED", load:0.60 + 0.20 * t };
  }
  return { label:"EXCESSIVE", load:0.90 };
}

function update(){
  const temp  = +tempEl.value;
  const rh    = +rhEl.value;
  const stage = stageEl.value;

  tempVal.textContent = `${temp} °F`;
  rhVal.textContent   = `${rh} %`;

  const vpd = leafVPD(temp, rh);
  const res = classify(vpd, STAGES[stage]);

  meterFill.style.width = `${Math.round(20 + res.load * 75)}%`;
  meterText.textContent = `${res.label} (${vpd.toFixed(2)} kPa)`;

  let html = "";
  nutrientChecks.forEach(cb=>{
    if (cb.checked){
      html += NOTES[res.label](cb.value) + "<br>";
    }
  });

  ionNotes.innerHTML = html || "Select nutrients to view transport notes.";
}

[tempEl, rhEl, stageEl, ...nutrientChecks].forEach(el =>
  el.addEventListener("input", update)
);

update();
