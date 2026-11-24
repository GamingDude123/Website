/* The vault: encryption round trip, wrong passphrase, tampering, bad files.
 *
 *   node portals/test/vault.test.js
 */

const Vault = require(__dirname + "/../js/vault.js");
const Model = require(__dirname + "/../js/model.js");

let fails = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined ? "  " + extra : ""));
  if (!cond) fails++;
}
async function rejects(promise) {
  try { await promise; } catch (err) { return err; }
  return null;
}

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

(async () => {
  const PASS = "correct horse battery";
  const data = Model.emptyData();
  data.portals.push({ id: "a1", name: "Canvas", url: "https://canvas.example.edu/", username: "jsmith", password: "Sup3r-S3cret!pw" });

  // ---- round trip
  const session = await Vault.create(PASS);
  const env = await Vault.seal(session, data);
  const opened = await Vault.open(env, PASS);
  check("round trip returns the same data", JSON.stringify(opened.data) === JSON.stringify(data));
  check("opened session can save again", (await Vault.open(await Vault.seal(opened.session, opened.data), PASS)).data.portals[0].password === "Sup3r-S3cret!pw");

  // ---- nothing readable at rest
  const stored = JSON.stringify(env);
  check("envelope does not contain the password", !stored.includes("Sup3r-S3cret"));
  check("envelope does not contain the username", !stored.includes("jsmith"));
  check("envelope does not contain the portal name or address", !stored.includes("Canvas") && !stored.includes("canvas.example"));
  check("envelope records a strong round count", env.iter >= 600000, env.iter);

  // ---- fresh IV every save, same salt
  const env2 = await Vault.seal(session, data);
  check("every save uses a new IV", env.iv !== env2.iv);
  check("every save has different ciphertext", env.ct !== env2.ct);
  check("the salt stays with the vault", env.salt === env2.salt);

  // ---- wrong passphrase
  const wrong = await rejects(Vault.open(env, "correct horse batterz"));
  check("wrong passphrase is refused", wrong instanceof Vault.VaultError, wrong && wrong.message);
  const empty = await rejects(Vault.open(env, ""));
  check("empty passphrase is refused", empty instanceof Vault.VaultError);

  // ---- same passphrase typed in another Unicode form still works
  const eSession = await Vault.create("café au lait 42");
  const eEnv = await Vault.seal(eSession, data);
  check("NFC and NFD forms of the same passphrase match",
    (await Vault.open(eEnv, "café au lait 42")).data.portals.length === 1);

  // ---- tampering
  function flip(b64, at) {
    const raw = Buffer.from(b64, "base64");
    raw[at] ^= 1;
    return raw.toString("base64");
  }
  const badCt = await rejects(Vault.open(Object.assign({}, env, { ct: flip(env.ct, 3) }), PASS));
  check("a flipped ciphertext bit is refused", badCt instanceof Vault.VaultError);
  const badIv = await rejects(Vault.open(Object.assign({}, env, { iv: flip(env.iv, 0) }), PASS));
  check("a flipped IV bit is refused", badIv instanceof Vault.VaultError);
  const badSalt = await rejects(Vault.open(Object.assign({}, env, { salt: flip(env.salt, 0) }), PASS));
  check("a flipped salt bit is refused", badSalt instanceof Vault.VaultError);

  // ---- malformed or hostile files
  const bad = [
    ["not JSON", "this is not json"],
    ["JSON null", "null"],
    ["wrong app", JSON.stringify(Object.assign({}, env, { app: "something-else" }))],
    ["wrong version", JSON.stringify(Object.assign({}, env, { v: 2 }))],
    ["wrong kdf", JSON.stringify(Object.assign({}, env, { kdf: "scrypt" }))],
    ["huge round count (would hang the tab)", JSON.stringify(Object.assign({}, env, { iter: 1e12 }))],
    ["tiny round count (weak)", JSON.stringify(Object.assign({}, env, { iter: 1 }))],
    ["short salt", JSON.stringify(Object.assign({}, env, { salt: "AAAA" }))],
    ["short IV", JSON.stringify(Object.assign({}, env, { iv: "AAAA" }))],
    ["missing ciphertext", JSON.stringify(Object.assign({}, env, { ct: "" }))],
    ["not base64", JSON.stringify(Object.assign({}, env, { salt: "!!!!" }))],
  ];
  for (const [name, text] of bad) {
    const err = await rejects(Vault.open(text, PASS));
    check("rejects: " + name, err instanceof Vault.VaultError, err && err.message);
  }
  check("accepts the real envelope as a JSON string", (await Vault.open(JSON.stringify(env), PASS)).data.portals.length === 1);

  // ---- passphrase rules
  const short = await rejects(Vault.create("short"));
  check("a too-short passphrase is refused", short instanceof Vault.VaultError, short && short.message);

  // ---- storage helpers
  const store = memoryStorage();
  check("read on empty storage is null", Vault.read(store) === null);
  Vault.write(store, env);
  check("write then read gives the envelope back", JSON.parse(Vault.read(store)).ct === env.ct);
  check("stored text has no secrets", !Vault.read(store).includes("Sup3r"));
  Vault.clear(store);
  check("clear removes it", Vault.read(store) === null);
  const throwing = { getItem() { throw new Error("blocked"); } };
  check("read survives a storage that throws", Vault.read(throwing) === null);

  console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
  process.exit(fails ? 1 : 0);
})();
