document.addEventListener("DOMContentLoaded", () => {

  /* ---------- ELEMENTS ---------- */
  const tempEl  = document.getElementById("temp");
  const rhEl    = document.getElementById("rh");
  const stageEl = document.getElementById("stage");

  const tempVal = document.getElementById("tempVal");
  const rhVal   = document.getElementById("rhVal");

  const meterFill = document.getElementById("meterFill");
  const meterText = document.getElementById("meterText");
  const ionNotes  = document.getElementById("ionNotes");

  const nutrientChecks = document.querySelectorAll(".nutrients input");

  const readmeBox     = document.getElementById("readmeBox");
  const readmeContent = document.getElementById("readmeContent");

  const physReadmeContent = document.getElementById("physReadmeContent");

  /* ---------- HARD GUARDS ---------- */
  if (!tempEl || !rhEl || !tempVal || !rhVal || !meterFill || !meterText || !ionNotes) {
    console.error("Critical DOM elements missing. JS aborted.");
    return;
  }

  /* ---------- PHYSICS ---------- */
  function svp(Tc){
    return 0.6108 * Math.exp((17.27 * Tc) / (Tc + 237.3));
  }

  function leafVPD(tempF, rh){
    const airTc  = (tempF - 32) * 5 / 9;
    const leafTc = airTc + (2 * 5 / 9); // +2°F leaf offset
    return svp(leafTc) * (1 - rh / 100);
  }

  /* ---------- STAGES ---------- */
  const STAGES = {
    seedling:{ low:0.85, elev:1.15 },
    veg:{ low:0.90, elev:1.35 },
    flower:{ low:1.15, elev:1.60 }
  };

  /* ---------- NUTRIENT TRANSPORT MODES ---------- */
  const NOT_TRANSPIRATION_COUPLED = new Set([
    "P",
    "Fe",
    "Zn"
    // add "Mn" here if desired
  ]);

  /* ---------- SHORT NOTES ---------- */
  const NOTES = {
    LOW: n => `<b>${n}:</b> Low delivery rate`,

    TARGET: n =>
      `<b>${n}:</b> Delivery matches physiological demand`,

    EXCESSIVE: n => {
      if (n === "N") {
        return `<b>N:</b> Delivery can be high, and begin to exceed assimilation/use capacity`;
      }
      return `<b>${n}:</b> High delivery rate`;
    },

    NOT_COUPLED: n =>
      `<b>${n}:</b> Uptake is not strongly coupled to transpiration`
  };

  /* ---------- README (VERBATIM, PRESERVED) ---------- */
  const README = {
    N: `<b>Nitrogen:</b> Nitrogen uptake and nitrogen use are not the same process. Nitrate can be taken up and transported rapidly under high transpiration, but assimilation into amino acids requires enzymes, carbon skeletons, energy, and time. When delivery exceeds assimilation capacity, nitrogen becomes diluted in expanding tissues or lost from the root zone. Adjust by moderating VPD, improving carbon supply, or aligning nitrogen strength with growth rate.`,

    Ca: `<b>Calcium:</b> Calcium transport depends entirely on continuous xylem flow and is effectively immobile once deposited. Low VPD restricts delivery to new growth, while high VPD biases calcium toward older, highly transpiring tissues. Feeding more calcium does not fix distribution failures; stable, moderate transpiration is the only reliable solution.`,

    Mg: `<b>Magnesium:</b> Magnesium is mobile and can be redistributed, but initial uptake still depends on mass flow. Low VPD slows delivery, while high VPD increases competitive uptake pressure against calcium and potassium. Correct by stabilizing VPD and maintaining balanced cation ratios.`,

    K: `<b>Potassium:</b> Potassium moves readily with the transpiration stream and plays a central role in stomatal regulation. Low delivery impairs control of water loss; excessive delivery can dominate cation uptake and distort ionic balance. Moderate VPD supports both regulation and balance.`,

    P: `<b>Phosphorus:</b> Phosphorus availability is primarily diffusion-limited in soil and weakly influenced by transpiration. VPD changes rarely correct phosphorus issues; root health, mycorrhizal function, and soil chemistry matter more.`,

    S: `<b>Sulfur:</b> Sulfate delivery increases with transpiration, but sulfur use is metabolically capped. Excess delivery provides little benefit once demand is met. Maintain moderate transpiration and adequate but not excessive supply.`,

    Fe: `<b>Iron:</b> Iron uptake depends on redox chemistry and chelation rather than mass flow. VPD mainly affects internal distribution, not acquisition. Address iron issues through chemistry, not transpiration.`,

    Mn: `<b>Manganese:</b> Manganese delivery rises with transpiration and can overshoot safe levels. High VPD environments increase toxicity risk depending on soil availability. Control VPD and monitor inputs.`,

    B: `<b>Boron:</b> Boron transport depends on transpiration and has limited mobility. Low VPD restricts delivery; high VPD risks localized accumulation. Stability is more important than extremes.`,

    Zn: `<b>Zinc:</b> Zinc uptake is slow and competitive. High transpiration increases delivery pressure but not utilization. Balance VPD and micronutrient ratios rather than increasing dose.`
  };

  /* ---------- PHYSIOLOGY README ---------- */
  function getPhysiologyReadme(){
    return `
<b>1. Non-Nutrient Transpiration Processes</b><br><br>
<i>(Mechanisms driven by water flux, independent of feeding)</i><br><br>

<b>Carbon access through stomata</b><br>
Transpiration and stomatal conductance are coupled, but CO₂ diffusion depends on both stomatal openness and the surrounding vapor pressure gradient. When VPD is very low, transpiration is weak and gas exchange becomes inefficient; when VPD is very high, stomata partially close to limit water loss. In both cases, photosynthesis is constrained despite adequate light and nutrients.<br>
Example: A room run at very low VPD shows slow growth even under high-PPFD LEDs because CO₂ diffusion into the leaf, not light or nutrition, is limiting carbon fixation.

<br><br>

<b>Turgor pressure & cell expansion (Lockhart + acid growth)</b><br>
Cell expansion requires positive turgor pressure and a yielding cell wall. Auxin-driven acid growth increases wall extensibility, but expansion only occurs when transpiration maintains sufficient hydraulic pressure to drive water into expanding cells. Misaligned VPD breaks this coupling and slows growth.<br>
Example: Plants grown in persistently humid, low-VPD LED rooms often show reduced internode elongation and compact growth because hydraulic drive for cell expansion is limited.

<br><br>

<b>Leaf thermal regulation</b><br>
Transpiration cools the leaf via evaporative heat loss and helps stabilize leaf temperature relative to the surrounding air. Under high VPD, evaporative demand increases and partial stomatal closure can reduce cooling efficiency while increasing hydraulic strain, even when radiant heat load is low.<br>
Example: In high-PPFD LED environments, plants at high VPD may show stress responses and reduced photosynthetic efficiency not because leaves overheat, but because evaporative cooling becomes unstable and hydraulically costly despite acceptable air temperatures.

<br><br>

<b>Hydraulic continuity & recovery capacity</b><br>
Sustained transpiration maintains continuous water flow from root to leaf. Repeated over-pull under high VPD increases xylem tension and reduces the plant’s recovery margin during transient stress events.<br>
Example: Plants grown at chronically high VPD under LEDs may appear vigorous but wilt quickly after short dry-backs because elevated xylem tension limits how rapidly hydraulic continuity can be restored.
`;
  }

  /* ---------- CLASSIFIER ---------- */
  function classify(vpd, cfg){
    if (vpd <= cfg.low) return { label:"LOW", load:0.40 };
    if (vpd <= cfg.elev){
      const t = (vpd - cfg.low) / (cfg.elev - cfg.low);
      return { label:"TARGET", load:0.60 + 0.20 * t };
    }
    return { label:"EXCESSIVE", load:0.90 };
  }

  /* ---------- UPDATE ---------- */
  function update(){
    const temp = +tempEl.value;
    const rh   = +rhEl.value;

    const stage =
      stageEl && STAGES[stageEl.value]
        ? stageEl.value
        : "veg";

    tempVal.textContent = `${temp} °F`;
    rhVal.textContent   = `${rh} %`;

    const vpd = leafVPD(temp, rh);
    const res = classify(vpd, STAGES[stage]);

    meterFill.style.width = `${Math.round(20 + res.load * 75)}%`;
    meterText.textContent = `${res.label} (${vpd.toFixed(2)} kPa)`;

    let shortHTML  = "";
    let readmeHTML = "";

    nutrientChecks.forEach(cb => {
      if (!cb.checked) return;

      if (NOT_TRANSPIRATION_COUPLED.has(cb.value)){
        shortHTML += NOTES.NOT_COUPLED(cb.value) + "<br>";
      } else {
        shortHTML += NOTES[res.label](cb.value) + "<br>";
      }

      readmeHTML += README[cb.value] + "<br><br>";
    });

    ionNotes.innerHTML =
      shortHTML || "Select nutrients to view delivery status.";

    readmeContent.innerHTML = readmeHTML;
    readmeBox.style.display = readmeHTML ? "block" : "none";
  }

  /* ---------- EVENTS ---------- */
  [tempEl, rhEl, stageEl, ...nutrientChecks]
    .filter(Boolean)
    .forEach(el => el.addEventListener("input", update));

  /* ---------- INIT ---------- */
  if (physReadmeContent){
    physReadmeContent.innerHTML = getPhysiologyReadme();
  }

  update();

});
