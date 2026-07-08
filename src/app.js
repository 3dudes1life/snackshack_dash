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
    .filter(word=>!["cookie","cookies","treat","treats","soft","chewy","bakery","style","and","the","a","an","of","with","one","batch","batches","recipe","photo","google","sheet","cost","costs","pan","9x12","jumbo"].includes(word));
}
function smartKey(value){return titleWords(value).join("");}
function tokenScore(a,b){
  const aw=[...new Set(titleWords(a))], bw=[...new Set(titleWords(b))];
  if(!aw.length || !bw.length) return 0;
  const shared=aw.filter(w=>bw.includes(w)).length;
  return shared/Math.max(aw.length,bw.length);
}
const MANUAL_MATCHES={
  chocolatechipcookies:["chocolatechip","classicchocolatechip","chocolatechipcookies"],
  brownbutterchocolatechip:["brownbutterchocolatechip","brownbutterchocchip","chewybrownbutterchocolatechip"],
  doublechocolatechip:["doublechocolatechip","doublechocolatechipcookies"],
  greenmintchocolatechip:["greenmintchocolatechip","greenmintchocoloatechip"],
  whitechocolatemacadamianut:["whitechocolatemacadamianut","whitechocmacadamianut","whitechocolatemacadamianutcookies"],
  oatmealraisin:["oatmealraisin","bakeryoatmealraisin"],
  molasses:["molasses","gingermolasses","softgingermolasses"],
  softsprinkle:["softsprinkle","sprinkle","softsprinklecookies","sugarsprinkle"],
  pumpkinsnickerdoodle:["pumpkinsnickerdoodle"],
  peanutbutter:["peanutbutter","softchewypeanutbutter"],
  redvelvet:["redvelvet"],
  thumbprint:["thumbprint","thumbprintcookies"],
  nannypoundcake:["nannypoundcake","poundcake"],
  blackberryjam:["blackberryjam","blackberry"],
  ricekrispietreats:["ricekrispietreats","ricekrispie","ricekrispietreats9x12pan","ricekrispietreat"],
  monster:["monster","monstercookies"]
};
function matchingKeysForRecipe(recipe){
  const names=[recipe.name,...(recipe.aliases||[])];
  const keys=new Set();
  names.forEach(name=>{
    const key=smartKey(name);
    keys.add(key);
    if(MANUAL_MATCHES[key]) MANUAL_MATCHES[key].forEach(k=>keys.add(k));
  });
  return [...keys].filter(Boolean);
}

let dashboardData={products:[],ingredients:[],orders:[],customers:[]};
const bakedRecipes=window.CDAWG_RECIPE_LIBRARY||[];
let selectedRecipeKey="";
const batchState=loadBatchState();
const priceState=loadPriceState();

const DEFAULT_SELL_PRICE_PER_DOZEN = 18;
const DEFAULT_SELL_PRICE_EACH = 2;

function loadBatchState(){try{return JSON.parse(localStorage.getItem("cdawgBatchState")||"{}")}catch(e){return{}}}
function saveBatchState(){localStorage.setItem("cdawgBatchState",JSON.stringify(batchState));}
function loadPriceState(){try{return JSON.parse(localStorage.getItem("cdawgPriceState")||"{}")}catch(e){return{}}}
function savePriceState(){localStorage.setItem("cdawgPriceState",JSON.stringify(priceState));}

