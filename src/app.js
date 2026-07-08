const money=v=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD"});
const number=v=>Number(v||0)||0;
const norm=v=>String(v||"").toLowerCase().replace(/[^a-z0-9]+/g,"");

let dashboardData={products:[],ingredients:[],orders:[],customers:[]};
const bakedRecipes=window.CDAWG_RECIPE_LIBRARY||[];
let selectedRecipeKey="";
const batchState=loadBatchState();

function loadBatchState(){
  try{return JSON.parse(localStorage.getItem("cdawgBatchState")||"{}")}catch(e){return{}}
}
function saveBatchState(){
  localStorage.setItem("cdawgBatchState",JSON.stringify(batchState));
}
function getBatchOverride(key,fallback=1){
  const value=number(batchState[key]);
  return value>0?value:number(fallback)||1;
}
function setBatchOverride(key,value){
  batchState[key]=Math.max(0,number(value));
  if(batchState[key]===0) batchState[key]=1;
  saveBatchState();
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
  const names=[r.name,...(r.aliases||[])].map(norm);
  return (dashboardData.products||[]).find(p=>{
    const ps=[p.name,p.sku].map(norm);
    return names.some(n=>ps.includes(n))||ps.some(x=>names.includes(x));
  });
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
function sheetBatches(p){return p?number(p.batches)||1:1}
function baseBatchCost(p){
  return p?(number(p.totalBatchCost)||(p.recipe||[]).reduce((s,l)=>s+number(l.ingredientCost),0)):0;
}
function singleBatchCost(p){
  const sb=sheetBatches(p);
  return sb?baseBatchCost(p)/sb:baseBatchCost(p);
}
function selectedBatches(recipeOrProduct){
  const key=recipeOrProduct.key||norm(recipeOrProduct.name||recipeOrProduct.sku);
  return getBatchOverride(key, sheetBatches(recipeOrProduct.costProduct||recipeOrProduct));
}
function batchCostForRecipe(r){
  return singleBatchCost(r.costProduct)*selectedBatches(r);
}
function perCookieForRecipe(r){
  const p=r.costProduct;
  if(!p) return 0;
  const sheetYield=number(p.batchYieldUnits)||extractYieldNumber(r.yield);
  return sheetYield ? batchCostForRecipe(r)/sheetYield : 0;
}
function perDozenForRecipe(r){return perCookieForRecipe(r)*12}
function extractYieldNumber(yieldText){
  const found=String(yieldText||"").match(/[\d.]+/);
  return found?number(found[0]):0;
}
function flags(p){return p?(p.recipe||[]).filter(l=>number(l.amount)<=0||number(l.ingredientCost)<=0).length:0}
function pricedRecipes(){return mergedRecipes().filter(r=>batchCostForRecipe(r)>0||perCookieForRecipe(r)>0)}
function needs(){return mergedRecipes().filter(r=>!r.costProduct||batchCostForRecipe(r)<=0)}
function activeRecipe(){
  const all=mergedRecipes();
  return all.find(r=>r.key===selectedRecipeKey)||all[0];
}

function batchControlHtml(r, compact=false){
  const current=selectedBatches(r);
  return `<div class="batch-control ${compact?"compact":""}" data-key="${r.key}">
    <button type="button" data-action="minus" aria-label="Decrease batches">−</button>
    <label><span>Batches</span><input type="number" min="1" step="1" value="${current}" data-action="input"></label>
    <button type="button" data-action="plus" aria-label="Increase batches">+</button>
  </div>`;
}
function bindBatchControls(){
  document.querySelectorAll(".batch-control").forEach(control=>{
    const key=control.dataset.key;
    control.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const current=getBatchOverride(key,1);
        setBatchOverride(key, btn.dataset.action==="plus"?current+1:Math.max(1,current-1));
        renderAll(false);
      });
    });
    const input=control.querySelector("input");
    input?.addEventListener("change",()=>{
      setBatchOverride(key,input.value);
      renderAll(false);
    });
  });
}
function renderStatus(live,msg){
  const all=mergedRecipes();
  if(!selectedRecipeKey && all[0]) selectedRecipeKey=all[0].key;
  document.getElementById("statusTitle").textContent=live?`${all.length} recipes ready for Caleb`:`${all.length} recipes loaded`;
  document.getElementById("statusMessage").textContent=live?`${dashboardData.ingredients.length} ingredient costs connected. Batch counts can be changed on-screen.`:(msg||"Built-in recipe cards are loaded.");
}
function renderOverview(){
  const all=mergedRecipes();
  const p=pricedRecipes();
  const n=needs();
  const avg=p.length?p.reduce((s,x)=>s+perCookieForRecipe(x),0)/p.length:0;
  const totalProductionCost=all.reduce((s,r)=>s+batchCostForRecipe(r),0);
  const totalBatches=all.reduce((s,r)=>s+selectedBatches(r),0);
  const cards=[
    ["Cook Cards",all.length,"Recipes ready"],
    ["Production Batches",totalBatches,"Editable on-screen"],
    ["Production Cost",money(totalProductionCost),"Using batch controls"],
    ["Ingredients",dashboardData.ingredients.length,"Cost library"],
    ["Avg Cost/Cookie",money(avg),"Across costed recipes"],
    ["Needs Cleanup",n.length,"Zero-cost recipes"]
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
    const p=r.costProduct;
    return`
      <button class="recipe-row ${r.key===selectedRecipeKey?"active":""}" data-key="${r.key}">
        <span>
          <b>${r.name}</b>
          <small>${r.yield||"Yield TBD"}${p?` • ${selectedBatches(r)} batch • ${money(batchCostForRecipe(r))}`:""}</small>
        </span>
        <em class="${p?"linked":"text"}">${p?"Cost":"Text"}</em>
      </button>`;
  }).join("");
  document.querySelectorAll(".recipe-row").forEach(btn=>{
    btn.addEventListener("click",()=>{
      selectedRecipeKey=btn.dataset.key;
      renderRecipeList(document.getElementById("recipeSearch").value);
      renderRecipeDetail();
      bindBatchControls();
    });
  });
}
function renderRecipeDetail(){
  const r=activeRecipe();
  if(!r) return;
  const p=r.costProduct;
  document.getElementById("recipeDetail").innerHTML=`
    <div class="recipe-detail-head">
      <div>
        <p class="eyebrow">${r.yield||"Yield TBD"}</p>
        <h3>${r.name}</h3>
        <p class="muted">${r.source||""}</p>
      </div>
      <div class="detail-side">
        ${batchControlHtml(r)}
        <div class="detail-cost">
          <span>Production Cost</span>
          <strong>${money(batchCostForRecipe(r))}</strong>
          <small>${money(perCookieForRecipe(r))} each • ${money(perDozenForRecipe(r))}/dozen</small>
        </div>
      </div>
    </div>
    <div class="detail-grid">
      <section>
        <h4>Ingredients</h4>
        <ul class="check-list">
          ${(r.ingredients||[]).map(i=>`<li><label><input type="checkbox"><span>${i}</span></label></li>`).join("")}
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
    const p=r.costProduct;
    const cost=batchCostForRecipe(r), pc=perCookieForRecipe(r), pd=perDozenForRecipe(r), f=flags(p);
    return`
      <article class="cost-card ${!p||cost<=0?"needs-cleanup":""}">
        <div class="cost-top">
          <div>
            <p class="eyebrow">${p?`${selectedBatches(r)} ${selectedBatches(r)===1?"batch":"batches"}`:"text only"}</p>
            <h3>${r.name}</h3>
            <span>${p?(p.yieldLabel||r.yield):(r.yield||"Yield TBD")}</span>
          </div>
          <strong>${money(cost)}</strong>
        </div>
        ${batchControlHtml(r,true)}
        <div class="cost-stats">
          <span><small>Each</small><b>${money(pc)}</b></span>
          <span><small>Dozen</small><b>${money(pd)}</b></span>
          <span><small>Flags</small><b>${f}</b></span>
        </div>
        <details>
          <summary>${p?"Ingredient cost breakdown":"No sheet cost yet"}</summary>
          ${p?(p.recipe||[]).map(l=>`<p><b>${l.ingredient}</b><span>${number(l.amount).toFixed(2)} ${l.unit||""} • ${money(l.ingredientCost)}</span></p>`).join(""):`<p><b>Recipe text loaded.</b><span>Add matching cost rows.</span></p>`}
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
function renderCleanup(){
  const rows=mergedRecipes().map(r=>({r,p:r.costProduct,f:flags(r.costProduct),cost:batchCostForRecipe(r)})).filter(x=>!x.p||x.f>0||x.cost<=0).sort((a,b)=>(b.f-a.f)||(a.cost-b.cost));
  document.getElementById("cleanupList").innerHTML=rows.length?rows.map(x=>`
    <div class="list-row">
      <div><strong>${x.r.name}</strong><span>${!x.p?"Recipe text has no matching sheet cost yet":`${x.f} zero amount/cost lines • ${selectedBatches(x.r)} batch • ${money(x.cost)}`}</span></div>
      <em class="${x.p&&x.cost>0?"warn":"bad"}">${x.p?"Review":"Link"}</em>
    </div>`).join(""):`<div class="empty-state">No obvious cleanup flags.</div>`;
  const p=pricedRecipes();
  const high=[...p].sort((a,b)=>perCookieForRecipe(b)-perCookieForRecipe(a))[0],low=[...p].sort((a,b)=>perCookieForRecipe(a)-perCookieForRecipe(b))[0];
  document.getElementById("costExtremes").innerHTML=[
    high&&["Most expensive",high.name,`${money(perCookieForRecipe(high))}/cookie • ${money(perDozenForRecipe(high))}/dozen`],
    low&&["Least expensive",low.name,`${money(perCookieForRecipe(low))}/cookie • ${money(perDozenForRecipe(low))}/dozen`],
    ["Production cost",money(mergedRecipes().reduce((s,r)=>s+batchCostForRecipe(r),0)),"All selected batches"],
    ["Total batches",mergedRecipes().reduce((s,r)=>s+selectedBatches(r),0),"Across recipe cards"]
  ].filter(Boolean).map(x=>`<div class="list-row"><div><strong>${x[0]}</strong><span>${x[2]}</span></div><b>${x[1]}</b></div>`).join("");
}

function buildBrain(){
  const all=mergedRecipes();
  const costed=all.filter(r=>r.costProduct);
  const zeroCost=all.filter(r=>!r.costProduct || batchCostForRecipe(r)<=0);
  const flagged=all.filter(r=>r.costProduct && flags(r.costProduct)>0);
  const productionCost=all.reduce((s,r)=>s+batchCostForRecipe(r),0);
  const totalBatches=all.reduce((s,r)=>s+selectedBatches(r),0);
  const priced=costed.filter(r=>batchCostForRecipe(r)>0);
  const avgCookie=priced.length?priced.reduce((s,r)=>s+perCookieForRecipe(r),0)/priced.length:0;
  const expensive=[...priced].sort((a,b)=>perCookieForRecipe(b)-perCookieForRecipe(a)).slice(0,3);
  const bestValue=[...priced].sort((a,b)=>perCookieForRecipe(a)-perCookieForRecipe(b)).slice(0,3);

  const ingredientTotals={};
  all.forEach(r=>{
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

  const shopping=Object.values(ingredientTotals)
    .filter(x=>x.amount>0)
    .sort((a,b)=>b.cost-a.cost)
    .slice(0,14);

  const recommendations=[];
  if(zeroCost.length) recommendations.push({
    type:"danger",
    title:"Fix cost links first",
    text:`${zeroCost.length} recipes have no usable cost yet. Those will make profit and production totals lie. Start with ${zeroCost.slice(0,3).map(r=>r.name).join(", ")}.`
  });
  if(flagged.length) recommendations.push({
    type:"warning",
    title:"Clean ingredient mismatches",
    text:`${flagged.length} recipes have zero-cost ingredient lines. This is usually naming like Vanilla vs Pure Vanilla Extract or Sugar typos.`
  });
  if(totalBatches>18) recommendations.push({
    type:"warning",
    title:"Big production day",
    text:`You have ${totalBatches} batches selected. Caleb may need a prep list, cooling rack plan, and packaging check before starting.`
  });
  if(expensive[0]) recommendations.push({
    type:"money",
    title:"Watch the expensive cookie",
    text:`${expensive[0].name} is currently the highest cost at ${money(perCookieForRecipe(expensive[0]))} each. Price it carefully.`
  });
  if(bestValue[0]) recommendations.push({
    type:"success",
    title:"Best margin candidate",
    text:`${bestValue[0].name} is currently the lowest cost at ${money(perCookieForRecipe(bestValue[0]))} each. Great for bundles or promo boxes.`
  });
  if(!recommendations.length) recommendations.push({
    type:"success",
    title:"Looking clean",
    text:"Recipe costs and batch planning look stable. Next smart step is adding sale prices so Snack IQ can calculate margin."
  });

  return {all,costed,zeroCost,flagged,productionCost,totalBatches,avgCookie,expensive,bestValue,shopping,recommendations};
}

function renderBrain(){
  const brain=buildBrain();
  document.getElementById("brainSummary").innerHTML=`
    <article><span>Production Cost</span><strong>${money(brain.productionCost)}</strong><small>${brain.totalBatches} selected batches</small></article>
    <article><span>Avg Cost</span><strong>${money(brain.avgCookie)}</strong><small>per cookie across costed recipes</small></article>
    <article><span>Cleanup</span><strong>${brain.zeroCost.length + brain.flagged.length}</strong><small>things blocking smarter profit math</small></article>
    <article><span>Costed</span><strong>${brain.costed.length}/${brain.all.length}</strong><small>recipes matched to Google Sheet</small></article>
  `;

  document.getElementById("brainCards").innerHTML=brain.recommendations.map(item=>`
    <article class="brain-card ${item.type}">
      <p>${item.title}</p>
      <span>${item.text}</span>
    </article>
  `).join("");

  document.getElementById("shoppingList").innerHTML=`
    <div class="panel-head slim">
      <div>
        <p class="eyebrow">Smart Shopping / Prep</p>
        <h2>Top Ingredients Needed</h2>
        <p class="muted">Based on current batch controls. This is the first pass; stock-on-hand can come next.</p>
      </div>
    </div>
    <div class="shopping-grid">
      ${brain.shopping.length?brain.shopping.map(item=>`
        <article>
          <b>${item.name}</b>
          <span>${item.amount.toFixed(2)} ${item.unit}</span>
          <small>${money(item.cost)} planned cost</small>
        </article>
      `).join(""):`<div class="empty-state">No ingredient totals yet because costed recipes are not linked.</div>`}
    </div>
  `;
}

function renderAll(rebind=true){
  renderOverview();
  renderRecipeList(document.getElementById("recipeSearch")?.value||"");
  renderRecipeDetail();
  renderCostCards();
  renderIngredients();
  renderCleanup();
  renderBrain();
  bindBatchControls();
}
async function init(){
  let live=false,msg="";
  try{await loadBackendData();live=true}catch(e){console.warn(e);msg=e.message}
  renderStatus(live,msg);
  renderAll();
  document.getElementById("recipeSearch")?.addEventListener("input",e=>renderRecipeList(e.target.value));
  document.getElementById("refreshButton")?.addEventListener("click",()=>window.location.reload());
  document.getElementById("printTodayButton")?.addEventListener("click",()=>window.print());
  document.getElementById("brainButton")?.addEventListener("click",()=>{renderBrain();});
}
init();
