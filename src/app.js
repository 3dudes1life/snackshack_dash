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
      "photo","google","sheet","cost","costs","pan","9x12","jumbo","single","pack","dozen","dozens","twelve","six","half","xl","medium","mini","large","extra","available","made","fresh","order","orders","pickup","delivery"
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

let dashboardData={products:[],ingredients:[],orders:[],customers:[],squareInvoices:[],squareCatalog:[],squareInventory:[],squareStatus:'not_connected',squareMessage:''};
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
    ingredients:Array.isArray(live.ingredients)?live.ingredients:[],
    orders:Array.isArray(live.orders)?live.orders:[],
    customers:Array.isArray(live.customers)?live.customers:[],
    squareInvoices:Array.isArray(live.squareInvoices)?live.squareInvoices:[],
    squareCatalog:Array.isArray(live.squareCatalog)?live.squareCatalog:[],
    squareInventory:Array.isArray(live.squareInventory)?live.squareInventory:[],
    squareStatus:live.squareStatus||"unknown",
    squareMessage:live.squareMessage||""
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
  const orderSummary=squareOrderSummary();
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

/* ---------------- Brain 7.0 Order Hub ---------------- */

function orderStatus(order){
  return String(order.status || order.state || "OPEN").toUpperCase();
}
function isOpenOrder(order){
  const status=orderStatus(order);
  return !["COMPLETED","CANCELED","CANCELLED","REFUNDED","FAILED"].includes(status);
}
function orderDate(order){
  return order.createdAt || order.created_at || order.updatedAt || order.updated_at || "";
}
function formatDateShort(value){
  if(!value) return "";
  const d=new Date(value);
  if(isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined,{month:"short",day:"numeric"})+" "+d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
}
function orderTotal(order){
  return number(order.total || order.totalMoney || order.amount || order.grandTotal || 0);
}
function orderItems(order){
  const items=order.items || order.lineItems || order.line_items || [];
  return items.map(item=>({
    name:item.name || item.title || item.variationName || item.variation_name || "Unknown item",
    quantity:number(item.quantity || item.qty || 1) || 1,
    total:number(item.total || item.amount || item.totalMoney || 0),
    variationName:item.variationName || item.variation_name || "",
    catalogObjectId:item.catalogObjectId || item.catalog_object_id || "",
    raw:item
  }));
}
function allSquareOrders(){
  return Array.isArray(dashboardData.orders) ? dashboardData.orders : [];
}
function allSquareInvoices(){
  return Array.isArray(dashboardData.squareInvoices) ? dashboardData.squareInvoices : [];
}
function invoiceStatus(invoice){
  return String(invoice.status || invoice.state || "DRAFT").toUpperCase();
}
function isOpenInvoice(invoice){
  const status=invoiceStatus(invoice);
  return !["PAID","CANCELED","CANCELLED","REFUNDED","FAILED"].includes(status);
}
function openSquareInvoices(){
  return allSquareInvoices().filter(isOpenInvoice);
}
function invoiceTotal(invoice){
  return number(invoice.total || invoice.totalMoney || invoice.amount || invoice.balance || 0);
}
function invoiceDate(invoice){
  return invoice.createdAt || invoice.created_at || invoice.updatedAt || invoice.updated_at || invoice.dueDate || "";
}
function invoiceItems(invoice){
  const items=invoice.items || invoice.lineItems || invoice.line_items || [];
  if(!items.length && (invoice.title || invoice.description)){
    return [{
      name: invoice.title || invoice.description || "Invoice item",
      quantity: 1,
      total: invoiceTotal(invoice),
      variationName: "",
      catalogObjectId: "",
      raw: invoice
    }];
  }
  return items.map(item=>({
    name:item.name || item.description || item.title || "Invoice item",
    quantity:number(item.quantity || item.qty || 1) || 1,
    total:number(item.total || item.amount || item.totalMoney || 0),
    variationName:item.variationName || "",
    catalogObjectId:item.catalogObjectId || "",
    raw:item
  }));
}
function combinedOpenSquareDocuments(){
  const orders=openSquareOrders().map(o=>({...o, docType:"Order"}));
  const invoices=openSquareInvoices().map(i=>({...i, docType:"Invoice"}));
  return [...orders, ...invoices];
}
function openSquareOrders(){
  return allSquareOrders().filter(isOpenOrder);
}
function completedSquareOrders(){
  return allSquareOrders().filter(o=>orderStatus(o)==="COMPLETED");
}
function matchRecipeFromOrderItem(item){
  const fake={name:item.name, aliases:[item.name,item.variationName].filter(Boolean)};
  const p=findCostProduct(fake);
  if(p){
    const recipe=mergedRecipes().find(r=>r.costProduct===p || norm(r.costProduct?.name)===norm(p.name));
    if(recipe) return recipe;
  }

  let best=null, bestScore=0;
  mergedRecipes().forEach(r=>{
    const names=[r.name,...(r.aliases||[])];
    names.forEach(name=>{
      const score=tokenScore(item.name,name);
      if(score>bestScore){bestScore=score;best=r;}
    });
  });
  return bestScore>=0.42 ? best : null;
}
function buildOrderDemand(){
  const rows={};
  combinedOpenSquareDocuments().forEach(order=>{
    const items = order.docType === 'Invoice' ? invoiceItems(order) : orderItems(order);
    items.forEach(item=>{
      const recipe=matchRecipeFromOrderItem(item);
      const key=recipe ? recipe.key : norm(item.name);
      if(!rows[key]){
        rows[key]={
          key,
          recipe,
          name:recipe ? recipe.name : item.name,
          quantity:0,
          revenue:0,
          orders:new Set(),
          unmatched:!recipe
        };
      }
      rows[key].quantity += item.quantity;
      rows[key].revenue += item.total;
      rows[key].orders.add(order.id || order.orderId || order.name || "Square");
    });
  });
  return Object.values(rows)
    .map(row=>({...row, orderCount:row.orders.size}))
    .sort((a,b)=>b.quantity-a.quantity || b.revenue-a.revenue);
}
function squareOrderSummary(){
  const orders=allSquareOrders();
  const invoices=allSquareInvoices();
  const open=openSquareOrders();
  const openInvoices=openSquareInvoices();
  const combinedOpen=combinedOpenSquareDocuments();
  const completed=completedSquareOrders();
  const openRevenue=open.reduce((s,o)=>s+orderTotal(o),0);
  const openInvoiceRevenue=openInvoices.reduce((s,i)=>s+invoiceTotal(i),0);
  const totalRevenue=orders.reduce((s,o)=>s+orderTotal(o),0);
  const totalInvoiceRevenue=invoices.reduce((s,i)=>s+invoiceTotal(i),0);
  const demand=buildOrderDemand();
  return {orders,invoices,open,openInvoices,combinedOpen,completed,openRevenue,openInvoiceRevenue,totalRevenue,totalInvoiceRevenue,demand};
}
function renderOrderHub(){
  const summary=squareOrderSummary();
  const status=String(dashboardData.squareStatus || (summary.orders.length ? "connected" : "not_connected"));
  const message=dashboardData.squareMessage || ((summary.orders.length || summary.invoices.length) ? "Square data loaded." : "No Square orders or invoices returned yet.");

  const orderCountPill=document.getElementById("orderCountPill");
  if(orderCountPill) orderCountPill.textContent=`${summary.orders.length + summary.invoices.length} docs`;

  const squareStatus=document.getElementById("squareStatus");
  if(squareStatus) {
    squareStatus.innerHTML=`
      <div class="status-dot ${status}"></div>
      <div>
        <b>${message.includes("UrlFetchApp.fetch") ? "Square authorization needed" : `Square ${status.replace(/_/g," ")}`}</b>
        <span>${message}</span>
        ${message.includes("UrlFetchApp.fetch") ? `<span class="auth-help">Run authorizeSquareFetch_ inside Apps Script editor, approve permissions, then redeploy a new version.</span>` : ""}
      </div>
      <small>${dashboardData.squareCatalog?.length||0} catalog records</small>
    `;
  }

  const orderSummary=document.getElementById("orderSummary");
  if(orderSummary){
    orderSummary.innerHTML=[
      ["Open Orders",summary.open.length,"Pending / active"],
      ["Open Invoices",summary.openInvoices.length,"Unpaid / active"],
      ["Open Value",money(summary.openRevenue + summary.openInvoiceRevenue),"Orders + invoices"],
      ["30-Day Orders",summary.orders.length,"Returned by backend"],
      ["Invoices",summary.invoices.length,"Returned by backend"],
      ["30-Day Value",money(summary.totalRevenue + summary.totalInvoiceRevenue),"Orders + invoices"],
      ["Demand Groups",summary.demand.length,"Matched line items"],
      ["Catalog Items",dashboardData.squareCatalog?.length||0,"Square retail layer"]
    ].map(([label,value,detail])=>`
      <article>
        <span>${label}</span>
        <strong>${value}</strong>
        <small>${detail}</small>
      </article>
    `).join("");
  }

  const openPill=document.getElementById("openOrderPill");
  if(openPill) openPill.textContent=`${summary.open.length + summary.openInvoices.length} open`;

  const openOrders=document.getElementById("openOrders");
  if(openOrders){
    openOrders.innerHTML=summary.combinedOpen.length ? summary.combinedOpen.slice(0,12).map(order=>{
      const items=order.docType === 'Invoice' ? invoiceItems(order) : orderItems(order);
      return `
        <article class="order-card">
          <div class="order-card-top">
            <div>
              <b>${order.customer || order.customerName || "Square Customer"}</b>
              <span>${formatDateShort(orderDate(order)) || "Date pending"}</span>
            </div>
            <strong>${money(orderTotal(order))}</strong>
          </div>
          <p><em>${order.docType || 'Order'} · ${order.docType === 'Invoice' ? invoiceStatus(order) : orderStatus(order)}</em> <small>${order.id || ""}</small></p>
          <ul>${items.map(item=>`<li><span>${item.quantity}× ${item.name}</span><b>${money(item.total)}</b></li>`).join("")}</ul>
        </article>`;
    }).join("") : `<div class="empty-state">No pending/open Square orders or invoices right now.</div>`;
  }

  const demandPill=document.getElementById("demandPill");
  if(demandPill) demandPill.textContent=`${summary.demand.reduce((s,r)=>s+r.quantity,0)} items`;

  const demand=document.getElementById("orderDemand");
  if(demand){
    const rows=productionDemandBatches();
    demand.innerHTML=rows.length ? `
      <button type="button" class="apply-demand-btn" id="applyDemandButton">Send demand to Production Planner</button>
      ${rows.map(row=>`
        <article class="demand-card ${row.unmatched?"unmatched":""}">
          <div>
            <b>${row.name}</b>
            <span>${row.quantity} ordered across ${row.orderCount} order${row.orderCount===1?"":"s"}</span>
          </div>
          <strong>${row.unmatched ? "Match needed" : `${row.batches} batch${row.batches===1?"":"es"}`}</strong>
          <small>${row.unmatched ? "Add alias or matching recipe/product name" : `Yield ${Math.round(row.yieldOne)} each batch · est cost ${money(row.recipeCost)}`}</small>
        </article>`).join("")}` : `<div class="empty-state">No production demand yet.</div>`;
    document.getElementById("applyDemandButton")?.addEventListener("click",applyDemandToProductionPlanner);
  }
}



