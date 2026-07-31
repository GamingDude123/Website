/* Keeping the kit between visits.
 *
 * Pads are stored as WAV blobs rather than arrays of numbers: a four second
 * take is 350 KB of Float32, and JSON.stringify on that is both enormous and
 * lossy at the edges. Both the raw take and the polished version are kept, so
 * the raw/polished switch still works after a reload and so a kit can be
 * re-polished into a different key later.
 */

var Store = (function () {
  "use strict";

  const DB_NAME = "loop-lab";
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        const db = request.result;
        if (!db.objectStoreNames.contains("pads")) db.createObjectStore("pads", { keyPath: "id" });
        if (!db.objectStoreNames.contains("session")) db.createObjectStore("session", { keyPath: "key" });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
    return dbPromise;
  }

  function tx(storeName, mode, work) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        let result;
        try {
          result = work(store);
        } catch (err) {
          reject(err);
          return;
        }
        transaction.oncomplete = function () {
          resolve(result instanceof IDBRequest ? result.result : result);
        };
        transaction.onerror = function () { reject(transaction.error); };
        transaction.onabort = function () { reject(transaction.error); };
      });
    });
  }

  function toBlob(samples, sampleRate) {
    return new Blob([DSP.encodeWav([samples], sampleRate)], { type: "audio/wav" });
  }

  /* Decoding needs a context, so it is passed in rather than made here. */
  function fromBlob(ctx, blob) {
    return blob.arrayBuffer().then(function (data) {
      return new Promise(function (resolve, reject) {
        ctx.decodeAudioData(data, resolve, reject);
      });
    }).then(function (buffer) {
      return Float32Array.from(buffer.getChannelData(0));
    });
  }

  /* Only the fields worth keeping — never the AudioBuffer cache hanging off
   * the pad, which belongs to a context that will not exist next time. */
  function savePads(pads) {
    return tx("pads", "readwrite", function (store) {
      store.clear();
      pads.forEach(function (pad, index) {
        store.put({
          id: pad.id,
          order: index,
          slot: pad.slot,
          name: pad.name,
          autoName: pad.autoName,
          autoIndex: pad.autoIndex,
          role: pad.role,
          instrument: pad.instrument,
          morph: pad.morph,
          sampleRate: pad.sampleRate,
          raw: toBlob(pad.raw, pad.sampleRate),
          polished: pad.polished ? toBlob(pad.polished, pad.sampleRate) : null,
          usePolished: pad.usePolished,
          gain: pad.gain,
          pan: pad.pan,
          pitch: pad.pitch,
          length: pad.length,
          sends: pad.sends,
          duck: pad.duck,
          beats: pad.beats,
          note: pad.note,
          shifted: pad.shifted,
          reverse: pad.reverse,
          mute: pad.mute,
          steps: pad.steps || [],
          report: pad.report || [],
        });
      });
    });
  }

  function loadPads(ctx) {
    return tx("pads", "readonly", function (store) {
      return store.getAll();
    }).then(function (records) {
      if (!records || !records.length) return [];
      records.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      return Promise.all(records.map(function (record) {
        const jobs = [fromBlob(ctx, record.raw)];
        jobs.push(record.polished ? fromBlob(ctx, record.polished) : Promise.resolve(null));
        return Promise.all(jobs).then(function (both) {
          record.raw = both[0];
          record.polished = both[1];
          return record;
        });
      }));
    }).catch(function () {
      return [];
    });
  }

  function saveSession(session) {
    return tx("session", "readwrite", function (store) {
      store.put({ key: "current", value: session });
    });
  }

  function loadSession() {
    return tx("session", "readonly", function (store) {
      return store.get("current");
    }).then(function (record) {
      return record ? record.value : null;
    }).catch(function () {
      return null;
    });
  }

  function clear() {
    return Promise.all([
      tx("pads", "readwrite", function (store) { store.clear(); }),
      tx("session", "readwrite", function (store) { store.clear(); }),
    ]);
  }

  return {
    savePads: savePads,
    loadPads: loadPads,
    saveSession: saveSession,
    loadSession: loadSession,
    clear: clear,
    toBlob: toBlob,
  };
})();