function getBatchOverride(key,fallback=1){
  const value=number(batchState[key]);
  return value>0?value:number(fallback)||1;
}
function setBatchOverride(key,value){
  batchState[key]=Math.max(1,number(value));
  saveBatchState();
}
function getSellPrice(r){
  const stored=number(priceState[r.key]);
  if(stored>0) return stored;
  const yieldNum=extractYieldNumber(r.costProduct?.yieldLabel||r.yield);
  if(yieldNum>=6) return DEFAULT_SELL_PRICE_PER_DOZEN;
  return DEFAULT_SELL_PRICE_EACH;
}
function setSellPrice(key,value){
  priceState[key]=Math.max(0,number(value));
  savePriceState();
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
function findCostProduct(r){
  const products=dashboardData.products||[];
  const recipeKeys=matchingKeysForRecipe(r);
  let found=products.find(p=>{
    const productKeys=[smartKey(p.name), smartKey(p.sku), norm(p.name), norm(p.sku)].filter(Boolean);
    return recipeKeys.some(rk=>productKeys.some(pk=>pk===rk || pk.includes(rk) || rk.includes(pk)));
  });
  if(found) return found;

  let best=null, bestScore=0;
  products.forEach(p=>{
    [p.name,p.sku].filter(Boolean).forEach(pn=>{
      [r.name,...(r.aliases||[])].forEach(rn=>{
        const score=tokenScore(rn,pn);
        if(score>bestScore){bestScore=score;best=p;}
      });
    });
  });
  return bestScore>=0.58 ? best : null;
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
function selectedBatches(r){return getBatchOverride(r.key, sheetBatches(r.costProduct))}
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
  const price=getSellPrice(r);
  const y=productionYield(r);
  if(unitLabel(r)==="jars" || unitLabel(r)==="pan") return price*selectedBatches(r);
  return (y/12)*price;
}
function estimatedProfit(r){return estimatedRevenue(r)-batchCostForRecipe(r)}
function flags(p){return p?(p.recipe||[]).filter(l=>number(l.amount)<=0||number(l.ingredientCost)<=0).length:0}
function activeRecipe(){const all=mergedRecipes();return all.find(r=>r.key===selectedRecipeKey)||all[0];}

function scaleAmountText(text,batches){
  const value=number(text);
  if(!value) return text;
  const scaled=value*batches;
  if(Math.abs(scaled-Math.round(scaled))<.001) return String(Math.round(scaled));
  return scaled.toFixed(2).replace(/\.?0+$/,"");
}
function scaledIngredientText(raw,batches){
  const text=String(raw||"");
  return text.replace(/^(\s*)(\d+(?:\.\d+)?)(\s+)/,(_,pre,num,space)=>pre+scaleAmountText(num,batches)+space);
}
function pRecipeLinesForScaledIngredients(r){
  const p=r.costProduct;
  if(!p || !(p.recipe||[]).length){
    return (r.ingredients||[]).map(item=>scaledIngredientText(item,selectedBatches(r)));
  }
  const sheetBatch=sheetBatches(p);
  const multiplier=selectedBatches(r)/sheetBatch;
  return (p.recipe||[]).map(line=>{
    const amt=(number(line.amount)*multiplier);
    const pretty=amt?amt.toFixed(2).replace(/\.?0+$/,""):"";
    return `${pretty} ${line.unit||""} ${line.ingredient}`.trim();
  });
}

function batchControlHtml(r, compact=false){
  const current=selectedBatches(r);
  return `<div class="batch-control ${compact?"compact":""}" data-key="${r.key}">
    <button type="button" data-action="minus" aria-label="Decrease batches">−</button>
    <label><span>Batches</span><input type="number" min="1" step="1" value="${current}" data-action="input"></label>
    <button type="button" data-action="plus" aria-label="Increase batches">+</button>
  </div>`;
}
function priceControlHtml(r){
  return `<label class="price-control" data-key="${r.key}">
    <span>Sell / dozen or batch</span>
    <input type="number" min="0" step="0.01" value="${getSellPrice(r).toFixed(2)}">
  </label>`;
}
function bindControls(){
  document.querySelectorAll(".batch-control").forEach(control=>{
    const key=control.dataset.key;
    control.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const current=getBatchOverride(key,1);
        setBatchOverride(key, btn.dataset.action==="plus"?current+1:Math.max(1,current-1));
        renderAll();
      });
    });
    const input=control.querySelector("input");
    input?.addEventListener("change",()=>{setBatchOverride(key,input.value);renderAll();});
  });
  document.querySelectorAll(".price-control").forEach(control=>{
    const key=control.dataset.key;
    const input=control.querySelector("input");
    input?.addEventListener("change",()=>{setSellPrice(key,input.value);renderAll();});
  });
}

