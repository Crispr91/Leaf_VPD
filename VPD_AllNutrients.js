const tempEl = document.getElementById("temp");
const rhEl = document.getElementById("rh");
const stageEl = document.getElementById("stage");

const tempVal = document.getElementById("tempVal");
const rhVal = document.getElementById("rhVal");

const meterFill = document.getElementById("meterFill");
const meterText = document.getElementById("meterText");
const ionNotes = document.getElementById("ionNotes");

const nutrientChecks = document.querySelectorAll(".nutrients input");

/* ---------- PHYSICS ---------- */
function svp(Tc){
  return 0.6108 * Math.exp((17.27 * Tc) / (Tc + 237.3));
}

function leafVPD(tempF, rh){
  const airTc = (tempF - 32) * 5/9;
  const leafTc = airTc + (2 * 5/9);
  return svp(leafTc) * (1 - rh/100);
}

/* ---------- STAGES ---------- */
const STAGES = {
  seedling:{ low:0.85, elev:1.15 },
  veg:{ low:0.90, elev:1.35 },
  flower:{ low:1.15, elev:1.60 }
};

/* ---------- NUTRIENTS ---------- */
const NUTRIENTS = {
  N:"Mobile; demand scales with metabolism",
  P:"Root-limited; diffusion-controlled",
  K:"Highly mobile; osmotic regulation",
  Ca:"Xylem-limited; new tissue dependent",
  Mg:"Mobile; photosynthetic demand",
  S:"Moderately mobile; protein synthesis",
  Fe:"Immobile; redox-sensitive",
  Mn:"Low mobility; enzyme activation",
  B:"Very low mobility; cell wall formation",
  Zn:"Low mobility; hormonal regulation"
};

function classify(vpd, cfg){
  if (vpd <= cfg.low) return { label:"LOW", load:.35 };
  if (vpd <= cfg.elev){
    const t=(vpd-cfg.low)/(cfg.elev-cfg.low);
    return { label:"TARGET", load:.55+.25*t };
  }
  return { label:"HIGH", load:.9 };
}

function update(){
  const temp=+tempEl.value;
  const rh=+rhEl.value;
  const stage=stageEl.value;

  tempVal.textContent=`${temp} °F`;
  rhVal.textContent=`${rh} %`;

  const vpd=leafVPD(temp,rh);
  const res=classify(vpd,STAGES[stage]);

  meterFill.style.width=`${20+res.load*75}%`;
  meterText.textContent=`${res.label} (${vpd.toFixed(2)} kPa)`;

  let html="";
  nutrientChecks.forEach(c=>{
    if(c.checked){
      html+=`<b>${c.value}:</b> ${NUTRIENTS[c.value]}<br>`;
    }
  });

  ionNotes.innerHTML=html || "Select nutrients to view transport notes.";
}

[tempEl,rhEl,stageEl,...nutrientChecks]
  .forEach(el => el.addEventListener("input",update));

update();
