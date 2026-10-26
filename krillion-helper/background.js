// Free, keyless answer source: bundled lists first, then Wikipedia categories / list pages.
// Results are cached per topic so repeat categories need no network at all.
const WIKI = "https://en.wikipedia.org/w/api.php";

const BUNDLED = {
  military: ["General", "Colonel", "Major", "Captain", "Lieutenant", "Sergeant", "Corporal", "Private", "Admiral", "Commander", "Ensign", "Brigadier"],
  cheese: ["Cheddar", "Brie", "Gouda", "Mozzarella", "Parmesan", "Feta", "Swiss", "Camembert", "Provolone", "Havarti"],
  fruit: ["Apple", "Banana", "Orange", "Grape", "Mango", "Pear", "Peach", "Cherry", "Lemon", "Strawberry", "Plum", "Kiwi"],
  vegetable: ["Carrot", "Broccoli", "Potato", "Onion", "Spinach", "Celery", "Pepper", "Lettuce", "Corn", "Cabbage", "Pea", "Cucumber"],
  animal: ["Dog", "Cat", "Horse", "Lion", "Tiger", "Bear", "Wolf", "Fox", "Elephant", "Giraffe", "Monkey", "Zebra"],
  bird: ["Eagle", "Robin", "Owl", "Sparrow", "Penguin", "Parrot", "Crow", "Hawk", "Duck", "Swan", "Falcon", "Pigeon"],
  fish: ["Salmon", "Tuna", "Trout", "Bass", "Cod", "Shark", "Goldfish", "Catfish", "Eel", "Carp", "Perch", "Pike"],
  color: ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink", "Brown", "Black", "White", "Gray", "Teal"],
  country: ["France", "Brazil", "Japan", "Canada", "Egypt", "India", "Italy", "Mexico", "Spain", "China", "Germany", "Peru"],
  state: ["Texas", "Florida", "Ohio", "Maine", "Utah", "Iowa", "Nevada", "Oregon", "Alaska", "Georgia", "Hawaii", "Idaho"],
  city: ["Paris", "London", "Tokyo", "Rome", "Madrid", "Berlin", "Sydney", "Cairo", "Moscow", "Dallas", "Boston", "Miami"],
  planet: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"],
  element: ["Hydrogen", "Oxygen", "Carbon", "Iron", "Gold", "Silver", "Helium", "Neon", "Copper", "Zinc", "Sodium", "Lead"],
  language: ["English", "Spanish", "French", "German", "Chinese", "Arabic", "Hindi", "Russian", "Italian", "Japanese", "Korean", "Latin"],
  month: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  car: ["Toyota", "Ford", "Honda", "BMW", "Tesla", "Audi", "Chevrolet", "Nissan", "Jeep", "Subaru", "Mazda", "Kia"],
  sport: ["Soccer", "Tennis", "Golf", "Hockey", "Rugby", "Boxing", "Baseball", "Cricket", "Football", "Basketball", "Swimming", "Skiing"],
  instrument: ["Guitar", "Piano", "Violin", "Drums", "Flute", "Trumpet", "Cello", "Harp", "Saxophone", "Clarinet", "Banjo", "Tuba"],
  dog: ["Poodle", "Beagle", "Bulldog", "Husky", "Corgi", "Boxer", "Dachshund", "Pug", "Labrador", "Collie", "Terrier", "Chihuahua"],
  drink: ["Water", "Coffee", "Tea", "Milk", "Juice", "Soda", "Beer", "Wine", "Lemonade", "Cola", "Smoothie", "Cocoa"],
  tree: ["Oak", "Maple", "Pine", "Birch", "Willow", "Elm", "Cedar", "Palm", "Spruce", "Ash", "Fir", "Redwood"],
  flower: ["Rose", "Tulip", "Daisy", "Lily", "Orchid", "Sunflower", "Daffodil", "Violet", "Poppy", "Lotus", "Iris", "Lilac"],
  subject: ["Math", "Science", "History", "English", "Art", "Music", "Biology", "Chemistry", "Physics", "Geography", "Gym", "Algebra"],
  job: ["Doctor", "Teacher", "Nurse", "Lawyer", "Chef", "Pilot", "Farmer", "Plumber", "Engineer", "Artist", "Police", "Firefighter"]
};

const ALIAS = { army: "military", navy: "military", rank: "military", ranks: "military", cities: "city", states: "state", breed: "dog", breeds: "dog", cars: "car", brand: "car", beverage: "drink", beverages: "drink", occupation: "job", profession: "job", school: "subject", countries: "country" };

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

// Orders titles by recent pageviews, so well-known answers come before obscure ones.
async function byPopularity(titles) {
  const views = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const r = await wiki({ action: "query", prop: "pageviews", pvipdays: "30", titles: batch.join("|") });
    for (const p of Object.values(r.query?.pages || {})) {
      views.set(p.title, Object.values(p.pageviews || {}).reduce((sum, v) => sum + (v || 0), 0));
    }
  }
  return [...titles].sort((a, b) => (views.get(b) || 0) - (views.get(a) || 0));
}

async function fromCategory(topic) {
  const s = await wiki({ action: "query", list: "search", srsearch: topic, srnamespace: "14", srlimit: "3" });
  for (const hit of s.query?.search || []) {
    const m = await wiki({
      action: "query", list: "categorymembers", cmtitle: hit.title, cmtype: "page", cmlimit: "150"
    });
    const titles = (m.query?.categorymembers || []).map((p) => p.title).filter((t) => usable(clean(t)));
    if (titles.length >= 5) return (await byPopularity(titles)).map(clean);
  }
  return [];
}

async function fromListPage(topic) {
  const s = await wiki({ action: "query", list: "search", srsearch: `List of ${topic}`, srlimit: "1" });
  const page = s.query?.search?.[0]?.title;
  if (!page) return [];
  const l = await wiki({ action: "query", prop: "links", titles: page, pllimit: "100", plnamespace: "0" });
  const pages = Object.values(l.query?.pages || {});
  const titles = (pages[0]?.links || []).map((x) => x.title).filter((t) => usable(clean(t)));
  return (await byPopularity(titles)).map(clean);
}

async function candidates(topic) {
  const words = topic.split(/\s+/);
  const keys = [topic, singular(topic), ...words, ...words.map(singular)];
  for (const k of keys) if (BUNDLED[k]) return BUNDLED[k];
  for (const w of words) if (ALIAS[w]) return BUNDLED[ALIAS[w]];

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
  names = [...new Set(names)].slice(0, 40);
  if (names.length) await chrome.storage.local.set({ [cacheKey]: names });
  return names;
}

async function suggest(prompt, used) {
  const topic = topicOf(prompt);
  if (!topic) throw new Error("Couldn't work out the category.");
  const usedSet = new Set(used.map((u) => u.toLowerCase()));
  const answers = (await candidates(topic)).filter((n) => !usedSet.has(n.toLowerCase())).slice(0, 8);
  if (!answers.length) throw new Error(`No answers found for "${topic}".`);
  return { answers, topic };
}

if (typeof module !== "undefined") module.exports = { topicOf, singular, clean, usable };
