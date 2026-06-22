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

### 📱 On your phone

`localhost` won't work from a phone — that points at the phone itself. Instead:

- **Same Wi-Fi:** run `npm start` on a computer and open the **LAN URL the
  server prints on startup** (e.g. `http://192.168.1.42:3000`) in your phone's
  browser. The server binds to all interfaces, so no extra setup is needed —
  just make sure the phone and computer are on the same network (and your
  firewall allows port 3000).
- **Anywhere / to share with a class:** deploy to any Node host. The app honors
  `PORT` and binds `0.0.0.0`, so platforms like Render, Railway, or Fly.io work
  out of the box (`npm start` as the start command). Note: the JSON-file store
  is ephemeral on free tiers, so demo data resets on redeploy.

## How it's built

A deliberately **zero-dependency** stack so it runs anywhere with just Node:

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
    garden.js      Garden rendering
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
