// Free, keyless answer source: bundled lists first, then Wikipedia categories / list pages.
// Results are cached per topic so repeat categories need no network at all.
const WIKI = "https://en.wikipedia.org/w/api.php";

const BUNDLED = {
  cheese: ["Cheddar", "Brie", "Gouda", "Mozzarella", "Parmesan", "Feta", "Swiss", "Camembert"],
  fruit: ["Apple", "Banana", "Orange", "Grape", "Mango", "Pear", "Peach", "Cherry"],
  vegetable: ["Carrot", "Broccoli", "Potato", "Onion", "Spinach", "Celery", "Pepper", "Lettuce"],
  animal: ["Dog", "Cat", "Horse", "Lion", "Tiger", "Bear", "Wolf", "Fox"],
  color: ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink", "Brown"],
  country: ["France", "Brazil", "Japan", "Canada", "Egypt", "India", "Italy", "Mexico"],
  car: ["Toyota", "Ford", "Honda", "BMW", "Tesla", "Audi", "Chevrolet", "Nissan"],
  sport: ["Soccer", "Tennis", "Golf", "Hockey", "Rugby", "Boxing", "Baseball", "Cricket"],
  instrument: ["Guitar", "Piano", "Violin", "Drums", "Flute", "Trumpet", "Cello", "Harp"],
  dog: ["Poodle", "Beagle", "Bulldog", "Husky", "Corgi", "Boxer", "Dachshund", "Pug"]
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "suggest") return;
  suggest(msg.prompt, msg.used || []).then(sendResponse, (e) => sendResponse({ error: String(e.message || e) }));
  return true;
});

// "Name types of cheese?" -> "cheese"
function topicOf(prompt) {
  const lead = /^(please|name|list|say|give me|tell me|famous|some|any|different|popular|types? of|kinds? of|things|which|what are|what is|a|an|the)\s+/;
  let t = prompt.toLowerCase().replace(/[?!.:]+$/g, "").trim();
  for (let prev; prev !== t; ) { prev = t; t = t.replace(lead, ""); }
  return t;
}

function singular(w) {
  return w.replace(/ies$/, "y").replace(/(s|x|ch|sh)es$/, "$1").replace(/s$/, "");
}

function clean(title) {
  return title.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function usable(title) {
  return (
    title &&
    !/^(list|lists|category|template|portal|wikipedia|help|file|outline|index|glossary|timeline)\b/i.test(title) &&
    !/\b(list of|lists of)\b/i.test(title) &&
    !/^\d/.test(title) &&
    title.length <= 30
  );
}

async function wiki(params) {
  const url = `${WIKI}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  return res.json();
}

async function fromCategory(topic) {
  const s = await wiki({ action: "query", list: "search", srsearch: topic, srnamespace: "14", srlimit: "3" });
  for (const hit of s.query?.search || []) {
    const m = await wiki({
      action: "query", list: "categorymembers", cmtitle: hit.title, cmtype: "page", cmlimit: "60"
    });
    const names = (m.query?.categorymembers || []).map((p) => clean(p.title)).filter(usable);
    if (names.length >= 5) return names;
  }
  return [];
}

async function fromListPage(topic) {
  const s = await wiki({ action: "query", list: "search", srsearch: `List of ${topic}`, srlimit: "1" });
  const page = s.query?.search?.[0]?.title;
  if (!page) return [];
  const l = await wiki({ action: "query", prop: "links", titles: page, pllimit: "100", plnamespace: "0" });
  const pages = Object.values(l.query?.pages || {});
  return (pages[0]?.links || []).map((x) => clean(x.title)).filter(usable);
}

async function candidates(topic) {
  const words = topic.split(/\s+/);
  const keys = [topic, singular(topic), ...words, ...words.map(singular)];
  for (const k of keys) if (BUNDLED[k]) return BUNDLED[k];

  const cacheKey = `cache:${topic}`;
  const cached = (await chrome.storage.local.get(cacheKey))[cacheKey];
  if (cached) return cached;

  let names = [];
  try {
    names = await fromCategory(topic);
    if (names.length < 5) names = names.concat(await fromListPage(topic));
  } catch (e) {
    if (!names.length) throw e;
  }
  // Short names are easier to type and more recognisable, so they go first.
  names = [...new Set(names)].sort((a, b) => a.length - b.length).slice(0, 40);
  if (names.length) await chrome.storage.local.set({ [cacheKey]: names });
  return names;
}

async function suggest(prompt, used) {
  const topic = topicOf(prompt);
  if (!topic) throw new Error("Couldn't work out the category.");
  const usedSet = new Set(used.map((u) => u.toLowerCase()));
  const answers = (await candidates(topic)).filter((n) => !usedSet.has(n.toLowerCase())).slice(0, 8);
  if (!answers.length) throw new Error(`No answers found for "${topic}".`);
  return { answers };
}

if (typeof module !== "undefined") module.exports = { topicOf, singular, clean, usable };
