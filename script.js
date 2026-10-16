const SAVE_KEY = "beyond_infinity_save_v1";
const NUMBERS_URL = "numbers.json";

// Huge numbers are stored as mantissa × 10^exponent, so they never overflow JS Number.
const BN = {
  zero: () => ({ m: 0, e: 0 }),
  one: () => ({ m: 1, e: 0 }),
  norm(m, e = 0) {
    if (!Number.isFinite(m) || m <= 0) return this.zero();
    const shift = Math.floor(Math.log10(m));
    return { m: m / Math.pow(10, shift), e: e + shift };
  },
  from(value) {
    if (value && typeof value === 'object' && Number.isFinite(value.m) && Number.isFinite(value.e)) return this.norm(value.m, value.e);
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return this.zero();
    if (value < 1e15) return this.norm(value);
    return this.norm(value / Math.pow(10, Math.floor(Math.log10(value))), Math.floor(Math.log10(value)));
  },
  pow10(e) { return e < 0 ? this.zero() : { m: 1, e }; },
  add(a, b) {
    a = this.from(a); b = this.from(b);
    if (!a.m) return b; if (!b.m) return a;
    if (a.e < b.e) [a, b] = [b, a];
    const gap = a.e - b.e;
    if (gap > 16) return a;
    return this.norm(a.m + b.m * Math.pow(10, -gap), a.e);
  },
  sub(a, b) {
    a = this.from(a); b = this.from(b);
    if (this.cmp(a, b) <= 0) return this.zero();
    const gap = a.e - b.e;
    if (gap > 16) return a;
    return this.norm(a.m - b.m * Math.pow(10, -gap), a.e);
  },
  mul(a, b) { a = this.from(a); b = this.from(b); return (!a.m || !b.m) ? this.zero() : this.norm(a.m * b.m, a.e + b.e); },
  div(a, b) { a = this.from(a); b = this.from(b); return (!a.m || !b.m) ? this.zero() : this.norm(a.m / b.m, a.e - b.e); },
  scale(a, n) { return this.mul(a, this.from(n)); },
  cmp(a, b) {
    a = this.from(a); b = this.from(b);
    if (!a.m && !b.m) return 0; if (!a.m) return -1; if (!b.m) return 1;
    return a.e !== b.e ? Math.sign(a.e - b.e) : Math.sign(a.m - b.m);
  },
  sqrt(a) {
    a = this.from(a); if (!a.m) return this.zero();
    let e = a.e, m = a.m;
    if (e % 2 !== 0) { m *= 10; e -= 1; }
    return this.norm(Math.sqrt(m), e / 2);
  },
  floor(a) { a = this.from(a); if (!a.m) return this.zero(); if (a.e > 15) return a; return this.from(Math.floor(a.m * Math.pow(10, a.e))); },
  toJSON(a) { return this.from(a); }
};

