/* Talks to Wii Bridge — the helper that runs on your own computer.
 *
 * A web page can't open a Mac application; that limit is the reason the Launch
 * button has only ever been able to give directions. The bridge isn't a web
 * page though, it's a program on the Mac, so it can. This is the thin client
 * that asks it to.
 *
 * The same helper carries the phone's gyroscope into Dolphin as an emulated
 * Wii Remote. See app/bridge/README.md.
 */

const LocalBridge = (function () {
  /* Both spellings, because which one resolves is a coin toss: some setups
     have localhost pinned to ::1 while the bridge is listening on IPv4. */
  const HOSTS = ["https://localhost:8443", "https://127.0.0.1:8443"];
  const SETUP_HOST = "http://localhost:8080";
  const PROBE_TIMEOUT = 1500;

  let found = null;       // the host that answered, once one has
  let lastStatus = null;

  function withTimeout(url, options, ms) {
    // A bridge that isn't running doesn't refuse quickly on every platform —
    // it can hang until the browser's own timeout, which is far too long to
    // leave a button saying "checking…".
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const opts = Object.assign({ signal: controller.signal, mode: "cors" }, options || {});
    return fetch(url, opts)
      .then((response) => {
        clearTimeout(timer);
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .catch((err) => {
        clearTimeout(timer);
        throw err;
      });
  }

  /* Resolves with the status object, or null if no bridge answered.
     Deliberately never rejects: every caller wants "is it there or not". */
  function probe() {
    const hosts = found ? [found] : HOSTS;
    let chain = Promise.reject();

    hosts.forEach((host) => {
      chain = chain.catch(() =>
        withTimeout(host + "/status", null, PROBE_TIMEOUT).then((status) => {
          found = host;
          lastStatus = status;
          return status;
        }));
    });

    return chain.catch(() => {
      found = null;
      lastStatus = null;
      return null;
    });
  }

  /* Resolves with {ok, message}. A network failure here is reported as its
     own kind of failure rather than as Dolphin refusing to start. */
  function launch() {
    if (!found) {
      return Promise.resolve({ ok: false, unreachable: true, message: "No bridge running." });
    }
    return withTimeout(found + "/launch", { method: "POST" }, 12000)
      .catch(() => ({ ok: false, unreachable: true, message: "The bridge stopped answering." }));
  }

  function controllerUrl() {
    return (found || HOSTS[0]) + "/";
  }

  return {
    probe: probe,
    launch: launch,
    controllerUrl: controllerUrl,
    setupUrl: SETUP_HOST,
    get status() { return lastStatus; },
    get host() { return found; }
  };
})();
