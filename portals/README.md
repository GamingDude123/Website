# College Portals

One page that knows your portals and your logins. Arrow through them; **Open
portal** opens the one you're on in a new tab and copies its password, ready to
paste.

Open `portals/index.html` from the site (or straight from disk). No build step,
no dependencies, no network calls.

## Using it

1. **First visit:** choose a passphrase. You type it each time you open the page.
2. **Add a portal:** a name, its web address, your username and password.
3. **Check them:** `‹` `›` (or the left/right arrow keys) cycle through the list
   and wrap round at the ends. **Copy** copies the username or password; tap the
   dots to see the password. **Edit** changes or deletes the one you're on.
4. **Lock** when you walk away.

## Where the logins are kept

This site is public, so **nothing about a login is in the repository**. Your
portals live only in this browser's `localStorage`, encrypted:

```
passphrase ──PBKDF2-SHA256, 600,000 rounds, random salt──▶ AES-256 key
portal list ──AES-GCM, fresh random IV on every save─────▶ ciphertext
```

- A forgotten passphrase can't be recovered (that's the point), only erased.
- The page's Content-Security-Policy forbids network requests altogether, so a
  bug here can't send a login anywhere.
- It's per browser, per device: a phone needs its own set-up.

## What it can't do

It can't type into a portal's login form for you. Browsers stop a web page
touching another site's page, so the closest it gets is opening the portal with
the password on your clipboard. One-click login would need a browser extension.

## Files

| File | What it does |
| --- | --- |
| `js/model.js` | Which addresses are safe, how the arrows wrap, tidying what comes out of the vault. |
| `js/vault.js` | Encrypting and decrypting the list. |
| `js/app.js` | The page. |

Only web addresses are allowed into a link (`javascript:`, `data:`, `file:` and
addresses with a login in them are refused), and everything from the vault is put
on the page as text, never as HTML.

## Tests

```sh
node portals/test/model.test.js     # addresses, arrows, tidying
node portals/test/vault.test.js     # encryption, wrong passphrase, tampering, hostile files
node portals/test/browser.test.js   # the real page in a real browser
```

The browser test needs playwright and a chromium (`npm i -D playwright && npx
playwright install chromium`, or set `CHROMIUM=/path/to/chrome`). It serves the
site and a pretend portal locally, then walks through everything, including
checking that locking leaves no secret in the page. It fails on any console
error, which catches Content-Security-Policy violations. Screenshots land in a
temp directory it prints at the end.
