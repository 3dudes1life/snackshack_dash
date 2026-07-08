const money=v=>Number(v||0).toLocaleString(undefined,{style:"currency",currency:"USD"});
const number=v=>Number(v||0)||0;
const norm=v=>String(v||"").toLowerCase().replace(/[^a-z0-9]+/g,"");

let dashboardData={products:[],ingredients:[],orders:[],customers:[]};
const bakedRecipes=window.CDAWG_RECIPE_LIBRARY||[];
let selectedRecipeKey="";

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
function batchCost(p){return p?(number(p.totalBatchCost)||(p.recipe||[]).reduce((s,l)=>s+number(l.ingredientCost),0)):0}
function perCookie(p){return p?(number(p.costPerCookie)||(number(p.batchYieldUnits)?batchCost(p)/number(p.batchYieldUnits):0)):0}
function perDozen(p){return p?(number(p.costPerDozen)||perCookie(p)*12):0}
function flags(p){return p?(p.recipe||[]).filter(l=>number(l.amount)<=0||number(l.ingredientCost)<=0).length:0}
function priced(){return(dashboardData.products||[]).filter(p=>batchCost(p)>0||perCookie(p)>0)}
function needs(){return(dashboardData.products||[]).filter(p=>batchCost(p)<=0&&perCookie(p)<=0)}
function activeRecipe(){
  const all=mergedRecipes();
  return all.find(r=>r.key===selectedRecipeKey)||all[0];
}

function renderStatus(live,msg){
  const all=mergedRecipes();
  if(!selectedRecipeKey && all[0]) selectedRecipeKey=all[0].key;
  document.getElementById("statusTitle").textContent=live?`${all.length} recipes ready for Caleb`:`${all.length} recipes loaded`;
  document.getElementById("statusMessage").textContent=live?`${dashboardData.ingredients.length} ingredient costs connected from Google Sheets.`:(msg||"Built-in recipe cards are loaded.");
}
function renderOverview(){
  const all=mergedRecipes();
  const p=priced();
  const n=needs();
  const avg=p.length?p.reduce((s,x)=>s+perCookie(x),0)/p.length:0;
  const cards=[
    ["Cook Cards",all.length,"Recipes ready"],
    ["Costed Recipes",`${p.length}/${dashboardData.products.length||0}`,"Google Sheet matched"],
    ["Ingredients",dashboardData.ingredients.length,"Cost library"],
    ["Avg Cost/Cookie",money(avg),"Across costed recipes"],
    ["Needs Cleanup",n.length,"Zero-cost recipes"],
    ["Next Step","Sell Prices","For profit/margin"]
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
          <small>${r.yield||"Yield TBD"}${p?` • ${money(batchCost(p))}`:""}</small>
        </span>
        <em class="${p?"linked":"text"}">${p?"Cost":"Text"}</em>
      </button>`;
  }).join("");
  document.querySelectorAll(".recipe-row").forEach(btn=>{
    btn.addEventListener("click",()=>{
      selectedRecipeKey=btn.dataset.key;
      renderRecipeList(document.getElementById("recipeSearch").value);
      renderRecipeDetail();
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
      <div class="detail-cost">
        <span>Batch</span>
        <strong>${money(batchCost(p))}</strong>
        <small>${money(perCookie(p))} each • ${money(perDozen(p))}/dozen</small>
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
    const cost=batchCost(p), pc=perCookie(p), pd=perDozen(p), f=flags(p);
    return`
      <article class="cost-card ${!p||cost<=0?"needs-cleanup":""}">
        <div class="cost-top">
          <div>
            <p class="eyebrow">${p?`${number(p.batches)||1} ${(number(p.batches)||1)===1?"batch":"batches"}`:"text only"}</p>
            <h3>${r.name}</h3>
            <span>${p?(p.yieldLabel||r.yield):(r.yield||"Yield TBD")}</span>
          </div>
          <strong>${money(cost)}</strong>
        </div>
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
  const rows=mergedRecipes().map(r=>({r,p:r.costProduct,f:flags(r.costProduct),cost:batchCost(r.costProduct)})).filter(x=>!x.p||x.f>0||x.cost<=0).sort((a,b)=>(b.f-a.f)||(a.cost-b.cost));
  document.getElementById("cleanupList").innerHTML=rows.length?rows.map(x=>`
    <div class="list-row">
      <div><strong>${x.r.name}</strong><span>${!x.p?"Recipe text has no matching sheet cost yet":`${x.f} zero amount/cost lines • Batch ${money(x.cost)}`}</span></div>
      <em class="${x.p&&x.cost>0?"warn":"bad"}">${x.p?"Review":"Link"}</em>
    </div>`).join(""):`<div class="empty-state">No obvious cleanup flags.</div>`;
  const p=priced();
  const high=[...p].sort((a,b)=>perCookie(b)-perCookie(a))[0],low=[...p].sort((a,b)=>perCookie(a)-perCookie(b))[0];
  document.getElementById("costExtremes").innerHTML=[
    high&&["Most expensive",high.name,`${money(perCookie(high))}/cookie • ${money(perDozen(high))}/dozen`],
    low&&["Least expensive",low.name,`${money(perCookie(low))}/cookie • ${money(perDozen(low))}/dozen`],
    ["Costed recipes",p.length,"Live from sheet"],
    ["Recipe library",mergedRecipes().length,"Cook cards available"]
  ].filter(Boolean).map(x=>`<div class="list-row"><div><strong>${x[0]}</strong><span>${x[2]}</span></div><b>${x[1]}</b></div>`).join("");
}
function renderReport(){
  const cards=[
    ["Live source",dashboardData.source||"Recipe library",dashboardData.generatedAt?`Generated ${new Date(dashboardData.generatedAt).toLocaleString()}`:"Built into dashboard"],
    ["Recipe workspace",mergedRecipes().length,"List + detail mode"],
    ["Ingredient chips",dashboardData.ingredients.length,"Compact cost view"],
    ["Next backend step","Sell prices","Add price tab for profit/margin"]
  ];
  document.getElementById("snackReport").innerHTML=cards.map(c=>`<article class="report-card"><p>${c[0]}</p><strong>${c[1]}</strong><span>${c[2]}</span></article>`).join("");
}
function renderAll(){
  renderOverview();
  renderRecipeList();
  renderRecipeDetail();
  renderCostCards();
  renderIngredients();
  renderCleanup();
  renderReport();
}
async function init(){
  let live=false,msg="";
  try{await loadBackendData();live=true}catch(e){console.warn(e);msg=e.message}
  renderStatus(live,msg);
  renderAll();
  document.getElementById("recipeSearch")?.addEventListener("input",e=>renderRecipeList(e.target.value));
  document.getElementById("refreshButton")?.addEventListener("click",()=>window.location.reload());
  document.getElementById("printTodayButton")?.addEventListener("click",()=>window.print());
}
init();
