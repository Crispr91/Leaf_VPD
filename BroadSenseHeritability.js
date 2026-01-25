const NEl = document.getElementById("N");
const GEl = document.getElementById("G");
const kEl = document.getElementById("k");
const VGEl = document.getElementById("VG");
const VEEl = document.getElementById("VE");

const VPEl = document.getElementById("VP");
const H2El = document.getElementById("H2");
const warningEl = document.getElementById("warning");
const interpretationEl = document.getElementById("interpretation");

function interpretH2(H2) {
  if (isNaN(H2)) return "";

  if (H2 < 0) {
    return "In this population and environment, genetic contribution is not detectable (negative estimates are interpreted as zero). The observed variation is consistent with environmental and residual effects.";
  }

  const h = Math.max(0, Math.min(1, H2));
  const g = Math.round(h * 100);
  const e = 100 - g;

  if (h === 0) {
    return "In this population and environment, approximately 0% of the observed variation in the trait is attributable to genetic differences between genotypes; variation is dominated by environmental and residual effects among clones. This estimate applies to the population under these conditions and does not describe individuals.";
  }

  if (h === 1) {
    return "In this population and environment, approximately 100% of the observed variation in the trait is attributable to genetic differences between genotypes, with little to no remaining variation attributable to environmental and residual effects among clones. This estimate applies to the population under these conditions and does not describe individuals.";
  }

  return `In this population and environment, approximately ${g}% of the observed variation in the trait is due to genetic differences between genotypes, with the remaining ${e}% due to environmental and residual variation among clones. This estimate applies to the population under these conditions and does not describe individuals.`;
}

function calculate() {
  const N = parseFloat(NEl.value);
  const G = parseFloat(GEl.value);
  const k = parseFloat(kEl.value);
  const VG = parseFloat(VGEl.value);
  const VE = parseFloat(VEEl.value);

  if ([VG, VE].some(v => isNaN(v))) {
    VPEl.textContent = "—";
    H2El.textContent = "—";
    warningEl.textContent = "";
    interpretationEl.textContent = "";
    return;
  }

  const VP = VG + VE;
  const H2 = VG / VP;

  VPEl.textContent = VP.toFixed(4);
  H2El.textContent = H2.toFixed(3);
  interpretationEl.textContent = interpretH2(H2);

  if (!isNaN(k) && k < 3) {
    warningEl.textContent =
      "Low clonal replication: within-genotype variance may be poorly estimated.";
  } else {
    warningEl.textContent = "";
  }
}

[NEl, GEl, kEl, VGEl, VEEl].forEach(el =>
  el.addEventListener("input", calculate)
);
