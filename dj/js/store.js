/* Your files, kept in this browser.
 *
 * A page that forgets everything on refresh is no use for a library, so every
 * track that is added is saved to IndexedDB as the original file bytes (a Blob,
 * which the browser stores on disk, not in memory) with its title, artist, the
 * analysis result (a few kilobytes) and the by-hand fixes: key and downbeat.
 * On the next visit the files are decoded again from those bytes, and the
 * stored analysis is reused so nothing is re-analysed. Nothing leaves the
 * browser. The generated demo tracks have no file, so only their name is kept
 * and they are re-rendered.
 *
 * Every call can fail (private windows, a full disk, storage turned off), so
 * every call returns a promise the caller may ignore or catch; the page works
 * the same without it, just forgetfully.
 */

var Store = (function () {
  "use strict";

  const DB = "autopilot-dj", VERSION = 1, TRACKS = "tracks";
  let opened = null;

  function open() {
    if (!opened) {
      opened = new Promise(function (resolve, reject) {
        if (typeof indexedDB === "undefined") { reject(new Error("this browser has no local storage for files")); return; }
        let req;
        try { req = indexedDB.open(DB, VERSION); } catch (e) { reject(e); return; }
        req.onupgradeneeded = function () { req.result.createObjectStore(TRACKS, { keyPath: "key" }); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || new Error("could not open the file store")); };
        req.onblocked = function () { reject(new Error("the file store is blocked by another tab")); };
      }).catch(function (e) { opened = null; throw e; });
    }
    return opened;
  }

  // run fn(store) in one transaction; resolves with fn's request result once it has committed
  function run(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(TRACKS, mode);
        let req = null;
        try { req = fn(tx.objectStore(TRACKS)); } catch (e) { reject(e); return; }
        tx.oncomplete = function () { resolve(req && "result" in req ? req.result : undefined); };
        tx.onerror = function () { reject(tx.error || new Error("could not write to the file store")); };
        tx.onabort = function () { reject(tx.error || new Error("the file store ran out of room or refused the write")); };
      });
    });
  }

  function newKey() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }

  // every saved track, oldest first
  function all() {
    return run("readonly", function (s) { return s.getAll(); }).then(function (rows) {
      return (rows || []).filter(function (r) { return r && r.key; }).sort(function (a, b) { return (a.added || 0) - (b.added || 0); });
    });
  }
  function get(key) { return run("readonly", function (s) { return s.get(key); }); }
  function put(rec) { return run("readwrite", function (s) { return s.put(rec); }); }
  function remove(key) { return run("readwrite", function (s) { return s.delete(key); }); }

  // change a few fields of a saved track, if it is still there
  function patch(key, fields) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(TRACKS, "readwrite"), st = tx.objectStore(TRACKS), get = st.get(key);
        get.onsuccess = function () { if (get.result) st.put(Object.assign({}, get.result, fields)); };
        tx.oncomplete = function () { resolve(); };
        tx.onerror = tx.onabort = function () { reject(tx.error || new Error("could not update the file store")); };
      });
    });
  }

  function clear() { return run("readwrite", function (s) { return s.clear(); }); }

  // Ask the browser not to throw the files away when it is short of space.
  // Best effort: some browsers ask the person, some decide for themselves.
  function keep() {
    try { if (navigator.storage && navigator.storage.persist) return navigator.storage.persist().catch(function () { return false; }); } catch (e) { /* ignore */ }
    return Promise.resolve(false);
  }

  // what is used and what is left, in bytes, where the browser will say
  function usage() {
    try { if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate().catch(function () { return null; }); } catch (e) { /* ignore */ }
    return Promise.resolve(null);
  }

  return { newKey: newKey, all: all, get: get, put: put, patch: patch, remove: remove, clear: clear, keep: keep, usage: usage };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Store;