const GENERATORS = [
  { id: "spark", name: "Spark", icon: "✦", description: "A tiny flicker of creation.", baseCost: 15, baseRate: 0.2, perk: "Double click power" },
  { id: "particle", name: "Particle Engine", icon: "◈", description: "Turn loose particles into points.", baseCost: 100, baseRate: 1.5, perk: "All generator costs −10%" },
  { id: "reactor", name: "Void Reactor", icon: "✺", description: "A reactor humming with possibility.", baseCost: 1100, baseRate: 12, perk: "All production +50%" },
  { id: "starforge", name: "Starforge", icon: "☼", description: "Forge stars. Collect the output.", baseCost: 12000, baseRate: 95, perk: "Click power ×3" },
  { id: "singularity", name: "Singularity", icon: "◉", description: "Make gravity work for your wallet.", baseCost: 130000, baseRate: 780, perk: "Prestige rewards +25%" },
  { id: "quantumloom", name: "Quantum Loom", icon: "⌘", description: "Weave quantum fluctuations into steady points.", baseCost: 1500000, baseRate: 6200, perk: "Offline earnings cap: 12 hours" },
  { id: "realityengine", name: "Reality Engine", icon: "⛭", description: "Turn the rules of reality into raw production.", baseCost: 20000000, baseRate: 48000, perk: "Upgrade costs −10%" },
  { id: "dimensionwell", name: "Dimension Well", icon: "◌", description: "Draw points from neighbouring dimensions.", baseCost: 350000000, baseRate: 420000, perk: "All production ×2" },
  { id: "multiversecore", name: "Multiverse Core", icon: "✺", description: "Keep entire universes humming in parallel.", baseCost: 8000000000, baseRate: 4200000, perk: "Click power ×5" },
  { id: "infinityengine", name: "Infinity Engine", icon: "∞", description: "Make infinity itself do the heavy lifting.", baseCost: 250000000000, baseRate: 55000000, perk: "Prestige rewards ×2" },
  { id: "beyondengine", name: "Beyond Engine", icon: "✧", description: "A machine built to produce the unthinkable.", baseCost: 10000000000000, baseRate: 900000000, perk: "All production ×3"}
];
const UPGRADES = [
  { id: "click1", name: "Stronger Fingers", icon: "↗", description: "Double points earned per click.", cost: 50, kind: "click", mult: 2 },
  { id: "spark1", name: "Charged Sparks", icon: "⚡", description: "Sparks generate 3× more points.", cost: 250, kind: "generator", target: "spark", mult: 3 },
  { id: "all1", name: "Universal Efficiency", icon: "✧", description: "All generators produce 2× more.", cost: 1500, kind: "all", mult: 2 },
  { id: "click2", name: "Overclocked Clicking", icon: "⌁", description: "Double your click power again.", cost: 8000, kind: "click", mult: 2 },
  { id: "all2", name: "Cosmic Amplifier", icon: "✺", description: "All generators produce 3× more.", cost: 50000, kind: "all", mult: 3 },
  { id: "particle2", name: "Particle Overdrive", icon: "◈", description: "Particle Engines produce 5× more points.", cost: 125000, kind: "generator", target: "particle", mult: 5 },
  { id: "reactor2", name: "Reactor Singularity", icon: "✺", description: "Void Reactors produce 6× more points.", cost: 900000, kind: "generator", target: "reactor", mult: 6 },
  { id: "click3", name: "Reality-Tearing Clicks", icon: "⌁", description: "Your clicks are 10× stronger.", cost: 5000000, kind: "click", mult: 10 },
  { id: "starforge2", name: "Stellar Assembly Line", icon: "☼", description: "Starforges produce 8× more points.", cost: 25000000, kind: "generator", target: "starforge", mult: 8 },
  { id: "all3", name: "Dimensional Efficiency", icon: "⌘", description: "All generators produce 5× more.", cost: 250000000, kind: "all", mult: 5 },
  { id: "singularity2", name: "Event Horizon Harvesting", icon: "◉", description: "Singularities produce 12× more points.", cost: 2500000000, kind: "generator", target: "singularity", mult: 12 },
  { id: "click4", name: "Infinite Momentum", icon: "∞", description: "Your clicks are 25× stronger.", cost: 100000000000, kind: "click", mult: 25 },
  { id: "all4", name: "Multiversal Synergy", icon: "✧", description: "All generators produce 10× more.", cost: 5000000000000, kind: "all", mult: 10 },
  { id: "beyond1", name: "Beyond the Beyond", icon: "∞", description: "All generators produce 25× more.", cost: 1000000000000000, kind: "all", mult: 25 }
];
const freshState = () => ({
  points: BN.zero(), totalEarned: BN.zero(), lifetimePoints: BN.zero(), shards: BN.zero(), clickPower: BN.one(),
  generators: Object.fromEntries(GENERATORS.map(g => [g.id, 0])),
  boughtUpgrades: [], discoveredNumbers: [], achievements: [], clicks: 0, prestigeCount: 0, lastSaved: Date.now(), compact: false, fastUpdates: false, confirmPrestige: true
});
let state = freshState();
let numberEntries = [];
let toastTimer;

