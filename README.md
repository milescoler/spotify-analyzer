# 🌱 Word Garden

A gamified **vocabulary learning environment** where students grow a living
garden by completing learning tasks. Words bloom into plants with practice and
**wilt and die without it** — turning spaced repetition into something you can
see and care for. Teachers get analytics dashboards of each student's skill
tree across every subject.

> Centered on vocabulary, but the task framework (flashcards, quizzes,
> readings) works for any curriculum a teacher brings.

## What it does

### For students
- **Grow a garden.** Every word you practice is auto-planted as a plant. The
  better you know it, the more it grows (`seed → sprout → seedling → bud →
  bloom → flourishing`). Stop practicing and it gets thirsty, wilts, and
  eventually dies — water it by practicing again.
- **Walkable Roblox-style 3D world.** Your garden is a real 3D scene with a
  blocky avatar character (styled from your avatar choices). Move with the
  on-screen **joystick** (or WASD), and walk up to a plant to inspect it. Plants
  are low-poly 3D models that grow with mastery, sway when healthy, droop when
  thirsty, and topple over grey when they die. Visiting a classmate's garden
  gives you a drag-to-orbit camera.
- **Three ways to learn** the same deck: 🃏 flashcards, 📝 quizzes, and
  📖 fill-the-blank readings. A lightweight spaced-repetition model tracks
  mastery per word.
- **Unlock objects** as you level up: new plant species (sunflowers, roses,
  lotus…) and garden decorations (koi pond, gnome, lantern…) earned through
  milestones and streaks.
- **Customize an avatar** — face, hat, pet, and color, with fancier options
  unlocking as you level up.
- **Visit classmates' gardens**, leave cheers, and **compete** on the garden
  leaderboard (scored on healthy, thriving, diverse plants + decorations).

### For teachers
- **Cross-subject skill-tree dashboard.** A per-student heatmap of mastery
  across every subject and deck (built for elementary teachers who teach
  reading, science, and math vocabulary to the same class).
- **Class rollups**: average mastery per subject, and a **"needs attention"**
  list flagging inactive students or decaying skills (⚠) that haven't been
  practiced.
- Click any student for a detailed per-skill breakdown.

## Run it

No dependencies, no build step — just Node 18+:

```bash
npm start          # serves http://localhost:3000
```

Open the page and pick a student (Maya, Liam, Aisha, Noah, Sofia) or the
teacher (Ms. Rivera) from the sign-in screen. The demo seeds a 3rd-grade class
with varied practice history, so you'll immediately see thriving gardens,
wilting plants, and a populated teacher dashboard.

```bash
npm test           # runs the learning/garden logic assertions
npm run reset      # reset demo data to its starting state
```

### 📱 Run it from only your iPhone (no computer)

`localhost` from your phone's browser points at the phone itself, so it only
works if the server is *also* running on the phone. Three ways to do this with
nothing but an iPhone:

**A. GitHub Codespaces — recommended (runs in Safari, free 60 hrs/mo)**
1. In Safari, open this repo on `github.com` and switch to this branch.
2. Tap the green **Code** button → **Codespaces** → **Create codespace**.
3. Wait for the in-browser editor to load. In the **Terminal** panel, type:
   `npm start`
4. A notification pops up to open the forwarded port — tap it to launch Word
   Garden in a new Safari tab. (Already signed into GitHub, so the private
   forwarded URL just works; set the port to **Public** in the *Ports* tab only
   if you want to share it.)

**B. Replit (polished mobile app or Safari, free)**
1. Get the Replit app or open `replit.com`. Create → **Import from GitHub** and
   paste this repo's URL.
2. Tap **Run**. The `.replit` config starts the server; the webview shows the
   app and gives you a `https://…replit.dev` URL you can open in Safari.

**C. iSH — fully offline, on the phone itself (no account, no internet host)**
1. Install **iSH** from the App Store (a Linux shell that runs on iOS).
2. In iSH, run:
   ```sh
   apk add nodejs git
   git clone <this-repo-url> && cd spotify-analyzer
   git checkout claude/word-garden-rebuild-xum9zg
   npm start
   ```
3. Open **Safari** to `http://localhost:3000`. Because the server is running on
   the phone, `localhost` reaches it. (Switch back to Safari quickly — iOS may
   suspend iSH after a bit in the background.)

> Also works the classic way: run `npm start` on a computer on the same Wi-Fi
> and open the **LAN URL the server prints at startup** (e.g.
> `http://192.168.1.42:3000`) from your phone.

**To share with a class / use off Wi-Fi:** deploy to any Node host — the app
honors `PORT` and binds `0.0.0.0`, so Render, Railway, or Fly.io work with
`npm start` as the start command (demo data resets on redeploy since the store
is a local JSON file).

## How it's built

A deliberately lean stack: the **server and tooling have zero npm
dependencies** (runs with just Node), and the only frontend library is
**Three.js**, loaded in the browser from a CDN via an import map — so there's
still no install or build step. (The 3D garden needs internet to fetch Three.js;
everything else works offline.)

```
server.js          Built-in http server: static files + JSON API
lib/
  model.js         Pure logic: spaced repetition, plant growth/decay,
                   leveling, unlocks, garden scoring, avatars
  api.js           Endpoint logic (transport-agnostic, returns plain JSON)
  db.js            Tiny JSON-file store (data/data.json)
  seed.js          Deterministic demo class + practice history
public/
  index.html, styles.css
  js/
    app.js         Sign-in + routing
    student.js     Garden home, learn, explore, avatar studio
    teacher.js     Analytics dashboard
    tasks.js       Flashcard / quiz / reading runners
    garden.js      Walkable 3D garden world (Three.js via CDN import map)
    shared.js      Leaderboard
    util.js        DOM + API helpers
test/model.test.js
```

### The growth/decay model
Each review updates a word's `mastery` (rises on correct answers, drops on
misses) and stamps `lastPracticed`. A plant's **health** decays exponentially
from its mastery the longer it goes unpracticed — well-learned words decay
slower. Health drives the plant's on-screen condition (thriving → thirsty →
wilting → dead) and the garden's leaderboard score. See `lib/model.js`.
