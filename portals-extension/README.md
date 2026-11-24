# College Portals (Chrome extension)

One page that shows the **status of every college application** as a simple graphic,
and lets you flip through the portals with arrows **without leaving the page**. Your
password manager (Dashlane, etc.) does the signing in, as it does anywhere else.

```
 ●━━━━━●━━━━━◉─────○        Duke                    "Under review"
 Submitted  Received  In review  Decision           Checked 3 min ago
```

Each college's card is drawn in the colours of its own icon.

## Install (once)

Works in Chrome, Edge and Brave on a computer. It does not work on phones.

1. Download **portals-extension.zip** and unzip it. You get a folder called `portals-extension`.
2. In Chrome, open `chrome://extensions`, switch on **Developer mode** (top right), click **Load unpacked**, and choose that `portals-extension` folder.
3. Click the puzzle-piece icon in Chrome's toolbar and pin **College Portals**. Click it to open.

Chrome will say the extension can "read and change data on all websites". See *What it can see*
below for exactly what that is for. Chrome may also show a "disable developer mode extensions"
notice now and then; that is normal for an extension loaded this way.

## Set it up (once)

1. Click **Edit list** and type one college per line. A college this extension already knows needs
   **only its name**; for any other, put its name and then the web address of its application portal:
   ```
   Yale University
   Duke apply.duke.edu
   ```
   (A copy built for one person, see *A copy for one person* below, already knows their colleges and
   starts with them in the list, so there's nothing to type.)
2. Click **Start setup**. It walks you through the colleges one after another. For each: sign in
   (your password manager fills it in), go to the page that shows your application status, click
   **Pick the status**, and click those words (for example "Under review"). It saves that and moves
   straight on to the next college. **Skip this one** leaves a college for later; **Stop setup** ends
   the walk-through.

Picking also remembers **which page** you were on, so later checks go straight to that page. That means a
college's starting address only has to get you into its portal; it doesn't have to be the page with the status
(a menu or home page is fine). **Start page** in the portal view takes you back to where it starts.

I can't do step 2 for you: it needs you signed in to your own portals. It takes about a minute per
college, and only once.

## Every day

Open the extension. It checks every college for you, one after another, and the cards update.
**Check all** does it again on demand. A card says **Sign in needed** if a portal has logged you
out; click it, sign in, and it is read again next time. If a portal's status changes, the card
says what it changed from.

**It updates by itself while it's open.** Anything not looked at in the last 15 minutes is checked
again, every minute or so it asks whether anything is due, and it also checks when you come back to the
tab. It leaves the portal alone while you're looking at one. Right-click the tab and choose **Pin**
to keep it open and out of the way. Your list, what you set up, and the last status of each college
are saved in the browser, so reopening picks up where you left off.

The graphic has four steps: Submitted, Received, In review, Decision. The last step becomes
**Admitted** (green tick), **Waitlisted** (amber !) or **Not admitted** (red cross) when the
portal's words say so. The portal's own words always sit under the graphic, so a status it
doesn't recognise is shown as written rather than guessed at.

## Colours

Each card takes its colours from the icon the college's own site uses (the little logo in a
browser tab). If a site has none, or it's a shared site such as Common App and you'd rather
have the college's colours, put them at the end of the line in the list:

```
Duke apply.duke.edu #001a57
University of Michigan admissions.umich.edu #00274c #ffcb05
```

One colour, or two (the second is used for the glow around the current step).

## Can I close my computer?

Not for this. It checks the portals **in your browser**, so it only works while Chrome is open
on a computer that is awake, with the extension's tab open (pinned is fine). Closing the lid stops
it. Opening it again checks everything that is out of date straight away, and the cards show when
each portal was last checked.

## What it can't do

- **Dashlane is untested.** Autofill inside the page depends on how Dashlane treats pages shown
  inside an extension, which can't be tested without a Dashlane account. If it doesn't fill the
  login there, click **Open in a tab** (top right of any portal) to sign in normally, then come back.
  Because the hub reuses the same browser sessions, you stay signed in.
