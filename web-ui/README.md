# Family Council — React + Vite + WebSocket (LAN, no DB)

A clean, bilingual (English/Ελληνικά) family voting app with proposals, live presence, sessions,
unanimous voting, tyrant mode, points, and rankings. Data is kept locally on each device for names,
and shared state (proposals, points) is kept **in-memory** on the server and persisted to simple JSON files
(`server/data/*.json`) — no database.

> Dev URL (Vite): **http://localhost:5173/**
> WebSocket server: **ws://localhost:3001**

## Features (spec highlights)
- Tabs: **Proposals / Προτάσεις**, **Rankings / Βαθμολογίες**, **Active Session / Ενεργή Συνεδρία**
- Local name saved per device (localStorage). "Begin Session / Έναρξη Συνεδρίας" button once logged in.
- Live presence indicator via WebSocket.
- Create proposals with **Title, Description, Vote Deadline, Event Date (optional)**; show author & status.
- Voting session picks the **nearest vote deadline**; 3-minute default timer (admin “alex” can change).
- Actions: **Accept / Αποδοχή**, **Reject / Απόρριψη**. If not unanimous, author can add a **comment** and **edit event date**; timer resets & re-vote.
- **Unanimous pass** → success sound + schedule a reminder 5 minutes before the event date (best-effort web notification while app is open).
- **Unanimous reject** → rejection sound.
- **Tyrant Mode / Τύραννος**: enforce (pass) or veto (reject) instantly.
- Points:
  - If your proposal is accepted: **+10 Democracy**
  - If you accept someone else's proposal and it passes: **+5 Democracy**
  - If you use Tyrant mode to bypass a vote: **+20 Tyrant**
- **Rankings** from worst tyrant to most democratic, 20 points apart, using net score = Democracy − Tyrant.
- Special admin: if username is **alex**, can change **required attendees** (default 3), **countdown**, and **past proposals**.

## Quick start
1. Install **Node.js 18+**.
2. Unzip this folder.
3. In a terminal:
   ```bash
   cd family-council
   npm install
   npm run dev
   ```
   - This starts: WebSocket server on port **3001** and Vite dev server on **5173**.
4. Open **http://localhost:5173/** in your browser (same LAN members can visit `http://<your-ip>:5173/`).

### Build & serve production
```bash
npm run build
npm run preview  # serves built client (Vite preview) + keep ws server with: npm --prefix server run start
```

> **Notifications note:** Browser notifications 5 minutes before event need the tab to be open in most browsers (no background scheduler without a push service). We show an in-app popup and try Notification API if allowed.

---

## Project structure
```
family-council/
  client/           # React + Vite + Tailwind
  server/           # Node + ws + express (JSON persistence)
    data/
      proposals.json
      users.json
```

Enjoy! 🇬🇷🇬🇧
