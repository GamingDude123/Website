# College Portals

One page that knows every portal you check — Canvas, the registrar, the
library, financial aid — and the login for each. Press the arrows to cycle
through them; press **Open portal** and it opens in a new tab with the password
already on your clipboard.

Open `portals/index.html` from the site (or straight from disk). No build step,
no dependencies, no network calls.

## Using it

1. **First visit:** choose a passphrase. It locks everything; you type it once
   each time you open the page.
2. **Add your portals** (Manage → Add a portal): a name, the web address, and
   the username and password for it.
3. **Check them:** the `‹` `›` arrows (or the left/right arrow keys, or the dots)
   cycle through the list and wrap round at the ends. For each portal:
   - **Open portal** opens it in a new tab and copies the password (or the
     username, or nothing — your choice in Manage).
   - **Copy** buttons copy the username or password on their own; **Show**
     reveals the password.
   - **Done · next** ticks it off for today and moves on. The dots turn green
     and the page tells you when all of them are done. The ticks reset at
     midnight, and the page opens on the first portal you haven't checked yet.
4. **Lock** when you walk away. It also locks itself after 30 minutes without
   you touching this tab (time spent in the portals' own tabs counts as away).

## Where the logins are kept

This site is public, so **nothing about a login is in the repository**. Names,
addresses, usernames and passwords live only in your browser's `localStorage`,
encrypted:

```
passphrase ──PBKDF2-SHA256, 600,000 rounds, random salt──▶ AES-256 key
portal list ──AES-GCM, fresh random IV on every save─────▶ ciphertext
```

- A forgotten passphrase can't be recovered. That is deliberate.
- The page's Content-Security-Policy forbids network requests altogether
  (`connect-src 'none'`, `form-action 'none'`), so a bug here can't send a login
  anywhere.
- The vault is per browser, per device. To use it on your phone too, **Manage →
  Download encrypted backup** here, then **Restore from a backup** on the lock
  screen there. The file is encrypted with your passphrase, so it is safe to
  email to yourself.
- Anyone with your unlocked browser and your passphrase can read it, like any
  password manager. Use a passphrase you'd use for one.

## What it can't do

**It can't type into a portal's login form for you.** Browsers stop a web page
from touching another site's page, so the closest a page can get is opening the
portal and putting the password on your clipboard. If you want a click to log
you straight in, that needs a browser extension rather than a web page.

**"Show the portal inside this page"** frames the portal under the card so the
arrows flip between them without leaving. It is best-effort: most college
portals (and anything behind single sign-on) send headers that forbid being
framed, and browsers block third-party cookies in frames, so you'll often get a
blank box. When that happens, use **Open portal**. The frame is sandboxed and
can't navigate this page away, and this site's own pages are never framed.

## How it's built

| File | What it does |
| --- | --- |
| `js/model.js` | The portal list: address checking, the wrap-around arrows, "checked today". No DOM, no crypto. |
| `js/vault.js` | Encrypting and decrypting the list; reading and writing the envelope. |
| `js/app.js` | Draws the lock screen, the viewer and the editor, and wires them up. |

Web addresses are the only thing allowed into a link or a frame: `javascript:`,
`data:`, `file:` and addresses with a login embedded in them are refused, and
everything from the vault is put on the page as text, never as HTML.

## Tests

```sh
node portals/test/model.test.js     # addresses, arrows, checked-today, sanitising
node portals/test/vault.test.js     # encryption, wrong passphrase, tampering, hostile files
node portals/test/browser.test.js   # the real page in a real browser
```

The first two need only node. The third needs playwright and a chromium (`npm i
-D playwright && npx playwright install chromium`, or set `CHROMIUM=/path/to/chrome`).
It serves the site on one port and a pair of pretend portals on another — one of
which sends `X-Frame-Options: DENY`, like most real ones — and then walks the
whole thing: setting the passphrase, adding and editing portals, the arrows and
their wrap-around, the clipboard, ticking off, embedding, locking (and checking
that no secret is left in the page), auto-lock, a second tab, backup and restore
into a fresh browser profile, and erase. It also fails on any console error, which
catches Content-Security-Policy violations. Screenshots are left in a temp
directory it prints at the end.
