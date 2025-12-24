# Digital Poker Table

![Demo screenshot](img/demo.jpeg)

A browser-based, zero-setup poker table to play Texas Hold'em with friends using only your devices.
Scan a QR code to see your hole cards privately on your phone, while the shared table (e.g., on a
tablet or laptop) handles community cards, blinds, pot, and betting rounds.

---

## 🎯 Key Features

- **No Setup Required**: Just open the table in your browser and start playing. No app install, no
  sign-ups.
- **Device Pairing via QR**: Each player scans a code to privately view their cards on their phone.
- **Phone Controls**: Players can fold, call, check, and raise directly from their phones - no need
  to touch the main screen!
- **Automatic Game Logic**: Handles blinds, bets, pots, side pots, and showdown evaluations.
- **Progressive Blinds**: Blinds automatically double every 2 complete dealer orbits to keep the
  action going.
- **Side Pot Support**: Accurately resolves complex all-in scenarios.
- **Dynamic Positioning**: Turn order and bot strategy adapt as players fold.
- **Supports All Table Sizes**: From heads-up to full-ring games.
- **Responsive Design**: Optimized for tablets, phones, and desktops.
- **Smart Bet Slider**: The bet slider highlights invalid amounts in red while dragging and snaps to
  the minimum legal raise when released.
- **Fast & Offline-Ready**: Loads fast, works without internet once cached.
- **Built‑in Bots**: Empty player slots are automatically filled with bots.
- **Bot Intelligence**: Bots evaluate hand strength, pot odds, stack size, and position to make
  informed decisions.
- **Adaptive Behavior**: Bots track how often opponents fold, detect frequent all-ins, and adjust
  their bluffing frequency accordingly.
- **Context Awareness**: Bots recognize top pair, overpairs, and draw potential to decide between
  check, call, raise, or fold.

---

## 🚀 Getting Started

1. Open this URL on a shared device (e.g., tablet or laptop): 👉
   [https://tehes.github.io/poker](https://tehes.github.io/poker)

2. Add players by typing their names.

3. Start the game — each player scans their QR code to get their cards.

4. The table handles dealing, blinds, betting, and showdown.

---

## 📶 Offline Use

The table works fully offline after the first complete load.

- **First visit online** – When opened once with an internet connection, all necessary assets (HTML,
  JS, CSS, SVGs, icons) are cached in the browser.
- **Service Worker** – Handles cache-first requests and serves offline content when the network is
  unavailable.
- **Core Assets Pre‑cached** – Core assets are precached during install; any additional resources
  are loaded and cached on demand.
- **Updates** – A new version is fetched and activated in the background; refreshing the page loads
  the updated assets.

---

## 🛠️ Tech Stack

- **HTML/CSS/JavaScript** only – no frameworks
- **Vanilla JS Game Engine**
- **kjua** – lightweight QR code generation for offline play
- **pokersolver** (ES module) – for hand evaluation at showdown

---

## 🌐 Backend Sync & Phone Controls

The game uses a backend API for two purposes:
1. **State Sync**: Keep phone views in sync with the main table (chips, pot, notifications)
2. **Phone Controls**: Allow players to fold, call, and raise from their phones

### Setting Up Your Own Backend (Deno Deploy)

The backend code is in `api/main.js`. To host your own:

1. **Create a Deno Deploy account** at [dash.deno.com](https://dash.deno.com) (free)
2. **Create a new project** and connect your GitHub repository
3. **Set the entrypoint** to `api/main.js`
4. **Copy your deployment URL** (e.g., `https://your-project.deno.dev`)
5. **Update the frontend** - change `BACKEND_BASE_URL` in both files:
   - `js/app.js` (line ~40)
   - `js/singleView.js` (line ~20)

```javascript
// Change this line in both files:
const BACKEND_BASE_URL = "https://your-project.deno.dev";
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/state` | GET | Retrieve game state for a table |
| `/state` | POST | Save game state from main table |
| `/action` | GET | Check for pending player action |
| `/action` | POST | Submit player action from phone |
| `/action` | DELETE | Clear processed action |

---

## 🤖 How It Works

- The shared device runs the table (e.g., tablet or TV).
- When a round starts, each player sees a QR code.
- They scan it and view their private hole cards on their own phone.
- When it's a player's turn, action buttons appear on their phone (Fold, Check/Call, Raise).
- Players can act from their phone OR from the main table - whichever is more convenient.
- Game flow logic ensures proper handling of:

  - **Dealer rotation** and automatic blind posting
  - **Progressive blinds** that double every 2 complete orbits (e.g., 10/20 → 20/40 → 40/80)
  - Side pots and all-ins
  - Automatic showdown resolution
  - **Bot Support**: Empty seats without a player name are assigned bots that play automatically
    using simple hand-strength logic.

---

## 🧠 Design Philosophy

- **Local-first**: Works without network once loaded.
- **No back-end**: All state is client-side only.
- **Zero footprint**: No accounts, no cloud sync.
- **Focus on flow**: The app enforces rules and turn order so you can focus on the game.
- **Tournament-style**: Progressive blinds keep games from stalling.

---

## 🐞 Debug Logging

Set `DEBUG_FLOW` to `true` in `js/app.js` to print detailed, timestamped messages about the betting
flow. Enable this flag when investigating hangs or unexpected behavior.

---

## 📋 Known Limitations

- Live syncing is best-effort; if the backend is unreachable, devices fall back to local QR data
  and phone controls won't work (main table controls still function).
- No persistent chip stacks or session saving (yet).
- Not designed for remote multiplayer (players should be in the same room).
- Fixed blind structure (doubles every 2 orbits) — not customizable.

---

## 🙌 Credits

- [pokersolver](https://github.com/goldfire/pokersolver) for hand ranking logic
- [kjua](https://github.com/lrsjng/kjua) for QR code generation