function renderStatus(live,msg){
  const all=mergedRecipes();
  if(!selectedRecipeKey && all[0]) selectedRecipeKey=all[0].key;
  document.getElementById("statusTitle").textContent=live?`${all.length} recipes ready for Caleb`:`${all.length} recipes loaded`;
  document.getElementById("statusMessage").textContent=live?`${dashboardData.ingredients.length} ingredient costs connected. Cook Mode now scales ingredients only.`:(msg||"Built-in recipe cards are loaded.");
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
    ["Batches",all.reduce((s,r)=>s+selectedBatches(r),0),"Selected today"],
    ["Yield",Math.round(totalYield),"Projected items"],
    ["Cost",money(productionCost),"Production estimate"],
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
  document.getElementById("recipeList").innerHTML=all.map(r=>{
    return`
      <button class="recipe-row ${r.key===selectedRecipeKey?"active":""}" data-key="${r.key}">
        <span>
          <b>${r.name}</b>
          <small>${selectedBatches(r)} batch • ${Math.round(productionYield(r))} ${unitLabel(r)}</small>
        </span>
        <em class="${r.costProduct?"linked":"text"}">${r.costProduct?"Cost":"Text"}</em>
      </button>`;
  }).join("");
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
        <p class="eyebrow">${Math.round(productionYield(r))} ${unitLabel(r)}</p>
        <h3>${r.name}</h3>
        <p class="muted">Kitchen mode: no accounting, just scaled ingredients and steps.</p>
      </div>
      <div class="detail-side kitchen-side">
        ${batchControlHtml(r)}
        <div class="kitchen-yield-card">
          <span>Making</span>
          <strong>${selectedBatches(r)} batch${selectedBatches(r)===1?"":"es"}</strong>
          <small>${Math.round(productionYield(r))} ${unitLabel(r)} estimated</small>
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
  document.getElementById("recipeCards").innerHTML=all.map(r=>{
    const cost=batchCostForRecipe(r), revenue=estimatedRevenue(r), profit=estimatedProfit(r), y=productionYield(r);
    return`
      <article class="cost-card ${!r.costProduct||cost<=0?"needs-cleanup":""}">
        <div class="cost-top">
          <div>
            <p class="eyebrow">${selectedBatches(r)} ${selectedBatches(r)===1?"batch":"batches"}</p>
            <h3>${r.name}</h3>
            <span>${Math.round(y)} ${unitLabel(r)} planned</span>
          </div>
          <strong>${money(cost)}</strong>
        </div>
        ${batchControlHtml(r,true)}
        ${priceControlHtml(r)}
        <div class="cost-stats business-stats">
          <span><small>Revenue</small><b>${money(revenue)}</b></span>
          <span><small>Profit</small><b>${money(profit)}</b></span>
          <span><small>Margin</small><b>${revenue?Math.round((profit/revenue)*100):0}%</b></span>
        </div>
        <details>
          <summary>${r.costProduct?"Ingredient cost breakdown":"No sheet match yet"}</summary>
          ${r.costProduct?(r.costProduct.recipe||[]).map(l=>`<p><b>${l.ingredient}</b><span>${number(l.amount).toFixed(2)} ${l.unit||""} • ${money(l.ingredientCost)}</span></p>`).join(""):`<p><b>Recipe text loaded.</b><span>Add matching cost rows.</span></p>`}
        </details>
      </article>`;
  }).join("");
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
    if(!p) return;
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
  const rows=mergedRecipes().map(r=>({r,p:r.costProduct,f:flags(r.costProduct),cost:batchCostForRecipe(r)})).filter(x=>!x.p||x.f>0||x.cost<=0).sort((a,b)=>(b.f-a.f)||(a.cost-b.cost));
  document.getElementById("cleanupList").innerHTML=rows.length?rows.map(x=>`
    <div class="list-row">
      <div><strong>${x.r.name}</strong><span>${!x.p?"No sheet match found yet":`${x.f} zero amount/cost lines • ${selectedBatches(x.r)} batch • ${money(x.cost)}`}</span></div>
      <em class="${x.p&&x.cost>0?"warn":"bad"}">${x.p?"Review":"Link"}</em>
    </div>`).join(""):`<div class="empty-state">No obvious cleanup flags.</div>`;
  const all=mergedRecipes();
  const high=[...all].filter(r=>costEach(r)>0).sort((a,b)=>costEach(b)-costEach(a))[0];
  const low=[...all].filter(r=>costEach(r)>0).sort((a,b)=>costEach(a)-costEach(b))[0];
  document.getElementById("costExtremes").innerHTML=[
    high&&["Most expensive",high.name,`${money(costEach(high))}/item • ${money(costDozen(high))}/dozen`],
    low&&["Least expensive",low.name,`${money(costEach(low))}/item • ${money(costDozen(low))}/dozen`],
    ["Production cost",money(all.reduce((s,r)=>s+batchCostForRecipe(r),0)),"All selected batches"],
    ["Projected profit",money(all.reduce((s,r)=>s+estimatedProfit(r),0)),"Using current sell prices"]
  ].filter(Boolean).map(x=>`<div class="list-row"><div><strong>${x[0]}</strong><span>${x[2]}</span></div><b>${x[1]}</b></div>`).join("");
}
function buildBrain(){
  const all=mergedRecipes();
  const productionCost=all.reduce((s,r)=>s+batchCostForRecipe(r),0);
  const revenue=all.reduce((s,r)=>s+estimatedRevenue(r),0);
  const zeroCost=all.filter(r=>!r.costProduct||batchCostForRecipe(r)<=0);
  const ingredientTotals=buildIngredientTotals().slice(0,18);
  const recs=[];
  if(zeroCost.length) recs.push({type:"warning",title:"Finish cost linking",text:`${zeroCost.length} recipes still need usable cost matches before profit is fully real.`});
  const high=[...all].filter(r=>costEach(r)>0).sort((a,b)=>costEach(b)-costEach(a))[0];
  if(high) recs.push({type:"money",title:"Most expensive to make",text:`${high.name} is ${money(costEach(high))} per item. Price carefully or bundle intentionally.`});
  const topBatch=[...all].sort((a,b)=>selectedBatches(b)-selectedBatches(a))[0];
  if(topBatch && selectedBatches(topBatch)>1) recs.push({type:"success",title:"Main production focus",text:`${topBatch.name} has ${selectedBatches(topBatch)} batches selected. Start prep here if it needs cooling or chilling.`});
  recs.push({type:"success",title:"Kitchen mode is cleaner",text:"Cook Mode now only shows scaled ingredients and steps. Costs live in Production Costs where they belong."});
  return {all,productionCost,revenue,profit:revenue-productionCost,zeroCost,ingredientTotals,recs};
}
function renderBrain(){
  const brain=buildBrain();
  document.getElementById("brainSummary").innerHTML=`
    <article><span>Production Cost</span><strong>${money(brain.productionCost)}</strong><small>selected batches</small></article>
    <article><span>Projected Revenue</span><strong>${money(brain.revenue)}</strong><small>editable sell prices</small></article>
    <article><span>Projected Profit</span><strong>${money(brain.profit)}</strong><small>cost planner estimate</small></article>
    <article><span>Cleanup</span><strong>${brain.zeroCost.length}</strong><small>cost links to finish</small></article>
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
        <h2>Ingredients Needed for Selected Batches</h2>
        <p class="muted">Based on current batch counts. This is the kitchen shopping/prep view.</p>
      </div>
    </div>
    <div class="shopping-grid">
      ${brain.ingredientTotals.length?brain.ingredientTotals.map(item=>`
        <article>
          <b>${item.name}</b>
          <span>${item.amount.toFixed(2).replace(/\.?0+$/,"")} ${item.unit}</span>
          <small>${money(item.cost)} planned cost</small>
        </article>
      `).join(""):`<div class="empty-state">No ingredient totals yet because costed recipes are not linked.</div>`}
    </div>
  `;
}
function renderAll(){
  renderOverview();
  renderRecipeList(document.getElementById("recipeSearch")?.value||"");
  renderRecipeDetail();
  renderCostCards();
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
