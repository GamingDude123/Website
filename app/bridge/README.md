# Wii Bridge

Turns your phone into a Wii Remote for Dolphin, and lets the arcade page open
Dolphin on your Mac.

Your phone already has the two sensors a Wii Remote has — an accelerometer and
a gyroscope. Dolphin already knows how to take motion from a network device;
the feature exists so a DualShock 4's gyro can drive an emulated Wii Remote,
and nothing about it is PlayStation-specific. This sits in the middle: it
reads your phone's sensors in the browser and speaks Dolphin's protocol at the
other end.

That matters for exactly one category of game. Keyboard-and-mouse Dolphin
plays GameCube titles fine and handles Wii pointer games acceptably. What it
cannot do is Wii Sports — tennis, bowling, golf, boxing are *motion*, and a
key press has no swing in it.

```
python3 app/bridge/wiibridge.py
```

No `pip install`, no virtualenv. Standard library only, and the `python3` and
`openssl` that already ship with macOS.

---

## What it starts

| Port | What |
|---|---|
| 8080 | Plain HTTP. One-time certificate setup page, nothing else. |
| 8443 | HTTPS. The controller page and the motion WebSocket. |
| 26760 | UDP. What Dolphin reads. |

---

## 1. Set up the phone (once)

Run the bridge. It prints an address like `http://your-mac.local:8080`. Open
that **on the phone** and follow it:

1. Tap **Download the certificate**, then **Allow**.
2. **Settings** → **Profile Downloaded** → **Install** → passcode → **Install**.
3. **Settings → General → About → Certificate Trust Settings** → switch on
   **Wii Bridge Local CA**.

Step 3 is the one people skip, and skipping it fails in a confusing way: the
controller page loads and then never connects.

<details>
<summary>Why a certificate at all?</summary>

Safari only hands out motion sensors to a secure page, and won't even let an
insecure one ask permission. So the bridge has to serve HTTPS, and HTTPS on
your own LAN means a certificate you made yourself.

You cannot shortcut this by tapping through Safari's warning. Safari will let
you excuse a bad certificate for a *page*, but it does not extend that
exception to a WebSocket the page opens — so the motion channel would fail
while everything looked fine. The certificate has to be genuinely trusted, and
iOS only offers that switch for certificate authorities. Hence a small local
CA that signs the server certificate.

It is generated on your machine, the private key never leaves it, and it is
only valid for that machine's names. Deleting `app/bridge/.cert/` undoes the
whole thing.
</details>

Then open `https://your-mac.local:8443` on the phone and tap **Start**. Say
yes to the motion prompt. You should see a Wii Remote's worth of buttons and,
at the top, `Bridged` with a live Hz reading.

## 2. Point Dolphin at it

**Config → Controllers → Alternate Input Sources** → tick **Enable**, with
server `127.0.0.1` and port `26760`.

## 3. Bind it

**Wii Remote 1 → Emulated Wii Remote → Configure.**

Do not try to match names by eye. In every field below, **click the field,
then move or press the thing on the phone** — Dolphin fills in whatever it
detected. That is faster and cannot be got wrong.

**Motion Input tab** — the important one.

- Under **IMU Accelerometer**, click each field and tilt the phone that way.
- Under **IMU Gyroscope**, same: click and rotate.
- Under **Point**, bind **Recenter** to the phone's RECENTER button. This is
  what gives you a pointer without a sensor bar — Dolphin works out where
  you're aiming from the gyro, and Recenter tells it where the screen is.

**General and Options tab** — the buttons. Click a field, press the button on
the phone:

| Phone | Bind to |
|---|---|
| A | Wii Remote **A** |
| B | Wii Remote **B** |
| 1 / 2 | Wii Remote **1** / **2** |
| + / − | **+** / **−** |
| HOME | **HOME** |
| D-pad | D-pad |

(Under the hood these travel as a DualShock's buttons, because that is what
the protocol carries — so Dolphin may name them `Cross`, `Circle`, `Square`,
`Triangle`, `Options`, `Share`. That is expected. Bind by pressing, not by
name.)

## 4. Play

Hold the phone **flat, screen up, top edge pointing at the screen** — the way
you'd hold a remote. That posture is why no axis juggling is needed: a phone
held like that has the same axes as a Wii Remote held like that.

---

## Opening Dolphin from the arcade page

While the bridge is running, the arcade's **Launch Dolphin** button can
actually open Dolphin on your Mac. A web page can't start a Mac application —
that's the whole reason that button used to only give directions — but the
bridge is a local program, so the page asks it and it does the opening.

For your desktop browser to talk to the bridge, macOS has to trust the same
certificate:

```sh
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain app/bridge/.cert/ca-cert.pem
```

Undo it any time in Keychain Access by deleting **Wii Bridge Local CA**.

---

## Wii Sports, honestly

| Sport | How it goes |
|---|---|
| Tennis | Good. A swing is a swing. |
| Bowling | Good. Hold B, swing, release. |
| Baseball | Good for batting, fine for pitching. |
| Golf | Playable. Backswing power is fiddlier than the real thing. |
| Boxing | Poor. It wants a Nunchuk too — that's a second motion device this doesn't provide. |

Latency is your Wi-Fi's, typically 10–30 ms on the same network. Fine for
tennis, noticeable in boxing. Keep both devices on the same band; a phone on
2.4 GHz talking to a Mac on 5 GHz goes through the router the long way.

---

## When it doesn't work

**Controller page says "Not a secure page."** The certificate isn't trusted.
Redo step 3 of the setup — installing a profile is not the same as trusting
it.

**Page loads, status stays "Reconnecting…".** Same cause, nearly always: the
trust switch. Also check the phone is on the same Wi-Fi, not cellular.

**Dolphin shows no DSU device.** The bridge must be running before Dolphin
looks. Restart Dolphin, or untick and retick Enable.

**Motion is mirrored or drifts the wrong way.** Open **axes &
troubleshooting** on the phone and flip that axis. Flips are saved on the Mac,
so they survive a reload.

**Pointer drifts.** Press RECENTER while aiming at the middle of the screen.
Gyro pointing has no absolute reference — that's what the button is for.

**"Address already in use" on 26760.** Another DSU server is running. Stop it,
or use `--dsu-port` and change the port in Dolphin to match.

**Nothing at all, and the phone can't even load `.local`.** Use the numeric
address the bridge printed instead; some networks block mDNS between devices.

---

## Tests

```sh
python3 app/bridge/test_bridge.py   # protocol, framing, servers
python3 app/bridge/test_page.py     # the real page in a real browser
```

The first decodes packets with a reader written separately from the writer, so
a misreading of the spec can't cancel itself out. The second drives
`controller.html` in headless Chromium while subscribing to the DSU port
exactly as Dolphin does, so "the button lit up" and "the press reached
Dolphin" are checked as two different things.

## Files

| File | |
|---|---|
| `wiibridge.py` | The servers, the certificate, opening Dolphin |
| `dsu.py` | The DSU wire format |
| `wsframe.py` | Enough WebSocket to carry motion, stdlib only |
| `controller.html` | The page your phone becomes a remote in |
| `.cert/`, `bridge-config.json` | Generated locally, not in git |
