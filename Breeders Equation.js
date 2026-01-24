const popSizeEl = document.getElementById("popSize");
const popMeanEl = document.getElementById("popMean");
const selMeanEl = document.getElementById("selMean");
const h2El = document.getElementById("heritability");

const SEl = document.getElementById("S");
const REl = document.getElementById("R");
const nextMeanEl = document.getElementById("nextMean");
const warningEl = document.getElementById("warning");

function calculate() {
  const N = parseFloat(popSizeEl.value);
  const Up = parseFloat(popMeanEl.value);
  const Us = parseFloat(selMeanEl.value);
  const h2 = parseFloat(h2El.value);

  if ([Up, Us, h2].some(v => isNaN(v))) {
    SEl.textContent = "—";
    REl.textContent = "—";
    nextMeanEl.textContent = "—";
    warningEl.textContent = "";
    return;
  }

  const S = Us - Up;
  const R = h2 * S;
  const nextMean = Up + R;

  SEl.textContent = S.toFixed(3);
  REl.textContent = R.toFixed(3);
  nextMeanEl.textContent = nextMean.toFixed(3);

  if (!isNaN(N) && N < 20) {
    warningEl.textContent =
      "Low population size: estimates may be unstable due to sampling noise.";
  } else {
    warningEl.textContent = "";
  }
}

[popSizeEl, popMeanEl, selMeanEl, h2El]
  .forEach(el => el.addEventListener("input", calculate));