function fmt(value, forceScientific = false) {
  const n = BN.from(value);
  if (!n.m) return "0";
  if (n.e < 15 && !forceScientific) {
    const ordinary = n.m * Math.pow(10, n.e);
    if (state.compact && ordinary >= 1000) {
      const suffixes = [["K",3],["M",6],["B",9],["T",12]];
      for (let i = suffixes.length - 1; i >= 0; i--) if (n.e >= suffixes[i][1]) return (ordinary / Math.pow(10, suffixes[i][1])).toFixed(2).replace(/\.?0+$/, "") + suffixes[i][0];
    }
    return Math.floor(ordinary).toLocaleString("en-US");
  }
  const superscript = String(n.e).replace(/[0-9-]/g, d => ({"0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","-":"⁻"})[d]);
  if (Math.abs(n.m - 1) < 0.005) return "10" + superscript;
  return n.m.toFixed(2).replace(/\.?0+$/, "") + " × 10" + superscript;
}
function hasGeneratorPerk(id) { return (state.generators[id] || 0) >= 100; }
function specialProductionMultiplier() {
  let mult = BN.one();
  if (hasGeneratorPerk("reactor")) mult = BN.scale(mult, 1.5);
  if (hasGeneratorPerk("dimensionwell")) mult = BN.scale(mult, 2);
  if (hasGeneratorPerk("beyondengine")) mult = BN.scale(mult, 3);
  return mult;
}
function generatorCost(g) {
  const log10 = Math.log10(g.baseCost) + (state.generators[g.id] || 0) * Math.log10(1.15);
  const exponent = Math.floor(log10);
  let cost = BN.norm(Math.pow(10, log10 - exponent), exponent);
  if (hasGeneratorPerk("particle")) cost = BN.scale(cost, 0.9);
  return cost;
}
function upgradeCost(u) {
  let cost = BN.from(u.cost);
  if (hasGeneratorPerk("realityengine")) cost = BN.scale(cost, 0.9);
  return cost;
}
function totalGeneratorCount() { return Object.values(state.generators).reduce((a, b) => a + b, 0); }
function allMultiplier() {
  let mult = BN.add(BN.one(), BN.scale(state.shards, 0.1));
  for (const id of state.boughtUpgrades) { const u = UPGRADES.find(x => x.id === id); if (u && u.kind === "all") mult = BN.scale(mult, u.mult); }
  return mult;
}
function clickMultiplier() {
  let mult = allMultiplier();
  if (hasGeneratorPerk("spark")) mult = BN.scale(mult, 2);
  if (hasGeneratorPerk("starforge")) mult = BN.scale(mult, 3);
  if (hasGeneratorPerk("multiversecore")) mult = BN.scale(mult, 5);
  for (const id of state.boughtUpgrades) { const u = UPGRADES.find(x => x.id === id); if (u && u.kind === "click") mult = BN.scale(mult, u.mult); }
  return mult;
}
// Each generator has four non-stacking ownership milestones. The highest
// reached milestone sets its dedicated multiplier: 2x / 3x / 5x / 10x.
const GENERATOR_MILESTONES = [
  { count: 10, mult: 2 },
  { count: 25, mult: 3 },
  { count: 50, mult: 5 },
  { count: 100, mult: 10 }
];
function generatorMilestone(g) {
  const owned = state.generators[g.id] || 0;
  return [...GENERATOR_MILESTONES].reverse().find(m => owned >= m.count) || null;
}
function generatorRate(g) {
  let mult = allMultiplier();
  for (const id of state.boughtUpgrades) { const u = UPGRADES.find(x => x.id === id); if (u && u.kind === "generator" && u.target === g.id) mult = BN.scale(mult, u.mult); }
  const milestone = generatorMilestone(g);
  if (milestone) mult = BN.scale(mult, milestone.mult);
  mult = BN.scale(mult, specialProductionMultiplier());
  return BN.scale(BN.scale(mult, (state.generators[g.id] || 0) * g.baseRate), 1);
}
function productionPerSecond() { return GENERATORS.reduce((sum, g) => BN.add(sum, generatorRate(g)), BN.zero()); }
function addPoints(amount) {
  amount = BN.from(amount); if (!amount.m) return;
  state.points = BN.add(state.points, amount);
  state.totalEarned = BN.add(state.totalEarned, amount);
  state.lifetimePoints = BN.add(state.lifetimePoints, amount);
}
function toast(message) {
  const el = document.getElementById("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2300);
}
function renderGenerators() {
  const list = document.getElementById("generator-list"); list.innerHTML = "";
  GENERATORS.forEach(g => {
    const cost = generatorCost(g), owned = state.generators[g.id] || 0, rate = generatorRate(g), canBuy = BN.cmp(state.points, cost) >= 0;
    const row = document.createElement("div"); row.className = "game-item" + (canBuy ? " affordable" : "");
    const milestone = generatorMilestone(g);
    const nextMilestone = GENERATOR_MILESTONES.find(m => owned < m.count);
    const milestoneText = milestone
      ? `Milestone bonus: ${milestone.mult}×${nextMilestone ? ` · Next: ${nextMilestone.count} owned (${nextMilestone.mult}×)` : " · All milestones reached!"}`
      : `Next milestone: ${nextMilestone.count} owned (${nextMilestone.mult}×)`;
    const perkText = hasGeneratorPerk(g.id) ? `✦ SPECIAL PERK ACTIVE: ${g.perk}` : `100 owned bonus: ${g.perk}`;
    row.innerHTML = `<div class="item-icon">${g.icon}</div><div class="item-main"><strong>${g.name} <span class="undiscovered">×${owned}</span></strong><p>${g.description}</p><div class="item-meta">+${fmt(rate)}/s · Base ${fmt(BN.from(g.baseRate))}/s each</div><div class="item-meta milestone-meta">${milestoneText}</div><div class="item-meta special-perk ${hasGeneratorPerk(g.id) ? "perk-active" : ""}">${perkText}</div></div><button class="buy-button" ${!canBuy ? "disabled" : ""}>Buy<span>${fmt(cost)}</span></button>`;
    row.querySelector("button").addEventListener("click", () => { const c = generatorCost(g); if (BN.cmp(state.points, c) < 0) return; const oldOwned = state.generators[g.id] || 0; state.points = BN.sub(state.points, c); state.generators[g.id] = oldOwned + 1; if (oldOwned === 99) toast(`${g.name} special perk unlocked: ${g.perk}!`); render(); });
    list.appendChild(row);
  });
}
function renderUpgrades() {
  const list = document.getElementById("upgrade-list"); list.innerHTML = "";
  UPGRADES.forEach(u => {
    const bought = state.boughtUpgrades.includes(u.id), cost = upgradeCost(u), canBuy = BN.cmp(state.points, cost) >= 0;
    const row = document.createElement("div"); row.className = "game-item" + (!bought && canBuy ? " affordable" : "");
    row.innerHTML = `<div class="item-icon">${u.icon}</div><div class="item-main"><strong>${u.name}</strong><p>${u.description}</p><div class="item-meta">${bought ? "PURCHASED" : "Cost: " + fmt(cost)}</div></div><button class="buy-button" ${bought || !canBuy ? "disabled" : ""}>${bought ? "Owned" : "Buy"}${bought ? "" : `<span>${fmt(cost)}</span>`}</button>`;
    row.querySelector("button").addEventListener("click", () => { if (state.boughtUpgrades.includes(u.id) || BN.cmp(state.points, upgradeCost(u)) < 0) return; state.points = BN.sub(state.points, upgradeCost(u)); state.boughtUpgrades.push(u.id); toast("Upgrade purchased: " + u.name); render(); });
    list.appendChild(row);
  });
}

const ACHIEVEMENTS = [
  {id:"first_click", name:"A Little Push", desc:"Generate points for the first time.", icon:"✦", check:()=>state.clicks>=1},
  {id:"click_100", name:"Click Enthusiast", desc:"Click 100 times.", icon:"⌁", check:()=>state.clicks>=100},
  {id:"click_1000", name:"Finger of the Universe", desc:"Click 1,000 times.", icon:"☝", check:()=>state.clicks>=1000},
  {id:"click_10000", name:"Please Stop Clicking", desc:"Click 10,000 times.", icon:"⚡", check:()=>state.clicks>=10000},
  {id:"points_100", name:"First Hundred", desc:"Earn 100 lifetime points.", icon:"◈", check:()=>BN.cmp(state.lifetimePoints,BN.from(100))>=0},
  {id:"points_million", name:"Getting Somewhere", desc:"Earn 1 million lifetime points.", icon:"✧", check:()=>BN.cmp(state.lifetimePoints,BN.from(1e6))>=0},
  {id:"points_billion", name:"Billionaire-ish", desc:"Earn 1 billion lifetime points.", icon:"◆", check:()=>BN.cmp(state.lifetimePoints,BN.from(1e9))>=0},
  {id:"points_trillion", name:"Trillionaire", desc:"Earn 1 trillion lifetime points.", icon:"◉", check:()=>BN.cmp(state.lifetimePoints,BN.pow10(12))>=0},
  {id:"points_quadrillion", name:"This Is Getting Silly", desc:"Earn 1 quadrillion lifetime points.", icon:"✺", check:()=>BN.cmp(state.lifetimePoints,BN.pow10(15))>=0},
  {id:"points_googol", name:"Googolplex Energy", desc:"Reach a googol lifetime points.", icon:"∞", check:()=>BN.cmp(state.lifetimePoints,BN.pow10(100))>=0},
  {id:"first_generator", name:"Automation!", desc:"Buy your first generator.", icon:"⚙", check:()=>totalGeneratorCount()>=1},
  {id:"ten_generators", name:"Factory Floor", desc:"Own 10 generators in total.", icon:"⚙", check:()=>totalGeneratorCount()>=10},
  {id:"hundred_generators", name:"Industrial Revolution", desc:"Own 100 generators in total.", icon:"⛭", check:()=>totalGeneratorCount()>=100},
  {id:"thousand_generators", name:"Generator Hoarder", desc:"Own 1,000 generators in total.", icon:"▦", check:()=>totalGeneratorCount()>=1000},
  {id:"first_upgrade", name:"A Better Way", desc:"Buy your first upgrade.", icon:"✧", check:()=>state.boughtUpgrades.length>=1},
  {id:"five_upgrades", name:"Patch Notes Enjoyer", desc:"Buy 5 upgrades.", icon:"✧", check:()=>state.boughtUpgrades.length>=5},
  {id:"all_upgrades", name:"Fully Optimised", desc:"Buy every currently available upgrade.", icon:"✦", check:()=>UPGRADES.every(u=>state.boughtUpgrades.includes(u.id))},
  {id:"spark_10", name:"Pocketful of Sparks", desc:"Own 10 Sparks.", icon:"✦", check:()=>state.generators.spark>=10},
  {id:"spark_100", name:"Spark Storm", desc:"Own 100 Sparks.", icon:"⚡", check:()=>state.generators.spark>=100},
  {id:"one_each", name:"A Balanced Ecosystem", desc:"Own at least one of every generator.", icon:"◈", check:()=>GENERATORS.every(g=>(state.generators[g.id]||0)>=1)},
  {id:"newest_generator", name:"Beyond the Beyond", desc:"Buy a Beyond Engine.", icon:"∞", check:()=>state.generators.beyondengine>=1},
  {id:"all_100", name:"A Hundred of Everything", desc:"Own 100 of every generator.", icon:"▦", check:()=>GENERATORS.every(g=>(state.generators[g.id]||0)>=100)},
  {id:"first_milestone", name:"Master of One", desc:"Reach a generator's 10-owned milestone.", icon:"✪", check:()=>GENERATORS.some(g=>(state.generators[g.id]||0)>=10)},
  {id:"all_milestones", name:"Machine Mastery", desc:"Reach 100 of any generator.", icon:"✪", check:()=>GENERATORS.some(g=>(state.generators[g.id]||0)>=100)},
  {id:"first_prestige", name:"A New Beginning", desc:"Prestige for the first time.", icon:"✺", check:()=>state.prestigeCount>=1},
  {id:"five_prestiges", name:"Déjà Vu", desc:"Prestige 5 times.", icon:"⟳", check:()=>state.prestigeCount>=5},
  {id:"ten_shards", name:"Shard Collector", desc:"Collect 10 Infinity Shards.", icon:"◆", check:()=>BN.cmp(state.shards,BN.from(10))>=0},
  {id:"hundred_shards", name:"Shards for Days", desc:"Collect 100 Infinity Shards.", icon:"💠", check:()=>BN.cmp(state.shards,BN.from(100))>=0},
  {id:"discover_one", name:"Number Nerd", desc:"Discover your first named number.", icon:"⌁", check:()=>state.discoveredNumbers.length>=1},
  {id:"discover_ten", name:"Catalogue Keeper", desc:"Discover 10 named numbers.", icon:"▤", check:()=>state.discoveredNumbers.length>=10},
  {id:"discover_all", name:"The Whole List", desc:"Discover every number in the index.", icon:"📚", check:()=>numberEntries.length>0&&numberEntries.every(n=>state.discoveredNumbers.includes(n.id))},
  {id:"secret_zero", name:"The Big Nothing", desc:"Have exactly 0 points while having earned at least 1 point.", icon:"?", secret:true, check:()=>!BN.from(state.points).m&&BN.cmp(state.lifetimePoints,BN.one())>=0},
  {id:"secret_one", name:"One Is All You Need", desc:"Have exactly 1 point.", icon:"?", secret:true, check:()=>BN.cmp(state.points,BN.one())===0},
  {id:"secret_click_upgrade", name:"Click, Buy, Repeat", desc:"Buy an upgrade after clicking at least 100 times.", icon:"?", secret:true, check:()=>state.clicks>=100&&state.boughtUpgrades.length>0},
  {id:"secret_1000_spark", name:"Sparks of Madness", desc:"Own 1,000 Sparks.", icon:"?", secret:true, check:()=>state.generators.spark>=1000},
  {id:"secret_prestige_rich", name:"Back from Beyond", desc:"Prestige while holding at least 1 quadrillion lifetime points.", icon:"?", secret:true, check:()=>state.prestigeCount>=1&&BN.cmp(state.lifetimePoints,BN.pow10(15))>=0}
];
function checkAchievements() {
  let newlyUnlocked = null;
  for (const achievement of ACHIEVEMENTS) {
    if (!state.achievements.includes(achievement.id) && achievement.check()) {
      state.achievements.push(achievement.id);
      newlyUnlocked = achievement;
    }
  }
  if (newlyUnlocked) toast(`Achievement unlocked: ${newlyUnlocked.name}!`);
}
function renderAchievements() {
  const list = document.getElementById("achievement-list");
  if (!list) return;
  list.innerHTML = "";
  const unlocked = state.achievements.length;
  document.getElementById("achievement-count").textContent = `${unlocked} / ${ACHIEVEMENTS.length} unlocked`;
  document.getElementById("achievement-progress").style.width = `${unlocked / ACHIEVEMENTS.length * 100}%`;
  ACHIEVEMENTS.forEach(a => {
    const earned = state.achievements.includes(a.id);
    const hidden = a.secret && !earned;
    const row = document.createElement("div");
    row.className = "achievement-card" + (earned ? " achievement-earned" : "");
    row.innerHTML = `<div class="achievement-icon">${earned ? a.icon : hidden ? "?" : "◇"}</div><div class="achievement-copy"><strong>${hidden ? "Secret achievement" : a.name}</strong><p>${hidden ? "Discover this achievement yourself." : a.desc}</p></div><span class="achievement-status">${earned ? "UNLOCKED" : "LOCKED"}</span>`;
    list.appendChild(row);
  });
}

function superscript(e) { return String(e).replace(/[0-9-]/g, d => ({"0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","-":"⁻"})[d]); }
function renderNumbers() {
  const list = document.getElementById("number-list"); list.innerHTML = "";
  numberEntries.forEach(n => {
    const threshold = BN.pow10(Number(n.exponent));
    const discovered = state.discoveredNumbers.includes(n.id) || BN.cmp(state.lifetimePoints, threshold) >= 0;
    if (discovered && !state.discoveredNumbers.includes(n.id)) state.discoveredNumbers.push(n.id);
    const row = document.createElement("div"); row.className = "number-row";
    row.innerHTML = `<div class="number-badge">${discovered ? "✧" : "?"}</div><div class="number-copy"><strong>${discovered ? n.name : "Undiscovered number"}</strong><small>${discovered ? n.display : "Reach 10" + superscript(n.exponent)}</small></div><span class="discovery-state ${discovered ? "" : "undiscovered"}">${discovered ? "DISCOVERED" : "LOCKED"}</span>`;
    list.appendChild(row);
  });
}
function nextMilestone() {
  return numberEntries.find(n => BN.cmp(state.points, BN.pow10(Number(n.exponent))) < 0) || numberEntries[numberEntries.length - 1] || {name:"Infinity", exponent:0};
}
function updateNavigationDots() {
  const affordableGenerator = GENERATORS.some(g => BN.cmp(state.points, generatorCost(g)) >= 0);
  const affordableUpgrade = UPGRADES.some(u => !state.boughtUpgrades.includes(u.id) && BN.cmp(state.points, BN.from(u.cost)) >= 0);
  const undiscoveredAvailable = numberEntries.some(n => BN.cmp(state.lifetimePoints, BN.pow10(Number(n.exponent))) >= 0 && !state.discoveredNumbers.includes(n.id));
  const achievementAvailable = ACHIEVEMENTS.some(a => !state.achievements.includes(a.id) && a.check());
  document.getElementById("dot-game").classList.remove("has-new"); document.getElementById("dot-universe").classList.remove("has-new");
  document.getElementById("dot-generators").classList.toggle("has-new", affordableGenerator); document.getElementById("dot-upgrades").classList.toggle("has-new", affordableUpgrade); document.getElementById("dot-index").classList.toggle("has-new", undiscoveredAvailable); document.getElementById("dot-achievements").classList.toggle("has-new", achievementAvailable);
}
function setupSidebar() {
  const links = [...document.querySelectorAll(".side-link")], pageIds = ["game-section", "generators-section", "universe-section", "upgrades-section", "index-section", "achievements-section"], panels = [...document.querySelectorAll(".layout > .panel")];
  function showPage(target) {
    links.forEach(item => { const active = item.dataset.target === target; item.classList.toggle("active", active); item.setAttribute("aria-current", active ? "page" : "false"); });
    panels.forEach(panel => { const page = panel.id === "prestige-section" ? "universe-section" : panel.id; panel.classList.toggle("page-hidden", page !== target); });
    document.querySelector(".layout > footer")?.classList.remove("page-hidden"); history.replaceState(null, "", "#" + target);
  }
  links.forEach(button => button.addEventListener("click", () => showPage(button.dataset.target)));
  showPage(pageIds.includes(location.hash.slice(1)) ? location.hash.slice(1) : "game-section");
}
function prestigeReward() {
  let reward = BN.floor(BN.sqrt(BN.div(state.lifetimePoints, BN.pow10(12))));
  if (hasGeneratorPerk("singularity")) reward = BN.scale(reward, 1.25);
  if (hasGeneratorPerk("infinityengine")) reward = BN.scale(reward, 2);
  return BN.floor(reward);
}
function renderFastNumbers() {
  document.getElementById("points").textContent = fmt(state.points);
  document.getElementById("production").textContent = "+" + fmt(productionPerSecond()) + " / second";
  document.getElementById("click-value").textContent = "+" + fmt(BN.mul(state.clickPower, clickMultiplier())) + " per click";
}
function render() {
  document.getElementById("points").textContent = fmt(state.points); document.getElementById("production").textContent = "+" + fmt(productionPerSecond()) + " / second";
  document.getElementById("click-value").textContent = "+" + fmt(BN.mul(state.clickPower, clickMultiplier())) + " per click";
  document.getElementById("total-earned").textContent = fmt(state.totalEarned); document.getElementById("generator-count").textContent = fmt(BN.from(totalGeneratorCount()));
  document.getElementById("lifetime-points").textContent = fmt(state.lifetimePoints); document.getElementById("shards").textContent = fmt(state.shards);
  const milestone = nextMilestone(), idx = numberEntries.indexOf(milestone), previous = idx > 0 ? numberEntries[idx - 1] : null;
  const start = previous ? BN.pow10(Number(previous.exponent)) : BN.zero(), end = BN.pow10(Number(milestone.exponent));
  let progress = 0;
  if (BN.cmp(state.points, end) >= 0) progress = 100;
  else if (BN.cmp(state.points, start) > 0 && end.e - start.e < 16) {
    const s = start.m ? start.m * Math.pow(10, start.e - end.e) : 0;
    const p = state.points.m * Math.pow(10, state.points.e - end.e);
    progress = Math.max(0, Math.min(100, (p - s) / (1 - s) * 100));
  } else if (BN.cmp(state.points, start) > 0) progress = Math.max(0, Math.min(99.9, (state.points.e - start.e) / Math.max(1, end.e - start.e) * 100));
  document.getElementById("milestone-label").textContent = "Next: " + milestone.name; document.getElementById("milestone-progress").textContent = progress.toFixed(1) + "%"; document.getElementById("milestone-bar").style.width = progress + "%";
  const reward = prestigeReward(), unlocked = BN.cmp(state.lifetimePoints, BN.pow10(12)) >= 0 && BN.cmp(reward, BN.one()) >= 0;
  document.getElementById("prestige-reward").textContent = unlocked ? "+" + fmt(reward) + " Infinity Shard" + (BN.cmp(reward, BN.one()) === 0 ? "" : "s") : "Not yet available";
  document.getElementById("prestige-description").textContent = unlocked ? "Prestige now to reset this run and gain permanent production bonuses." : "Reach 1 trillion lifetime points to unlock your first reset. Current: " + fmt(state.lifetimePoints);
  document.getElementById("prestige-button").disabled = !unlocked;
  renderGenerators(); renderUpgrades(); renderNumbers();
  checkAchievements(); renderAchievements(); updateNavigationDots();
}
function save(showMessage = false) {
  state.lastSaved = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  document.getElementById("save-status").textContent = "Saved " + new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  if (showMessage) toast("Game saved in this browser.");
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return;
    const loaded = JSON.parse(raw), defaults = freshState();
    state = { ...defaults, ...loaded, generators: { ...defaults.generators, ...(loaded.generators || {}) }, achievements: Array.isArray(loaded.achievements) ? loaded.achievements : [], clicks: Number(loaded.clicks) || 0, prestigeCount: Number(loaded.prestigeCount) || 0 };
    for (const key of ["points", "totalEarned", "lifetimePoints", "shards", "clickPower"]) state[key] = BN.from(state[key]);
    const offlineCap = hasGeneratorPerk("quantumloom") ? 12 * 60 * 60 : 8 * 60 * 60;
    const elapsed = Math.max(0, Math.min(offlineCap, (Date.now() - (state.lastSaved || Date.now())) / 1000));
    const offline = BN.scale(productionPerSecond(), elapsed);
    if (offline.m) { addPoints(offline); setTimeout(() => toast("Welcome back! You earned " + fmt(offline) + " points while away."), 500); }
  } catch (error) { console.warn("Could not load save:", error); state = freshState(); }
}
async function loadNumbers() {
  const fallback = [{id:"thousand",name:"Thousand",exponent:3,display:"10^3"},{id:"million",name:"Million",exponent:6,display:"10^6"},{id:"billion",name:"Billion",exponent:9,display:"10^9"},{id:"trillion",name:"Trillion",exponent:12,display:"10^12"},{id:"googol",name:"Googol",exponent:100,display:"10^100"}];
  try { const response = await fetch(NUMBERS_URL); if (!response.ok) throw new Error("numbers.json not found"); const data = await response.json(); if (!Array.isArray(data) || !data.length) throw new Error("numbers.json is empty"); numberEntries = data; }
  catch { numberEntries = fallback; }
  render();
}
document.getElementById("generate-button").addEventListener("click", () => { state.clicks = (state.clicks || 0) + 1; addPoints(BN.mul(state.clickPower, clickMultiplier())); render(); });
document.getElementById("save-button").addEventListener("click", () => save(true));
document.getElementById("settings-button").addEventListener("click", () => document.getElementById("settings-dialog").showModal());
document.getElementById("compact-toggle").addEventListener("change", e => { state.compact = e.target.checked; render(); });
document.getElementById("fast-updates-toggle").addEventListener("change", e => { state.fastUpdates = e.target.checked; renderFastNumbers(); save(false); });
document.getElementById("confirm-toggle").addEventListener("change", e => { state.confirmPrestige = e.target.checked; });
document.getElementById("prestige-button").addEventListener("click", () => {
  const reward = prestigeReward(); if (BN.cmp(reward, BN.one()) < 0) return;
  if (state.confirmPrestige && !confirm(`Prestige for ${fmt(reward)} Infinity Shard(s)? This resets points and generators.`)) return;
  state.shards = BN.add(state.shards, reward); state.prestigeCount = (state.prestigeCount || 0) + 1; state.points = BN.zero(); state.totalEarned = BN.zero(); state.clickPower = BN.one();
  state.generators = Object.fromEntries(GENERATORS.map(g => [g.id, 0])); state.boughtUpgrades = [];
  toast(`Universe reset! +${fmt(reward)} Infinity Shard(s).`); render(); save();
});
document.getElementById("reset-button").addEventListener("click", () => document.getElementById("reset-dialog").showModal());
document.getElementById("confirm-reset").addEventListener("click", () => {
  localStorage.removeItem(SAVE_KEY); state = freshState(); document.getElementById("compact-toggle").checked = false; document.getElementById("confirm-toggle").checked = true; render(); toast("Fresh universe created.");
});
document.getElementById("compact-toggle").checked = state.compact; document.getElementById("fast-updates-toggle").checked = state.fastUpdates; document.getElementById("confirm-toggle").checked = state.confirmPrestige;
setupSidebar(); load(); document.getElementById("compact-toggle").checked = state.compact; document.getElementById("fast-updates-toggle").checked = state.fastUpdates; document.getElementById("confirm-toggle").checked = state.confirmPrestige; loadNumbers();
let lastTick = Date.now();
let lastFullRender = Date.now();
setInterval(() => {
  const now = Date.now(), elapsed = Math.min((now - lastTick) / 1000, 2);
  lastTick = now;
  addPoints(BN.scale(productionPerSecond(), elapsed));
  if (state.fastUpdates) renderFastNumbers();
  if (!state.fastUpdates || now - lastFullRender >= 250) { render(); lastFullRender = now; }
}, 50);
setInterval(() => save(false), 10000); window.addEventListener("beforeunload", () => save(false));
