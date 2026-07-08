const money=v=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD"});
const number=v=>Number(v||0)||0;
const norm=v=>String(v||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"");

function titleWords(value){
  return String(value||"").toLowerCase()
    .replace(/&/g," and ")
    .replace(/chocoloate/g,"chocolate")
    .replace(/choc\./g,"chocolate")
    .replace(/choc/g,"chocolate")
    .replace(/krispies/g,"krispie")
    .replace(/mac\./g,"macadamia")
    .replace(/[^a-z0-9]+/g," ")
    .split(" ")
    .filter(Boolean)
    .filter(word=>![
      "cookie","cookies","treat","treats","soft","chewy","bakery","style",
      "and","the","a","an","of","with","one","batch","batches","recipe",
      "photo","google","sheet","cost","costs","pan","9x12","jumbo"
    ].includes(word));
}
function smartKey(value){return titleWords(value).join("");}
function tokenScore(a,b){
  const aw=[...new Set(titleWords(a))], bw=[...new Set(titleWords(b))];
  if(!aw.length || !bw.length) return 0;
  const shared=aw.filter(w=>bw.includes(w)).length;
  return shared / Math.max(aw.length,bw.length);
}

const MANUAL_MATCHES={
  chocolatechipcookies:["chocolatechip","classicchocolatechip","chocolatechipcookies","chocolatechipcookie"],
  chocolatechip:["chocolatechip","chocolatechipcookies","classicchocolatechip"],
  brownbutterchocolatechip:["brownbutterchocolatechip","brownbutterchocchip","brownbutterchocolatechipcookies","chewybrownbutterchocolatechip"],
  doublechocolatechip:["doublechocolatechip","doublechocolatechipcookies","doublechocolate"],
  greenmintchocolatechip:["greenmintchocolatechip","greenmintchocoloatechip","mintchocolatechip","greenmint"],
  whitechocolatemacadamianut:["whitechocolatemacadamianut","whitechocmacadamianut","whitechocolatemacadamianut","whitechocolatemacadamianutcookies","macadamianut"],
  oatmealraisin:["oatmealraisin","bakeryoatmealraisin","oatmealraisincookies"],
  molasses:["molasses","gingermolasses","softgingermolasses","molassescookies"],
  softsprinkle:["softsprinkle","sprinkle","softsprinklecookies","sugarsprinkle","sprinklecookies"],
  pumpkinsnickerdoodle:["pumpkinsnickerdoodle","pumpkinsnickerdoodlecookies"],
  peanutbutter:["peanutbutter","softchewypeanutbutter","peanutbuttercookies"],
  redvelvet:["redvelvet","redvelvetcookies","redvelvetcookie"],
  thumbprint:["thumbprint","thumbprintcookies","thumbprintcookie"],
  nannypoundcake:["nannypoundcake","nannypoundcakecookies","poundcake","poundcakecookies","nannys"],
  blackberryjam:["blackberryjam","blackberry","blackberryjelly"],
  ricekrispietreats:["ricekrispietreats","ricekrispie","ricekrispies","ricekrispietreats9x12pan","ricekrispietreat"],
  monster:["monster","monstercookies","monstercookie"]
};

let dashboardData={products:[],ingredients:[],orders:[],customers:[]};
const bakedRecipes=window.CDAWG_RECIPE_LIBRARY||[];
let selectedRecipeKey="";

const productionBatchState=loadProductionBatchState();
const kitchenBatchState=loadKitchenBatchState();
const priceState=loadPriceState();
const pricingModeState=loadPricingModeState();

const DEFAULT_CORPORATE_DZ_PRICE = 36;
const DEFAULT_SQUARE_DZ_PRICE = 48;
const DEFAULT_SQUARE_EACH_PRICE = 4;
const DEFAULT_TARGET_MARGIN = 65;

function loadProductionBatchState(){
  try {
    // One-time migration from older shared key into production only.
    return JSON.parse(localStorage.getItem("cdawgProductionBatchState") || localStorage.getItem("cdawgBatchState") || "{}");
  } catch(e){ return {}; }
}
function saveProductionBatchState(){
  localStorage.setItem("cdawgProductionBatchState", JSON.stringify(productionBatchState));
}
function loadKitchenBatchState(){
  try { return JSON.parse(localStorage.getItem("cdawgKitchenBatchState") || "{}"); }
  catch(e){ return {}; }
}
function saveKitchenBatchState(){
  localStorage.setItem("cdawgKitchenBatchState", JSON.stringify(kitchenBatchState));
}
function loadPriceState(){
  try{return JSON.parse(localStorage.getItem("cdawgDualPriceState")||localStorage.getItem("cdawgPriceState")||"{}")}catch(e){return{}}
}
function savePriceState(){localStorage.setItem("cdawgDualPriceState",JSON.stringify(priceState));}
function loadPricingModeState(){
  try{return JSON.parse(localStorage.getItem("cdawgPricingModeState")||"{}")}catch(e){return{}}
}
function savePricingModeState(){localStorage.setItem("cdawgPricingModeState",JSON.stringify(pricingModeState));}