function productionDemandBatches(){
  return buildOrderDemand().map(row=>{
    const yieldOne=row.recipe ? yieldPerSingleBatch(row.recipe) : 0;
    const batches=yieldOne ? Math.ceil(row.quantity/yieldOne) : 0;
    const recipeCost=row.recipe ? singleBatchCost(row.recipe.costProduct)*batches : 0;
    return {...row,yieldOne,batches,recipeCost};
  });
}
function demandProductionCost(){
  return productionDemandBatches().reduce((s,row)=>s+number(row.recipeCost),0);
}
function openSquareValue(){
  const summary=squareOrderSummary();
  return summary.openRevenue + summary.openInvoiceRevenue;
}
function orderHubProfitEstimate(){
  return openSquareValue() - demandProductionCost();
}
function marginFromProfit(profit,revenue){
  return revenue>0 ? (profit/revenue)*100 : 0;
}
function buildPriorityItems(){
  const summary=squareOrderSummary();
  const demand=productionDemandBatches();
  const unmatched=demand.filter(row=>row.unmatched);
  const matched=demand.filter(row=>!row.unmatched && row.batches>0);
  const revenue=openSquareValue();
  const cost=demandProductionCost();
  const profit=revenue-cost;
  const margin=marginFromProfit(profit,revenue);
  const ingredients=buildDemandIngredientTotals().slice(0,12);

  const items=[];
  if(summary.combinedOpen.length){
    items.push({
      label:"Square Work",
      title:`${summary.combinedOpen.length} open order/invoice item${summary.combinedOpen.length===1?"":"s"}`,
      detail:`${money(revenue)} open value waiting for Caleb.`,
      tone:"hot"
    });
  } else {
    items.push({
      label:"Square Work",
      title:"No open Square work",
      detail:"Order Hub is connected and waiting for the next order/invoice.",
      tone:"calm"
    });
  }
  if(matched.length){
    items.push({
      label:"Bake First",
      title:matched.slice(0,4).map(row=>`${row.batches}× ${row.name}`).join(" · "),
      detail:`Demand engine matched ${matched.length} recipe group${matched.length===1?"":"s"}.`,
      tone:"success"
    });
  }
  if(unmatched.length){
    items.push({
      label:"Needs Match",
      title:unmatched.slice(0,3).map(row=>row.name).join(" · "),
      detail:"Add recipe aliases or align Square names so Brain can batch these.",
      tone:"warn"
    });
  }
  if(revenue>0){
    items.push({
      label:"Order Profit",
      title:`${money(profit)} est. profit · ${percent(margin)} margin`,
      detail:`Based on ${money(cost)} estimated recipe production cost.`,
      tone: margin>=65 ? "success" : margin>=45 ? "calm" : "warn"
    });
  }
  if(ingredients.length){
    items.push({
      label:"Prep Pull",
      title:ingredients.slice(0,5).map(i=>`${i.amount.toFixed(1).replace(/\.0$/,"")} ${i.unit} ${i.name}`).join(" · "),
      detail:"Ingredient prep based on live Square demand only.",
      tone:"calm"
    });
  }
  return items;
}
function buildDemandIngredientTotals(){
  const totals={};
  productionDemandBatches().forEach(row=>{
    if(row.unmatched || !row.recipe || row.batches<=0) return;
    const p=row.recipe.costProduct;
    if(!p) return;
    const sheetBatch=sheetBatches(p);
    const multiplier=row.batches/sheetBatch;
    (p.recipe||[]).forEach(line=>{
      const name=line.ingredient||"Unknown";
      const unit=line.unit||"";
      const key=`${name}__${unit}`;
      if(!totals[key]) totals[key]={name,unit,amount:0,cost:0};
      totals[key].amount += number(line.amount)*multiplier;
      totals[key].cost += number(line.ingredientCost)*multiplier;
    });
  });
  return Object.values(totals).filter(x=>x.amount>0).sort((a,b)=>b.cost-a.cost);
}
function applyDemandToProductionPlanner(){
  const all=mergedRecipes();
  all.forEach(r=>productionBatchState[r.key]=0);
  productionDemandBatches().forEach(row=>{
    if(row.recipe && row.batches>0) productionBatchState[row.recipe.key]=row.batches;
  });
  saveProductionBatchState();
  renderAll();
}

