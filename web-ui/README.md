# Family Council — React + Vite + WebSocket (LAN, no DB)

Bilingual (English/Ελληνικά) family voting app with proposals, live presence, timed voting sessions, tyrant override, points, and rankings.  
Client state (your name) is stored locally; shared state (proposals, points) is kept **in-memory** on the server and persisted to a JSON file (`server/data/state.json`). No database.

- Client (Vite dev): **http://localhost:5174/**
- WebSocket server: **ws://localhost:3001**

---

## Features

- Tabs: **Active Session / Ενεργή Συνεδρία**, **Proposals / Προτάσεις**, **Rankings / Βαθμολογίες**
- Create proposals with **Title**, **Description**, **Vote Deadline**, optional **Event Date**; see author & status.
- Session auto-picks the **nearest deadline** proposal; default timer **3 minutes** (admin `alex` can change).
- Voting: **Accept / Αποδοχή**, **Reject / Απόρριψη**. If not unanimous, author can add **comment/changes** (visible to all) and optionally adjust date, which **adds a round** & **resets timer**.
- **Unanimous pass** → success sound, optional reminder 5 minutes before event.  
  **Unanimous reject** → rejection sound.
- **Tyrant mode / Τύραννος**: enforce pass or veto instantly.
- **Interlude screen** shows the **last outcome (title + color)** before loading the next proposal. If it was the last proposal, interlude still shows so users can see the result clearly; the **Session Summary** appears after.
- **Points**:
    - Proposal accepted → **Author +10 Democracy**
    - You accepted someone else’s proposal that passed → **+5 Democracy**
    - Tyrant action → **+20 Tyrant**
- **Rankings** by **net score = Democracy − Tyrant**.
- Admin (username **alex**) can change **Required members**, **Countdown**, **Interlude**, **Pre-session** timers.

---

## Project Structure

```
.
├─ client/          # React + Vite + Tailwind (public assets in client/public)
└─ server/          # Node + Express + ws (JSON persistence in server/data)
   └─ data/
      └─ state.json (auto-created)
```

> If your repo has these under a `web-ui/` folder (e.g., `web-ui/client`, `web-ui/server`), put this README in that root and keep the commands the same.

---

## One-time Setup

- Install **Node.js 18+**
- From repo root:
  ```bash
  npm install
  ```

---

## Run Client & Server (from root, no `cd` needed)

### Option A — Recommended (single command using `concurrently`)

1) Install helper once:
```bash
npm i -D concurrently
```

2) Add these scripts to your **root** `package.json`:
```jsonc
{
  "scripts": {
    "dev": "concurrently -n CLIENT,SERVER -c magenta,cyan \"npm:dev:client\" \"npm:dev:server\"",
    "dev:client": "npm run dev --prefix client",
    "dev:server": "npm start --prefix server",

    "build": "npm run build --prefix client",
    "preview": "npm run preview --prefix client",
    "server": "npm start --prefix server"
  }
}
```

3) Start both with one command:
```bash
npm run dev
```
- Client: http://localhost:5173/
- Server: http://localhost:3001/

> On a LAN, others can open `http://<your-local-ip>:5173/` and will connect to the WS server on port 3001 if reachable.

### Option B — Two terminals (no extra dependency)

From repo root:

```bash
# Terminal 1 (client)
npm run dev --prefix client

# Terminal 2 (server)
npm start --prefix server
```

---

## Production Build

```bash
# Build the client
npm run build

# Preview the built client (Vite preview)
npm run preview

# Run the server (separate terminal)
npm run server
```

You can also host `client/dist` on any static host and keep the WebSocket server running via `npm run server`.

---

## Sounds (optional but recommended)

Put audio files in:
```
client/public/sounds/
  pass.wav
  reject.wav
  start.wav
  gavel.wav
```

They’re automatically loaded from `/sounds/<name>.wav`.  
**Note:** Browsers may block autoplay until the first user interaction. Click anywhere once to “unlock” audio.

---

## Confetti (optional)

If you added a utility like `client/src/confetti.ts` that exports `celebratePass()`, the UI will trigger confetti when a proposal passes (during interlude as well).

---

## Troubleshooting

- **Port already in use (EADDRINUSE 3001 or 5173)**  
  Another instance is running. Stop it or kill the process.

  macOS/Linux:
  ```bash
  lsof -i :3001; kill -9 <PID>
  lsof -i :5173; kill -9 <PID>
  ```

  Windows PowerShell:
  ```powershell
  $p = (Get-NetTCPConnection -LocalPort 3001).OwningProcess; Stop-Process -Id $p -Force
  $p = (Get-NetTCPConnection -LocalPort 5173).OwningProcess; Stop-Process -Id $p -Force
  ```

- **Invalid hook call**  
  Hooks (e.g., `useState`, `useEffect`) must be called **only** at the top level of React function components.  
  Don’t call hooks in event handlers, loops, conditions, or non-component modules (like your WS service).

- **No sounds**  
  Check Network tab for `/sounds/*.wav` (should be 200 OK). Click the page once to unlock audio. Verify system volume.

- **Notifications**  
  Allow notifications in the browser. Reminders are best-effort while the tab is open (no background push service is used).

---

Enjoy! 🇬🇷🇬🇧