function hasOwn(obj,key){return Object.prototype.hasOwnProperty.call(obj,key);}
function getProductionBatch(key,fallback=0){
  const value=number(productionBatchState[key]);
  return hasOwn(productionBatchState,key) ? Math.max(0,value) : Math.max(0,number(fallback)||0);
}
function setProductionBatch(key,value){
  productionBatchState[key]=Math.max(0,number(value));
  saveProductionBatchState();
}
function getKitchenBatch(key,fallback=1){
  const value=number(kitchenBatchState[key]);
  return hasOwn(kitchenBatchState,key) ? Math.max(1,value) : Math.max(1,number(fallback)||1);
}
function setKitchenBatch(key,value){
  kitchenBatchState[key]=Math.max(1,number(value));
  saveKitchenBatchState();
}
function priceRecord(r){
  if(!priceState[r.key]) {
    priceState[r.key] = {
      corporateDz: DEFAULT_CORPORATE_DZ_PRICE,
      squareDz: DEFAULT_SQUARE_DZ_PRICE,
      squareEach: DEFAULT_SQUARE_EACH_PRICE,
      targetMargin: DEFAULT_TARGET_MARGIN
    };
  }
  return priceState[r.key];
}
function pricingMode(r){
  return pricingModeState[r.key] || "corporate";
}
function setPricingMode(key,mode){
  pricingModeState[key]=mode;
  savePricingModeState();
}
function setPriceField(key,field,value){
  if(!priceState[key]) priceState[key]={};
  priceState[key][field]=Math.max(0,number(value));
  savePriceState();
}
function getCorporateDzPrice(r){return number(priceRecord(r).corporateDz)||0;}
function getSquareDzPrice(r){return number(priceRecord(r).squareDz)||0;}
function getSquareEachPrice(r){return number(priceRecord(r).squareEach)||0;}
function getTargetMargin(r){return number(priceRecord(r).targetMargin)||DEFAULT_TARGET_MARGIN;}
function getActiveDzPrice(r){
  const mode=pricingMode(r);
  if(mode==="square") return getSquareDzPrice(r);
  return getCorporateDzPrice(r);
}
function getSellPrice(r){
  return getActiveDzPrice(r);
}
function setSellPrice(key,value){
  if(!priceState[key]) priceState[key]={};
  priceState[key].corporateDz=Math.max(0,number(value));
  savePriceState();
}
function revenueForMode(r,mode){
  const y=productionYield(r);
  if(y<=0) return 0;
  if(unitLabel(r)==="jars" || unitLabel(r)==="pan") {
    return (mode==="square" ? getSquareDzPrice(r) : getCorporateDzPrice(r)) * selectedBatches(r);
  }
  if(mode==="squareRetailEach") return y * getSquareEachPrice(r);
  const dzPrice = mode==="square" ? getSquareDzPrice(r) : getCorporateDzPrice(r);
  return (y/12) * dzPrice;
}
function profitForMode(r,mode){return revenueForMode(r,mode)-batchCostForRecipe(r);}
function marginForMode(r,mode){
  const rev=revenueForMode(r,mode);
  return rev>0 ? (profitForMode(r,mode)/rev)*100 : 0;
}
function suggestedDzPriceForTarget(r,targetMargin=null){
  const target=(targetMargin ?? getTargetMargin(r))/100;
  const costPerDz=costDozen(r);
  if(costPerDz<=0 || target>=.98) return 0;
  return costPerDz/(1-target);
}
function bestPricingChannel(r){
  const options=[
    ["Corporate DZ", marginForMode(r,"corporate"), revenueForMode(r,"corporate"), profitForMode(r,"corporate")],
    ["Square DZ", marginForMode(r,"square"), revenueForMode(r,"square"), profitForMode(r,"square")],
    ["Square Each", marginForMode(r,"squareRetailEach"), revenueForMode(r,"squareRetailEach"), profitForMode(r,"squareRetailEach")]
  ].filter(x=>x[2]>0);
  return options.sort((a,b)=>b[3]-a[3])[0] || ["No price",0,0,0];
}