function percent(value){
  if(!isFinite(value)) return "0%";
  return `${value.toFixed(1).replace(/\.0$/,"")}%`;
}
function buildBrain(){
  const all=mergedRecipes();
  const planned=all.filter(r=>selectedBatches(r)>0);
  const orderSummary=squareOrderSummary();
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
  const demandRows=productionDemandBatches();
  const demandCost=demandProductionCost();
  const orderValue=openSquareValue();
  const orderProfit=orderHubProfitEstimate();
  const orderMargin=marginFromProfit(orderProfit,orderValue);
  if(orderSummary.combinedOpen.length){
    recs.push({
      type:"success",
      title:"Today’s Square action",
      text:`${orderSummary.open.length} order${orderSummary.open.length===1?"":"s"} and ${orderSummary.openInvoices.length} invoice${orderSummary.openInvoices.length===1?"":"s"} are open. Estimated order profit is ${money(orderProfit)} at ${percent(orderMargin)} margin.`
    });
  } else {
    recs.push({
      type:"money",
      title:"Order Hub ready",
      text:"No open Square orders right now. When pending orders appear, Brain 7.0 will turn them into production batches and prep needs."
    });
  }
  if(demandRows.length){
    const matched=demandRows.filter(r=>!r.unmatched);
    const topDemand=demandRows[0];
    recs.push({
      type: topDemand.unmatched ? "warning" : "success",
      title:"Production demand",
      text: topDemand.unmatched ? `${topDemand.name} needs a recipe match.` : `${matched.slice(0,4).map(r=>`${r.batches}× ${r.name}`).join(", ")}.`
    });
    recs.push({
      type:"money",
      title:"Demand prep cost",
      text:`Live Square demand needs about ${money(demandCost)} in ingredients before packaging/labor.`
    });
  }
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
  recs.push({type:"success",title:"Square-safe pricing logic",text:"Brain 7.0 keeps Corporate DZ and Square Retail pricing separate, compares both channels, and stays ready for live Square orders without overwriting your pricing strategy."});

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
    <article><span>Open Square</span><strong>${squareOrderSummary().combinedOpen.length}</strong><small>${money(openSquareValue())} pending</small></article>
    <article><span>Demand Cost</span><strong>${money(demandProductionCost())}</strong><small>from Square demand</small></article>
    <article><span>Demand Profit</span><strong>${money(orderHubProfitEstimate())}</strong><small>${percent(marginFromProfit(orderHubProfitEstimate(),openSquareValue()))} margin</small></article>
    <article><span>Planner Cost</span><strong>${money(brain.productionCost)}</strong><small>manual planner batches</small></article>
    <article><span>Active Revenue</span><strong>${money(brain.activeRevenue)}</strong><small>selected pricing modes</small></article>
    <article><span>Active Profit</span><strong>${money(brain.activeProfit)}</strong><small>projected net</small></article>
    <article><span>Active Margin</span><strong>${percent(brain.activeMargin)}</strong><small>profit ÷ revenue</small></article>
    <article><span>Corporate Profit</span><strong>${money(brain.corpProfit)}</strong><small>${percent(brain.corpMargin)} margin</small></article>
    <article><span>Square DZ Profit</span><strong>${money(brain.squareDzProfit)}</strong><small>${percent(brain.squareDzMargin)} margin</small></article>
    <article><span>Square Each Profit</span><strong>${money(brain.squareEachProfit)}</strong><small>${percent(brain.squareEachMargin)} margin</small></article>
    <article><span>Profit / Dozen</span><strong>${money(brain.avgProfitPerDozen)}</strong><small>active pricing</small></article>
  `;
  const priority=document.getElementById("priorityList");
  if(priority){
    priority.innerHTML=`
      <div class="priority-head">
        <div>
          <p class="eyebrow">Brain 7.0</p>
          <h3>Caleb’s Today List</h3>
        </div>
        <button type="button" id="priorityApplyDemand">Send Square demand to planner</button>
      </div>
      <div class="priority-grid">
        ${buildPriorityItems().map(item=>`
          <article class="${item.tone}">
            <span>${item.label}</span>
            <b>${item.title}</b>
            <small>${item.detail}</small>
          </article>
        `).join("")}
      </div>
    `;
    document.getElementById("priorityApplyDemand")?.addEventListener("click",applyDemandToProductionPlanner);
  }
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
  renderOrderHub();
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
  document.getElementById("brainButton")?.addEventListener("click",()=>{renderBrain();renderOrderHub();});
}
init();