- **Some portals won't take your password inside the page.** Sign-in pages can behave differently when shown inside
  another page (especially ones that hand off to a school-wide sign-in). If one says your password is wrong when
  it isn't, click **Open in a tab**, sign in there, and come back: the extension uses the same sign-in, and
  everything else works from then on.
- **It can't make a portal remember you.** Staying signed in is up to each portal. Some sign you out
  after a short time, or after you close Chrome. That is what **Sign in needed** is for.
- **Some portals won't work in a frame** even with the framing headers removed (for example ones
  that demand a security code every time, or check what browser you're using). Use **Open in a tab**.
- **It reads only the words you picked.** If a portal redesigns its page, the card says it couldn't
  find the status; click **Pick again**.
- **The graphic is a guess from the words**, so it can be wrong for unusual wording. The portal's
  own words are always shown beside it.

## What it can see, and what it keeps

- It stores your list (names and addresses), where each status is on its page, the last words
  each portal showed, and the colours. **No passwords or usernames.** Nothing is sent anywhere or
  synced; it stays in this browser.
- **Read and change data on all websites** is needed for one thing: so portals that forbid being
  shown inside another page can be shown inside this one. While the College Portals tab is open,
  the extension switches off the `X-Frame-Options` and `Content-Security-Policy` headers for pages
  loaded **inside that tab's frame**, and nowhere else. Other tabs are untouched. (Those headers
  are how a site stops other pages from framing it, so a site's framing protection is off for
  that one frame while the tab is open.)
- A small script (`reader.js`) is loaded into every page, but it checks whether the page is inside
  the College Portals frame and does nothing otherwise.
- The only network requests it makes are to the portals you listed: loading the portal, and
  fetching its icon to pick the card colours.
- The permissions are `storage` (to keep the list) and `declarativeNetRequest` (the framing rule).
  No cookies, history or tabs permission.

## A copy for one person

The download ships with no colleges in it. To make a copy that already knows someone's colleges (so
a line can be just a name) and starts with them in the list, write a small file and build it:

```json
{ "colleges": [ { "name": "Yale University",
                  "aliases": ["Yale"],
                  "url": "https://apply.yale.edu/status",
                  "colors": ["#00356b"] } ] }
```

```sh
python3 portals-extension/pack.py --personal mine.json --out mine.zip
```

Keep `mine.json` out of the repo: a repo that is public would then say which colleges someone applied
to. The check in `pack.py --check` fails if the committed `colleges.js` or `starter.js` isn't empty.
A name is matched whole (ignoring capitals and punctuation), so "Rice College" can never be taken for
"Rice University". An address typed on a line wins over the directory's, and keeps its colours.

## Keeping it

Leave the `portals-extension` folder where it is: Chrome runs the extension from it, and your list and
setup are stored against it. To update, replace the files in that same folder and click the reload
arrow on the extension's card in `chrome://extensions`. Your list and setup are kept. (Removing the
extension, or loading it from a different folder, starts you from nothing.)

## Tests

```sh
node portals-extension/test/portals.test.js     # the list, the directory, what a status means, colours
node portals-extension/test/extension.test.js   # the real extension in a real browser
node portals-extension/test/personal.test.js    # a copy built for one person: seeding, guided setup, auto-update
```

The second needs playwright and Chromium (`npm i -D playwright && npx playwright install chromium`).
It runs pretend portals that behave like real ones (they refuse framing, want a login, keep a
`SameSite=Lax` cookie, hop between hosts, draw their status late, change their status) and
checks the whole flow, including that the manifest asks for nothing more than it should and
that no network call has been added without the test noticing. The personal-copy test uses made-up
colleges (`test/fixtures/example-colleges.json`) and fast-forwards the clock to check the cards
refresh by themselves.

To rebuild the zip after changing anything: `python3 portals-extension/pack.py`
(`--check` verifies it is up to date; the extension test does this too).