function jsonp(url){
  return new Promise((resolve,reject)=>{
    const cb=`snackshackCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const s=document.createElement("script");
    const t=setTimeout(()=>{cleanup();reject(new Error("Backend timed out. Using built-in recipe library."));},10000);
    function cleanup(){clearTimeout(t);try{delete window[cb]}catch(e){window[cb]=undefined}if(s.parentNode)s.parentNode.removeChild(s)}
    window[cb]=d=>{cleanup();resolve(d||{})};
    s.onerror=()=>{cleanup();reject(new Error("Backend failed. Using built-in recipe library."))};
    s.src=`${url}${url.includes("?")?"&":"?"}callback=${cb}&t=${Date.now()}`;
    document.body.appendChild(s);
  });
}
async function loadBackendData(){
  const url=window.SNACKSHACK_API_URL||"";
  if(!url||url.includes("PASTE")) throw new Error("Missing backend URL.");
  const live=await jsonp(url);
  if(!live||live.error) throw new Error(live?.message||"Backend returned an error.");
  dashboardData={...dashboardData,...live,
    products:Array.isArray(live.products)?live.products:[],
    ingredients:Array.isArray(live.ingredients)?live.ingredients:[]
  };
}

function recipeKey(r){return norm(r.name)}
function productMatchNames(product){
  const names=[product.name, product.sku, product.title, product.productName, product.recipeName].filter(Boolean);
  const extras=[];
  names.forEach(name=>{
    const key=smartKey(name);
    extras.push(key, norm(name));
    Object.entries(MANUAL_MATCHES).forEach(([canonical, aliases])=>{
      if(aliases.includes(key) || key.includes(canonical) || canonical.includes(key)){
        extras.push(canonical, ...aliases);
      }
    });
  });
  return [...new Set([...names, ...extras].filter(Boolean))];
}
function recipeMatchNames(recipe){
  const names=[recipe.name, ...(recipe.aliases||[])].filter(Boolean);
  const extras=[];
  names.forEach(name=>{
    const key=smartKey(name);
    extras.push(key, norm(name));
    if(MANUAL_MATCHES[key]) extras.push(...MANUAL_MATCHES[key]);
    Object.entries(MANUAL_MATCHES).forEach(([canonical, aliases])=>{
      if(aliases.includes(key) || key.includes(canonical) || canonical.includes(key)){
        extras.push(canonical, ...aliases);
      }
    });
  });
  return [...new Set([...names, ...extras].filter(Boolean))];
}
function findCostProduct(r){
  const products=dashboardData.products||[];
  const recipeNames=recipeMatchNames(r);
  const recipeKeys=recipeNames.map(smartKey).concat(recipeNames.map(norm)).filter(Boolean);

  let found=products.find(p=>{
    const productNames=productMatchNames(p);
    const productKeys=productNames.map(smartKey).concat(productNames.map(norm)).filter(Boolean);
    return recipeKeys.some(rk=>productKeys.some(pk=>pk===rk || (rk.length>4 && pk.includes(rk)) || (pk.length>4 && rk.includes(pk))));
  });
  if(found) return found;

  let best=null, bestScore=0;
  products.forEach(p=>{
    productMatchNames(p).forEach(pn=>{
      recipeNames.forEach(rn=>{
        const score=tokenScore(rn,pn);
        if(score>bestScore){bestScore=score;best=p;}
      });
    });
  });
  if(bestScore>=0.42) return best;

  let signatureBest=null, signatureScore=0;
  const recipeIngredientWords=new Set((r.ingredients||[]).flatMap(line=>titleWords(line)).filter(w=>w.length>2));
  products.forEach(p=>{
    const sheetWords=new Set((p.recipe||[]).flatMap(line=>titleWords(line.ingredient||"")).filter(w=>w.length>2));
    if(!recipeIngredientWords.size || !sheetWords.size) return;
    const shared=[...recipeIngredientWords].filter(w=>sheetWords.has(w)).length;
    const score=shared/Math.max(recipeIngredientWords.size, sheetWords.size);
    if(score>signatureScore){signatureScore=score;signatureBest=p;}
  });
  return signatureScore>=0.34 ? signatureBest : null;
}
function mergedRecipes(){
  const rows=bakedRecipes.map(r=>({...r,key:recipeKey(r),costProduct:findCostProduct(r)}));
  const existing=new Set(bakedRecipes.flatMap(r=>[r.name,...(r.aliases||[])]).map(norm));
  (dashboardData.products||[]).forEach(p=>{
    if(!existing.has(norm(p.name))){
      rows.push({
        key:norm(p.name),
        name:p.name,
        yield:p.yieldLabel||`${p.batchYieldUnits||""} ${p.unitLabel||""}`.trim(),
        source:"Google Sheet",
        ingredients:(p.recipe||[]).map(l=>`${l.amount||""} ${l.unit||""} ${l.ingredient}`.trim()),
        steps:["Recipe text not uploaded yet. Cost data is connected from the Google Sheet."],
        costProduct:p
      });
    }
  });
  return rows.sort((a,b)=>a.name.localeCompare(b.name));
}

function extractYieldNumber(yieldText){
  const found=String(yieldText||"").match(/[\d.]+/);
  return found?number(found[0]):0;
}
function sheetBatches(p){return p?number(p.batches)||1:1}
function baseBatchCost(p){return p?(number(p.totalBatchCost)||(p.recipe||[]).reduce((s,l)=>s+number(l.ingredientCost),0)):0}
function singleBatchCost(p){const sb=sheetBatches(p);return sb?baseBatchCost(p)/sb:baseBatchCost(p)}
function selectedBatches(r){return getProductionBatch(r.key,0)}
function kitchenBatches(r){return getKitchenBatch(r.key,1)}
function batchCostForRecipe(r){return singleBatchCost(r.costProduct)*selectedBatches(r)}
function yieldPerSheetPlan(r){
  const p=r.costProduct;
  const y=extractYieldNumber(p?.yieldLabel||r.yield);
  return y || 0;
}
function yieldPerSingleBatch(r){
  const y=yieldPerSheetPlan(r);
  const sb=sheetBatches(r.costProduct);
  return sb?y/sb:y;
}
function productionYield(r){return yieldPerSingleBatch(r)*selectedBatches(r)}
function kitchenYield(r){return yieldPerSingleBatch(r)*kitchenBatches(r)}
function unitLabel(r){
  const text=String(r.costProduct?.yieldLabel||r.yield||"items").toLowerCase();
  if(text.includes("jar")) return "jars";
  if(text.includes("square")) return "squares";
  if(text.includes("pan")) return "pan";
  if(text.includes("cookie")) return "cookies";
  return "items";
}
function costEach(r){const y=productionYield(r);return y?batchCostForRecipe(r)/y:0}
function costDozen(r){return costEach(r)*12}
function estimatedRevenue(r){
  return revenueForMode(r, pricingMode(r)==="squareEach" ? "squareRetailEach" : pricingMode(r));
}
function estimatedProfit(r){return estimatedRevenue(r)-batchCostForRecipe(r)}
function flags(p){return p?(p.recipe||[]).filter(l=>number(l.amount)<=0||number(l.ingredientCost)<=0).length:0}
function activeRecipe(){const all=mergedRecipes();return all.find(r=>r.key===selectedRecipeKey)||all[0];}

function parseFractionValue(value){
  const text=String(value||"").trim();
  if(!text) return null;
  const mixed=text.match(/^(\d+)\s+(?:and\s+)?(\d+)\/(\d+)$/i);
  if(mixed) return number(mixed[1]) + number(mixed[2]) / number(mixed[3]);
  const fraction=text.match(/^(\d+)\/(\d+)$/);
  if(fraction) return number(fraction[1]) / number(fraction[2]);
  const decimal=text.match(/^\d+(?:\.\d+)?$/);
  if(decimal) return number(text);
  return null;
}
function formatScaledAmount(value){
  const n=number(value);
  if(!isFinite(n) || n===0) return "";
  const whole=Math.floor(n);
  const frac=n-whole;
  const common=[
    [0.125,"1/8"],[0.1667,"1/6"],[0.25,"1/4"],[0.3333,"1/3"],
    [0.375,"3/8"],[0.5,"1/2"],[0.625,"5/8"],[0.6667,"2/3"],
    [0.75,"3/4"],[0.875,"7/8"]
  ];
  const hit=common.find(([v])=>Math.abs(frac-v)<0.035);
  if(hit){
    if(whole===0) return hit[1];
    return `${whole} ${hit[1]}`;
  }
  if(Math.abs(n-Math.round(n))<0.001) return String(Math.round(n));
  return n.toFixed(2).replace(/\.?0+$/,"");
}
function scaledIngredientText(raw,batches){
  let text=String(raw||"").trim();
  if(!text) return text;
  if(/^(green food coloring|flaky|handwritten|no almond|as needed|optional)/i.test(text)) return text;
  const lead=text.match(/^(\s*)((?:\d+\s+(?:and\s+)?\d+\/\d+)|(?:\d+\/\d+)|(?:\d+(?:\.\d+)?))(\s+)(.*)$/i);
  if(lead){
    const parsed=parseFractionValue(lead[2]);
    if(parsed!==null){
      return `${lead[1]}${formatScaledAmount(parsed*batches)}${lead[3]}${lead[4]}`;
    }
  }
  text=text.replace(/(\d+\s+(?:and\s+)?\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(\s*(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|eggs?|egg yolks?|yolks?|bags?|bag|jars?|jar|boxes?|box)\b)/gi,
    (match, amount, unit)=>{
      const parsed=parseFractionValue(amount);
      return parsed===null ? match : `${formatScaledAmount(parsed*batches)}${unit}`;
    }
  );
  return text;
}
function pRecipeLinesForScaledIngredients(r){
  const p=r.costProduct;
  const batches=kitchenBatches(r);
  if(p && (p.recipe||[]).length){
    const sheetBatch=sheetBatches(p);
    const multiplier=batches/sheetBatch;
    return (p.recipe||[]).map(line=>{
      const amt=number(line.amount)*multiplier;
      const pretty=amt ? formatScaledAmount(amt) : "";
      return `${pretty} ${line.unit||""} ${line.ingredient}`.trim();
    });
  }
  return (r.ingredients||[]).map(item=>scaledIngredientText(item,batches));
}

function batchControlHtml(r, compact=false, mode="production"){
  const isKitchen=mode==="kitchen";
  const current=isKitchen?kitchenBatches(r):selectedBatches(r);
  const min=isKitchen?1:0;
  const label=isKitchen?"Recipe Batch":"Make";
  return `<div class="batch-control ${compact?"compact":""} ${isKitchen?"kitchen-control":"production-control"}" data-key="${r.key}" data-mode="${mode}">
    <button type="button" data-action="minus" aria-label="Decrease batches">−</button>
    <label><span>${label}</span><input type="number" min="${min}" step="1" value="${current}" data-action="input"></label>
    <button type="button" data-action="plus" aria-label="Increase batches">+</button>
  </div>`;
}
function priceControlHtml(r){
  const rec=priceRecord(r);
  const mode=pricingMode(r);
  return `<div class="dual-price-control" data-key="${r.key}">
    <label><span>Mode</span>
      <select data-field="mode">
        <option value="corporate" ${mode==="corporate"?"selected":""}>Corporate DZ</option>
        <option value="square" ${mode==="square"?"selected":""}>Square DZ</option>
        <option value="squareEach" ${mode==="squareEach"?"selected":""}>Square Each</option>
      </select>
    </label>
    <label><span>Corp DZ</span><input type="number" min="0" step="0.01" data-field="corporateDz" value="${number(rec.corporateDz).toFixed(2)}"></label>
    <label><span>Square DZ</span><input type="number" min="0" step="0.01" data-field="squareDz" value="${number(rec.squareDz).toFixed(2)}"></label>
    <label><span>Each</span><input type="number" min="0" step="0.01" data-field="squareEach" value="${number(rec.squareEach).toFixed(2)}"></label>
  </div>`;
}

function bindControls(){
  document.querySelectorAll(".batch-control").forEach(control=>{
    const key=control.dataset.key;
    const mode=control.dataset.mode||"production";
    const isKitchen=mode==="kitchen";
    const min=isKitchen?1:0;
    const getCurrent=()=>isKitchen?getKitchenBatch(key,1):getProductionBatch(key,0);
    const setCurrent=value=>isKitchen?setKitchenBatch(key,value):setProductionBatch(key,value);

    control.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const current=getCurrent();
        const next=btn.dataset.action==="plus"?current+1:Math.max(min,current-1);
        setCurrent(next);
        renderAll();
      });
    });
    const input=control.querySelector("input");
    input?.addEventListener("change",()=>{
      setCurrent(Math.max(min,number(input.value)));
      renderAll();
    });
  });
  document.querySelectorAll(".dual-price-control").forEach(control=>{
    const key=control.dataset.key;
    control.querySelectorAll("input").forEach(input=>{
      input.addEventListener("change",()=>{
        setPriceField(key,input.dataset.field,input.value);
        renderAll();
      });
    });
    control.querySelector("select")?.addEventListener("change",e=>{
      setPricingMode(key,e.target.value);
      renderAll();
    });
  });
}

function renderStatus(live,msg){
  const all=mergedRecipes();
  if(!selectedRecipeKey && all[0]) selectedRecipeKey=all[0].key;
  document.getElementById("statusTitle").textContent=live?`${all.length} recipes ready for Caleb`:`${all.length} recipes loaded`;
  document.getElementById("statusMessage").textContent=live
    ? `${dashboardData.ingredients.length} ingredient costs connected. Kitchen and Production batches are separate.`
    : (msg||"Built-in recipe cards are loaded.");
}
function setAllBatchesZero(){
  mergedRecipes().forEach(r=>productionBatchState[r.key]=0);
  saveProductionBatchState();
  renderAll();
}
function setCostedBatchesOne(){
  mergedRecipes().forEach(r=>productionBatchState[r.key]=r.costProduct?1:0);
  saveProductionBatchState();
  renderAll();
}
function resetKitchenRecipeBatches(){
  mergedRecipes().forEach(r=>kitchenBatchState[r.key]=1);
  saveKitchenBatchState();
  renderAll();
}

function renderOverview(){
  const all=mergedRecipes();
  const linked=all.filter(r=>r.costProduct).length;
  const productionCost=all.reduce((s,r)=>s+batchCostForRecipe(r),0);
  const revenue=all.reduce((s,r)=>s+estimatedRevenue(r),0);
  const totalYield=all.reduce((s,r)=>s+productionYield(r),0);
  const cards=[
    ["Recipes",all.length,"Kitchen cards"],
    ["Linked Costs",`${linked}/${all.length}`,"Google Sheet matched"],
    ["Production Batches",all.reduce((s,r)=>s+selectedBatches(r),0),"Planner only"],
    ["Production Yield",Math.round(totalYield),"Planner items"],
    ["Production Cost",money(productionCost),"Planner estimate"],
    ["Profit",money(revenue-productionCost),"Using sell prices"]
  ];
  document.getElementById("overview").innerHTML=cards.map(([label,value,detail])=>`
    <article class="metric-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${detail}</small>
    </article>
  `).join("");
  document.getElementById("recipeCountPill").textContent=`${all.length} recipes`;
  document.getElementById("ingredientCountPill").textContent=`${dashboardData.ingredients.length} costs`;
}
function renderRecipeList(filter=""){
  const q=filter.trim().toLowerCase();
  const all=mergedRecipes().filter(r=>!q||r.name.toLowerCase().includes(q)||(r.ingredients||[]).join(" ").toLowerCase().includes(q));
  document.getElementById("recipeList").innerHTML=all.map(r=>`
    <button class="recipe-row ${r.key===selectedRecipeKey?"active":""}" data-key="${r.key}">
      <span>
        <b>${r.name}</b>
        <small>Kitchen: ${kitchenBatches(r)} batch • ${Math.round(kitchenYield(r))} ${unitLabel(r)}</small>
      </span>
      <em class="${r.costProduct?"linked":"text"}">${r.costProduct?"Cost":"Text"}</em>
    </button>
  `).join("");
  document.querySelectorAll(".recipe-row").forEach(btn=>{
    btn.addEventListener("click",()=>{
      selectedRecipeKey=btn.dataset.key;
      renderRecipeList(document.getElementById("recipeSearch").value);
      renderRecipeDetail();
      bindControls();
    });
  });
}
function renderRecipeDetail(){
  const r=activeRecipe();
  if(!r) return;
  const lines=pRecipeLinesForScaledIngredients(r);
  document.getElementById("recipeDetail").innerHTML=`
    <div class="recipe-detail-head">
      <div>
        <p class="eyebrow">${Math.round(kitchenYield(r))} ${unitLabel(r)}</p>
        <h3>${r.name}</h3>
        <p class="muted">Kitchen batch only scales this recipe. It does not affect Production Planner or Smart Prep.</p>
      </div>
      <div class="detail-side kitchen-side">
        ${batchControlHtml(r,false,"kitchen")}
        <div class="kitchen-yield-card">
          <span>Kitchen Recipe</span>
          <strong>${kitchenBatches(r)} batch${kitchenBatches(r)===1?"":"es"}</strong>
          <small>${Math.round(kitchenYield(r))} ${unitLabel(r)} estimated</small>
        </div>
      </div>
    </div>
    <div class="detail-grid">
      <section>
        <h4>Scaled Ingredients</h4>
        <ul class="check-list">
          ${lines.map(i=>`<li><label><input type="checkbox"><span>${i}</span></label></li>`).join("")}
        </ul>
      </section>
      <section>
        <h4>Steps</h4>
        <ol class="steps-list">${(r.steps||[]).map(s=>`<li>${s}</li>`).join("")}</ol>
      </section>
    </div>`;
}
function renderCostCards(){
  const all=mergedRecipes();
  document.getElementById("recipeCards").innerHTML=`
    <div class="planner-actions">
      <button type="button" id="zeroAllBatches">Set production batches to 0</button>
      <button type="button" id="oneCostedBatch">Set costed recipes to 1</button>
      <button type="button" id="resetKitchenBatches">Reset kitchen recipe batches to 1</button>
      <span>Production batches control cost/profit/Smart Prep only. Pricing mode controls planner revenue.</span>
    </div>
    ${all.map(r=>{
      const cost=batchCostForRecipe(r), revenue=estimatedRevenue(r), profit=estimatedProfit(r), y=productionYield(r);
      const best=bestPricingChannel(r);
      return`
        <article class="cost-card ${!r.costProduct||cost<=0?"needs-cleanup":""}">
          <div class="cost-top">
            <div>
              <p class="eyebrow">${selectedBatches(r)} production ${selectedBatches(r)===1?"batch":"batches"}</p>
              <h3>${r.name}</h3>
              <span>${Math.round(y)} ${unitLabel(r)} planned</span>
            </div>
            <strong>${money(cost)}</strong>
          </div>
          ${batchControlHtml(r,true,"production")}
          ${priceControlHtml(r)}
          <div class="cost-stats business-stats">
            <span><small>Active Rev</small><b>${money(revenue)}</b></span>
            <span><small>Profit</small><b>${money(profit)}</b></span>
            <span><small>Margin</small><b>${revenue?Math.round((profit/revenue)*100):0}%</b></span>
          </div>
          <div class="mini-margin-row">
            <span>Corp ${Math.round(marginForMode(r,"corporate"))}%</span>
            <span>Sq DZ ${Math.round(marginForMode(r,"square"))}%</span>
            <span>Sq Each ${Math.round(marginForMode(r,"squareRetailEach"))}%</span>
          </div>
          <p class="best-channel">Best profit channel: <b>${best[0]}</b></p>
          <details>
            <summary>${r.costProduct?"Ingredient cost breakdown":"No sheet match yet"}</summary>
            ${r.costProduct?(r.costProduct.recipe||[]).map(l=>`<p><b>${l.ingredient}</b><span>${number(l.amount).toFixed(2)} ${l.unit||""} • ${money(l.ingredientCost)}</span></p>`).join(""):`<p><b>Recipe text loaded.</b><span>Add matching cost rows.</span></p>`}
          </details>
        </article>`;
    }).join("")}
  `;
  document.getElementById("zeroAllBatches")?.addEventListener("click",setAllBatchesZero);
  document.getElementById("oneCostedBatch")?.addEventListener("click",setCostedBatchesOne);
  document.getElementById("resetKitchenBatches")?.addEventListener("click",resetKitchenRecipeBatches);
}


function renderPricing(){
  const all=mergedRecipes();
  const planned=all.filter(r=>selectedBatches(r)>0);
  const rows=(planned.length?planned:all).map(r=>{
    const corpRev=revenueForMode(r,"corporate"), sqRev=revenueForMode(r,"square"), eachRev=revenueForMode(r,"squareRetailEach");
    const target=getTargetMargin(r);
    const suggested=suggestedDzPriceForTarget(r,target);
    return `
      <article class="pricing-card">
        <div>
          <p class="eyebrow">${selectedBatches(r)} production ${selectedBatches(r)===1?"batch":"batches"}</p>
          <h3>${r.name}</h3>
          <small>Cost/dozen ${money(costDozen(r))} • Target ${target}%</small>
        </div>
        <div class="pricing-table">
          <span><b>Corporate DZ</b><em>${money(getCorporateDzPrice(r))}</em><small>${Math.round(marginForMode(r,"corporate"))}% margin</small></span>
          <span><b>Square DZ</b><em>${money(getSquareDzPrice(r))}</em><small>${Math.round(marginForMode(r,"square"))}% margin</small></span>
          <span><b>Square Each</b><em>${money(getSquareEachPrice(r))}</em><small>${Math.round(marginForMode(r,"squareRetailEach"))}% margin</small></span>
        </div>
        <div class="suggested-price">
          <b>Suggested DZ for ${target}% margin</b>
          <strong>${money(suggested)}</strong>
        </div>
      </article>`;
  }).join("");
  document.getElementById("pricingGrid").innerHTML=rows || `<div class="empty-state">No recipes loaded.</div>`;
  const pill=document.getElementById("pricingCountPill");
  if(pill) pill.textContent=`${all.length} price sets`;
}


function renderIngredients(){
  const ing=[...(dashboardData.ingredients||[])].sort((a,b)=>a.name.localeCompare(b.name));
  document.getElementById("ingredientGrid").innerHTML=ing.length?ing.map(i=>`
    <article class="ingredient-chip">
      <b>${i.name}</b>
      <span>${money(i.costPerUnit)} / ${i.unit||i.recipeUnit||"unit"}</span>
      <small>${i.shoppingUnit||i.packageSize||"package"}${i.price?` • ${money(i.price)}`:""}</small>
    </article>
  `).join(""):`<div class="empty-state">No ingredient costs loaded yet.</div>`;
}
function buildIngredientTotals(){
  const ingredientTotals={};
  mergedRecipes().forEach(r=>{
    const p=r.costProduct;
    if(!p || selectedBatches(r)<=0) return;
    const sheetBatch=sheetBatches(p);
    const multiplier=selectedBatches(r)/sheetBatch;
    (p.recipe||[]).forEach(line=>{
      const name=line.ingredient||"Unknown";
      const unit=line.unit||"";
      const key=`${name}__${unit}`;
      if(!ingredientTotals[key]) ingredientTotals[key]={name,unit,amount:0,cost:0};
      ingredientTotals[key].amount += number(line.amount)*multiplier;
      ingredientTotals[key].cost += number(line.ingredientCost)*multiplier;
    });
  });
  return Object.values(ingredientTotals).filter(x=>x.amount>0).sort((a,b)=>b.cost-a.cost);
}
function renderCleanup(){
  const rows=mergedRecipes()
    .map(r=>({r,p:r.costProduct,f:flags(r.costProduct),cost:batchCostForRecipe(r)}))
    .filter(x=>!x.p||x.f>0)
    .sort((a,b)=>(b.f-a.f)||(a.cost-b.cost));

  document.getElementById("cleanupList").innerHTML=rows.length?rows.map(x=>`
    <div class="list-row">
      <div><strong>${x.r.name}</strong><span>${!x.p?"No sheet match found yet":`${x.f} zero amount/cost lines • production ${selectedBatches(x.r)} batch`}</span></div>
      <em class="${x.p?"warn":"bad"}">${x.p?"Review":"Link"}</em>
    </div>`).join(""):`<div class="empty-state">No obvious cleanup flags.</div>`;

  const all=mergedRecipes();
  const high=[...all].filter(r=>costEach(r)>0).sort((a,b)=>costEach(b)-costEach(a))[0];
  const low=[...all].filter(r=>costEach(r)>0).sort((a,b)=>costEach(a)-costEach(b))[0];
  document.getElementById("costExtremes").innerHTML=[
    high&&["Most expensive",high.name,`${money(costEach(high))}/item • ${money(costDozen(high))}/dozen`],
    low&&["Least expensive",low.name,`${money(costEach(low))}/item • ${money(costDozen(low))}/dozen`],
    ["Production cost",money(all.reduce((s,r)=>s+batchCostForRecipe(r),0)),"Production Planner batches only"],
    ["Projected profit",money(all.reduce((s,r)=>s+estimatedProfit(r),0)),"Using current sell prices"]
  ].filter(Boolean).map(x=>`<div class="list-row"><div><strong>${x[0]}</strong><span>${x[2]}</span></div><b>${x[1]}</b></div>`).join("");
}
function percent(value){
  if(!isFinite(value)) return "0%";
  return `${value.toFixed(1).replace(/\.0$/,"")}%`;
}
function buildBrain(){
  const all=mergedRecipes();
  const planned=all.filter(r=>selectedBatches(r)>0);
  const productionCost=all.reduce((s,r)=>s+batchCostForRecipe(r),0);
  const activeRevenue=all.reduce((s,r)=>s+estimatedRevenue(r),0);
  const corpRevenue=all.reduce((s,r)=>s+revenueForMode(r,"corporate"),0);
  const squareDzRevenue=all.reduce((s,r)=>s+revenueForMode(r,"square"),0);
  const squareEachRevenue=all.reduce((s,r)=>s+revenueForMode(r,"squareRetailEach"),0);
  const activeProfit=activeRevenue-productionCost;
  const corpProfit=corpRevenue-productionCost;
  const squareDzProfit=squareDzRevenue-productionCost;
  const squareEachProfit=squareEachRevenue-productionCost;
  const totalYield=all.reduce((s,r)=>s+productionYield(r),0);
  const totalDozens=totalYield/12;
  const activeMargin=activeRevenue>0?(activeProfit/activeRevenue)*100:0;
  const corpMargin=corpRevenue>0?(corpProfit/corpRevenue)*100:0;
  const squareDzMargin=squareDzRevenue>0?(squareDzProfit/squareDzRevenue)*100:0;
  const squareEachMargin=squareEachRevenue>0?(squareEachProfit/squareEachRevenue)*100:0;
  const roi=productionCost>0?(activeProfit/productionCost)*100:0;
  const avgProfitPerDozen=totalDozens>0?activeProfit/totalDozens:0;
  const zeroMatch=all.filter(r=>!r.costProduct);
  const ingredientTotals=buildIngredientTotals().slice(0,18);

  const lowMargin=planned.filter(r=>{
    const rev=estimatedRevenue(r);
    const margin=rev>0?(estimatedProfit(r)/rev)*100:0;
    return rev>0 && margin<getTargetMargin(r);
  }).sort((a,b)=>{
    const ma=estimatedRevenue(a)>0?(estimatedProfit(a)/estimatedRevenue(a))*100:0;
    const mb=estimatedRevenue(b)>0?(estimatedProfit(b)/estimatedRevenue(b))*100:0;
    return ma-mb;
  });
  const underpriced=planned.filter(r=> {
    const suggested=suggestedDzPriceForTarget(r,getTargetMargin(r));
    return suggested>0 && getCorporateDzPrice(r)>0 && getCorporateDzPrice(r)<suggested;
  });
  const bestActive=[...planned].filter(r=>estimatedRevenue(r)>0).sort((a,b)=>estimatedProfit(b)-estimatedProfit(a))[0];
  const bestMargin=[...planned].filter(r=>estimatedRevenue(r)>0).sort((a,b)=>{
    const ma=(estimatedProfit(a)/estimatedRevenue(a))*100;
    const mb=(estimatedProfit(b)/estimatedRevenue(b))*100;
    return mb-ma;
  })[0];

  const recs=[];
  if(!planned.length){
    recs.push({type:"warning",title:"No production selected",text:"Set Production Planner batches above 0 to activate dual-pricing margin math."});
  }
  if(zeroMatch.length){
    recs.push({type:"warning",title:"Finish sheet matching",text:`${zeroMatch.length} recipes still need sheet matches before all pricing math is fully trusted.`});
  }
  if(activeRevenue>0){
    recs.push({
      type: activeMargin>=70?"success":activeMargin>=55?"money":"warning",
      title:"Active pricing margin",
      text:`Current selected pricing modes project ${percent(activeMargin)} margin, ${percent(roi)} ROI, and ${money(avgProfitPerDozen)} profit per dozen.`
    });
  }
  const bestChannel=[
    ["Corporate DZ",corpProfit,corpMargin,corpRevenue],
    ["Square DZ",squareDzProfit,squareDzMargin,squareDzRevenue],
    ["Square Each",squareEachProfit,squareEachMargin,squareEachRevenue]
  ].filter(x=>x[3]>0).sort((a,b)=>b[1]-a[1])[0];
  if(bestChannel){
    recs.push({type:"success",title:"Best pricing channel",text:`${bestChannel[0]} currently projects the most profit: ${money(bestChannel[1])} at ${percent(bestChannel[2])} margin.`});
  }
  if(underpriced.length){
    recs.push({
      type:"warning",
      title:"Corporate DZ under target",
      text:`${underpriced.slice(0,3).map(r=>`${r.name} → suggested ${money(suggestedDzPriceForTarget(r,getTargetMargin(r)))}/DZ`).join(", ")}.`
    });
  }
  if(lowMargin.length){
    recs.push({type:"warning",title:"Low-margin watchlist",text:`${lowMargin.slice(0,3).map(r=>r.name).join(", ")} are under their target margin in the active pricing mode.`});
  }
  if(bestMargin){
    const margin=(estimatedProfit(bestMargin)/estimatedRevenue(bestMargin))*100;
    recs.push({type:"success",title:"Best active margin",text:`${bestMargin.name} has the strongest active margin at ${percent(margin)}.`});
  }
  if(bestActive){
    recs.push({type:"success",title:"Best profit driver",text:`${bestActive.name} currently projects ${money(estimatedProfit(bestActive))} profit in active pricing mode.`});
  }
  recs.push({type:"success",title:"Square-safe pricing logic",text:"Square prices are treated as retail sales data. Corporate DZ pricing stays separate, so Square will not overwrite your pricing strategy."});

  return {
    all, planned, productionCost, activeRevenue, activeProfit,
    corpRevenue, squareDzRevenue, squareEachRevenue,
    corpProfit, squareDzProfit, squareEachProfit,
    activeMargin, corpMargin, squareDzMargin, squareEachMargin,
    roi, avgProfitPerDozen, totalYield, zeroMatch, ingredientTotals, recs
  };
}
function renderBrain(){
  const brain=buildBrain();
  document.getElementById("brainSummary").innerHTML=`
    <article><span>Cost</span><strong>${money(brain.productionCost)}</strong><small>planner batches</small></article>
    <article><span>Active Revenue</span><strong>${money(brain.activeRevenue)}</strong><small>selected pricing modes</small></article>
    <article><span>Active Profit</span><strong>${money(brain.activeProfit)}</strong><small>projected net</small></article>
    <article><span>Active Margin</span><strong>${percent(brain.activeMargin)}</strong><small>profit ÷ revenue</small></article>
    <article><span>Corporate Profit</span><strong>${money(brain.corpProfit)}</strong><small>${percent(brain.corpMargin)} margin</small></article>
    <article><span>Square DZ Profit</span><strong>${money(brain.squareDzProfit)}</strong><small>${percent(brain.squareDzMargin)} margin</small></article>
    <article><span>Square Each Profit</span><strong>${money(brain.squareEachProfit)}</strong><small>${percent(brain.squareEachMargin)} margin</small></article>
    <article><span>Profit / Dozen</span><strong>${money(brain.avgProfitPerDozen)}</strong><small>active pricing</small></article>
  `;
  document.getElementById("brainCards").innerHTML=brain.recs.map(item=>`
    <article class="brain-card ${item.type}">
      <p>${item.title}</p>
      <span>${item.text}</span>
    </article>
  `).join("");
  document.getElementById("shoppingList").innerHTML=`
    <div class="panel-head slim">
      <div>
        <p class="eyebrow">Smart Prep List</p>
        <h2>Ingredients Needed for Production Planner Batches</h2>
        <p class="muted">Only Production Planner batch counts feed this list. Kitchen recipe batches do not.</p>
      </div>
    </div>
    <div class="shopping-grid">
      ${brain.ingredientTotals.length?brain.ingredientTotals.map(item=>`
        <article>
          <b>${item.name}</b>
          <span>${item.amount.toFixed(2).replace(/\.?0+$/,"")} ${item.unit}</span>
          <small>${money(item.cost)} planned cost</small>
        </article>
      `).join(""):`<div class="empty-state">No production batches selected yet. Set Production Planner batches above 0 to build this prep list.</div>`}
    </div>
  `;
}

function renderAll(){
  renderOverview();
  renderRecipeList(document.getElementById("recipeSearch")?.value||"");
  renderRecipeDetail();
  renderCostCards();
  renderPricing();
  renderIngredients();
  renderCleanup();
  renderBrain();
  bindControls();
}
async function init(){
  let live=false,msg="";
  try{await loadBackendData();live=true}catch(e){console.warn(e);msg=e.message}
  renderStatus(live,msg);
  renderAll();
  document.getElementById("recipeSearch")?.addEventListener("input",e=>renderRecipeList(e.target.value));
  document.getElementById("refreshButton")?.addEventListener("click",()=>window.location.reload());
  document.getElementById("printTodayButton")?.addEventListener("click",()=>window.print());
  document.getElementById("brainButton")?.addEventListener("click",()=>renderBrain());
}
init();
