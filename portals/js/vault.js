/* Keeping the logins.
 *
 * This site is public, so nothing about a login can live in the repository.
 * Instead the whole portal list (names, addresses, usernames, passwords, which
 * ones are checked) is encrypted with a passphrase you choose and the
 * ciphertext is kept in this browser's localStorage.
 *
 *   passphrase --PBKDF2-SHA256, 600,000 rounds, random salt--> AES-256 key
 *   portal list --AES-GCM, fresh random IV on every save------> ciphertext
 *
 * Nothing leaves the browser: the page's Content-Security-Policy forbids network
 * requests altogether. There is no recovery if the passphrase is forgotten,
 * which is the point of it.
 *
 * The derived key is non-extractable and kept in memory only while unlocked, so
 * saving a change does not repeat the slow key derivation.
 */

var Vault = (function () {
  "use strict";

  const STORAGE_KEY = "college-portals.vault";
  const APP = "college-portals";
  const VERSION = 1;
  const ITER = 600000;
  // A backup file is untrusted input: an absurd round count would hang the tab.
  const MIN_ITER = 100000;
  const MAX_ITER = 5000000;
  const MIN_PASSPHRASE = 8;
  const AAD = new TextEncoder().encode("college-portals/v1");

  class VaultError extends Error {
    constructor(message) { super(message); this.name = "VaultError"; }
  }

  function toB64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function fromB64(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  async function deriveKey(passphrase, salt, iter) {
    // NFKC so the same passphrase typed on another keyboard or device matches.
    const raw = new TextEncoder().encode(String(passphrase).normalize("NFKC"));
    const base = await crypto.subtle.importKey("raw", raw, "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: iter },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  /* A new vault: fresh salt, new key. Returns the session to seal data with. */
  async function create(passphrase) {
    if (typeof passphrase !== "string" || passphrase.length < MIN_PASSPHRASE) {
      throw new VaultError("Use at least " + MIN_PASSPHRASE + " characters.");
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(passphrase, salt, ITER);
    return { key: key, salt: salt, iter: ITER };
  }

  /* Encrypt `data` into an envelope that can be stored or exported as is. */
  async function seal(session, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(data));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv, additionalData: AAD }, session.key, plain);
    return {
      app: APP,
      v: VERSION,
      kdf: "PBKDF2-SHA256",
      iter: session.iter,
      salt: toB64(session.salt),
      iv: toB64(iv),
      ct: toB64(new Uint8Array(ct)),
    };
  }

  /* Check an envelope's shape before using any of it. */
  function parse(input) {
    let env = input;
    if (typeof input === "string") {
      try { env = JSON.parse(input); } catch (err) { throw new VaultError("That isn't a portals backup."); }
    }
    if (!env || typeof env !== "object" || env.app !== APP || env.v !== VERSION || env.kdf !== "PBKDF2-SHA256") {
      throw new VaultError("That isn't a portals backup.");
    }
    if (!Number.isInteger(env.iter) || env.iter < MIN_ITER || env.iter > MAX_ITER) {
      throw new VaultError("That backup uses settings this page won't accept.");
    }
    try {
      if (fromB64(env.salt).length !== 16 || fromB64(env.iv).length !== 12 || fromB64(env.ct).length < 16) throw 0;
    } catch (err) {
      throw new VaultError("That backup is damaged.");
    }
    return env;
  }

  /* Unlock: returns the decrypted data and a session for saving changes. */
  async function open(input, passphrase) {
    const env = parse(input);
    const salt = fromB64(env.salt);
    const key = await deriveKey(passphrase, salt, env.iter);
    let plain;
    try {
      plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromB64(env.iv), additionalData: AAD }, key, fromB64(env.ct));
    } catch (err) {
      // GCM cannot tell a wrong passphrase from a tampered file, and shouldn't.
      throw new VaultError("That passphrase didn't unlock it.");
    }
    let data;
    try { data = JSON.parse(new TextDecoder().decode(plain)); } catch (err) { throw new VaultError("That backup is damaged."); }
    return { data: data, session: { key: key, salt: salt, iter: env.iter } };
  }

  /* localStorage, which can be missing or throw (private mode, blocked data). */
  function read(storage) {
    try { return storage.getItem(STORAGE_KEY); } catch (err) { return null; }
  }
  function write(storage, envelope) {
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  }
  function clear(storage) {
    storage.removeItem(STORAGE_KEY);
  }

  const Vault = {
    STORAGE_KEY: STORAGE_KEY,
    MIN_PASSPHRASE: MIN_PASSPHRASE,
    VaultError: VaultError,
    create: create,
    seal: seal,
    open: open,
    parse: parse,
    read: read,
    write: write,
    clear: clear,
  };
  return Vault;
})();

if (typeof module !== "undefined" && module.exports) module.exports = Vault;
