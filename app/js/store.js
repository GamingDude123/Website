/* IndexedDB storage.
 *
 * Game files live here as Blobs rather than in localStorage — a GBA ROM can be
 * 32 MB and localStorage caps out around 5 MB of strings.
 */

const DB_NAME = "wii-channel-arcade";
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("games")) {
        db.createObjectStore("games", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("bios")) {
        db.createObjectStore("bios", { keyPath: "core" });
      }
      if (!db.objectStoreNames.contains("shelf")) {
        db.createObjectStore("shelf", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx(storeName, mode, work) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    try {
      result = work(store);
    } catch (err) {
      reject(err);
      return;
    }
    // Unwrap IDBRequest explicitly — a miss has `result === undefined`, so
    // testing the property would resolve with the request object itself.
    transaction.oncomplete = () => resolve(
      result instanceof IDBRequest ? result.result : result
    );
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

function newId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/* ---------- Games -------------------------------------------------------- */

const Games = {
  add(file, core) {
    const record = {
      id: newId(),
      title: prettyTitle(file.name),
      filename: file.name,
      core: core,
      size: file.size,
      added: Date.now(),
      lastPlayed: 0,
      playSeconds: 0,
      blob: file
    };
    return tx("games", "readwrite", (store) => store.put(record)).then(() => record);
  },

  all() {
    return tx("games", "readonly", (store) => store.getAll())
      .then((games) => (games || []).sort((a, b) => a.added - b.added));
  },

  get(id) {
    return tx("games", "readonly", (store) => store.get(id));
  },

  update(id, patch) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction("games", "readwrite");
      const store = transaction.objectStore("games");
      const request = store.get(id);
      request.onsuccess = () => {
        const record = request.result;
        if (!record) {
          resolve(null);
          return;
        }
        Object.assign(record, patch);
        store.put(record);
        resolve(record);
      };
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    }));
  },

  /* Adds elapsed play time without clobbering a concurrent update. */
  addPlaytime(id, seconds) {
    if (!seconds || seconds < 1) return Promise.resolve(null);
    return Games.get(id).then((record) => {
      if (!record) return null;
      return Games.update(id, {
        playSeconds: (record.playSeconds || 0) + Math.round(seconds),
        lastPlayed: Date.now()
      });
    });
  },

  remove(id) {
    return tx("games", "readwrite", (store) => store.delete(id));
  }
};

/* ---------- BIOS files --------------------------------------------------- */

const Bios = {
  put(core, file) {
    return tx("bios", "readwrite", (store) => store.put({
      core: core, filename: file.name, blob: file, added: Date.now()
    }));
  },
  get(core) {
    return tx("bios", "readonly", (store) => store.get(core));
  },
  all() {
    return tx("bios", "readonly", (store) => store.getAll()).then((r) => r || []);
  },
  remove(core) {
    return tx("bios", "readwrite", (store) => store.delete(core));
  }
};

/* ---------- Dolphin shelf (Wii / Wii U titles) --------------------------- */

const Shelf = {
  add(entry) {
    const record = Object.assign({
      id: newId(),
      title: "Untitled",
      platform: "wii",
      status: "backlog",
      playMinutes: 0,
      rating: 0,
      notes: "",
      settings: "",
      added: Date.now()
    }, entry);
    return tx("shelf", "readwrite", (store) => store.put(record)).then(() => record);
  },

  all() {
    return tx("shelf", "readonly", (store) => store.getAll())
      .then((rows) => (rows || []).sort((a, b) => a.title.localeCompare(b.title)));
  },

  get(id) {
    return tx("shelf", "readonly", (store) => store.get(id));
  },

  update(id, patch) {
    return Shelf.get(id).then((record) => {
      if (!record) return null;
      Object.assign(record, patch);
      return tx("shelf", "readwrite", (store) => store.put(record)).then(() => record);
    });
  },

  remove(id) {
    return tx("shelf", "readwrite", (store) => store.delete(id));
  }
};

/* ---------- Small key/value settings ------------------------------------- */

const Settings = {
  get(key, fallback) {
    return tx("settings", "readonly", (store) => store.get(key))
      .then((row) => (row ? row.value : fallback));
  },
  set(key, value) {
    return tx("settings", "readwrite", (store) => store.put({ key: key, value: value }));
  }
};

/* Ask the browser not to evict the library when storage gets tight. Safari and
   Chrome both grant this silently for installed PWAs. */
function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    return navigator.storage.persist().catch(() => false);
  }
  return Promise.resolve(false);
}

function storageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    return navigator.storage.estimate().catch(() => null);
  }
  return Promise.resolve(null);
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return (value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)) + " " + units[unit];
}

function formatDuration(seconds) {
  if (!seconds) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours && minutes) return hours + "h " + minutes + "m";
  if (hours) return hours + "h";
  return Math.max(1, minutes) + "m";
}
