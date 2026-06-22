// Word Garden — core learning & garden logic (pure functions, no I/O).
// Mastery uses a lightweight spaced-repetition model; plants grow with
// practice and wilt/die without it.

export const DAY_MS = 24 * 60 * 60 * 1000;

// Growth stages a plant moves through as a term is mastered.
export const STAGES = ['seed', 'sprout', 'seedling', 'bud', 'bloom', 'flourishing'];

// Plant species are cosmetic objects students unlock as they level up.
// `level` is the student level required before the species can be planted.
export const SPECIES = [
  { id: 'daisy',     name: 'Daisy',          emoji: '🌼', level: 1 },
  { id: 'tulip',     name: 'Tulip',          emoji: '🌷', level: 1 },
  { id: 'sunflower', name: 'Sunflower',      emoji: '🌻', level: 2 },
  { id: 'rose',      name: 'Rose',           emoji: '🌹', level: 3 },
  { id: 'hibiscus',  name: 'Hibiscus',       emoji: '🌺', level: 4 },
  { id: 'sapling',   name: 'Maple Sapling',  emoji: '🌳', level: 5 },
  { id: 'cactus',    name: 'Cactus Bloom',   emoji: '🌵', level: 6 },
  { id: 'lotus',     name: 'Lotus',          emoji: '🪷', level: 8 },
];

// Decorations unlocked by milestones (mastered terms / streak).
export const DECORATIONS = [
  { id: 'fence',     name: 'White Fence',    emoji: '🪵', need: { mastered: 3 } },
  { id: 'pond',      name: 'Koi Pond',       emoji: '💧', need: { mastered: 6 } },
  { id: 'butterfly', name: 'Butterflies',    emoji: '🦋', need: { streak: 3 } },
  { id: 'gnome',     name: 'Garden Gnome',   emoji: '🧙', need: { mastered: 10 } },
  { id: 'lantern',   name: 'Stone Lantern',  emoji: '🏮', need: { streak: 7 } },
  { id: 'bench',     name: 'Reading Bench',  emoji: '🪑', need: { mastered: 15 } },
];

// Avatar customization. Each part has options; some options are locked behind
// a student level so there's something to grow toward. The default avatar uses
// the first option of every part.
export const AVATAR_PARTS = {
  face: [
    { id: 'happy',   emoji: '🙂', level: 1 },
    { id: 'grin',    emoji: '😄', level: 1 },
    { id: 'cool',    emoji: '😎', level: 2 },
    { id: 'star',    emoji: '🤩', level: 4 },
    { id: 'robot',   emoji: '🤖', level: 6 },
  ],
  hat: [
    { id: 'none',    emoji: '',   level: 1 },
    { id: 'cap',     emoji: '🧢', level: 1 },
    { id: 'straw',   emoji: '👒', level: 2 },
    { id: 'grad',    emoji: '🎓', level: 3 },
    { id: 'crown',   emoji: '👑', level: 5 },
    { id: 'wizard',  emoji: '🎩', level: 7 },
  ],
  pet: [
    { id: 'none',    emoji: '',   level: 1 },
    { id: 'bee',     emoji: '🐝', level: 1 },
    { id: 'snail',   emoji: '🐌', level: 2 },
    { id: 'bird',    emoji: '🐦', level: 3 },
    { id: 'bunny',   emoji: '🐰', level: 4 },
    { id: 'butterfly', emoji: '🦋', level: 5 },
  ],
  color: [
    { id: 'green',   emoji: '🟢', hex: '#5bb85b', level: 1 },
    { id: 'blue',    emoji: '🔵', hex: '#4a90d9', level: 1 },
    { id: 'purple',  emoji: '🟣', hex: '#9b59b6', level: 1 },
    { id: 'orange',  emoji: '🟠', hex: '#e67e22', level: 2 },
    { id: 'pink',    emoji: '🩷', hex: '#e84393', level: 3 },
    { id: 'gold',    emoji: '🟡', hex: '#f1c40f', level: 5 },
  ],
};

export function defaultAvatar() {
  return { face: 'happy', hat: 'none', pet: 'none', color: 'green' };
}

// Interests power personalized learning scenarios — a student's words are
// drilled inside a story themed to what they love.
export const INTERESTS = [
  { id: 'dinosaurs',    name: 'Dinosaurs',     emoji: '🦕' },
  { id: 'space',        name: 'Space',         emoji: '🚀' },
  { id: 'soccer',       name: 'Soccer',        emoji: '⚽' },
  { id: 'animals',      name: 'Animals',       emoji: '🐾' },
  { id: 'dragons',      name: 'Dragons',       emoji: '🐉' },
  { id: 'ocean',        name: 'Ocean',         emoji: '🌊' },
  { id: 'cars',         name: 'Race Cars',     emoji: '🏎️' },
  { id: 'music',        name: 'Music',         emoji: '🎵' },
  { id: 'art',          name: 'Art',           emoji: '🎨' },
  { id: 'cooking',      name: 'Cooking',       emoji: '🍳' },
  { id: 'superheroes',  name: 'Superheroes',   emoji: '🦸' },
  { id: 'building',     name: 'Building',      emoji: '🧱' },
];
export function interestName(id) {
  const i = INTERESTS.find((x) => x.id === id);
  return i ? i.name : id;
}

// Which avatar options a student has unlocked at their current level.
export function avatarUnlocks(student) {
  const level = levelForXp(student.xp || 0);
  const out = {};
  for (const [part, opts] of Object.entries(AVATAR_PARTS)) {
    out[part] = opts.map((o) => ({ ...o, unlocked: level >= o.level }));
  }
  return out;
}

// The class shares a TOWN that everyone builds together. Each building unlocks
// once the class collectively masters enough words — a cooperative goal on top
// of each student's individual farm/plot.
export const TOWN_BUILDINGS = [
  { id: 'well',     name: 'Village Well',   emoji: '🪣', need: 8 },
  { id: 'market',   name: 'Farmers Market', emoji: '🏪', need: 20 },
  { id: 'mill',     name: 'Windmill',       emoji: '🌾', need: 36 },
  { id: 'library',  name: 'Library',        emoji: '📚', need: 56 },
  { id: 'fountain', name: 'Fountain',       emoji: '⛲', need: 80 },
  { id: 'school',   name: 'Schoolhouse',    emoji: '🏫', need: 110 },
  { id: 'townhall', name: 'Town Hall',      emoji: '🏛️', need: 150 },
];

// XP needed to reach a given level (level 1 starts at 0 XP).
export function levelForXp(xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}
export function xpForLevel(level) {
  // Gentle quadratic curve: 0, 50, 130, 240, 380...
  return Math.round(25 * (level - 1) * (level));
}

// Update a mastery record after answering a flashcard/quiz item.
// `record` = { mastery, reps, ease, lastPracticed }. Returns a new record.
export function applyReview(record, correct, now = Date.now()) {
  const r = record
    ? { ...record }
    : { mastery: 0, reps: 0, ease: 2.0, lastPracticed: 0 };
  if (correct) {
    r.mastery = r.mastery + (1 - r.mastery) * 0.34;
    r.ease = Math.min(3.0, r.ease + 0.06);
    r.reps += 1;
  } else {
    r.mastery = r.mastery * 0.5;
    r.ease = Math.max(1.3, r.ease - 0.2);
    r.reps += 1;
  }
  r.lastPracticed = now;
  return r;
}

// Health decays the longer a term goes un-practiced. A higher ease (the term
// is well-learned) means slower decay. Returns 0..1.
export function plantHealth(record, now = Date.now()) {
  if (!record || !record.lastPracticed) return 0;
  const days = (now - record.lastPracticed) / DAY_MS;
  const halfLife = 3 + record.ease * 3; // 7–12 days roughly
  const decay = Math.pow(0.5, days / halfLife);
  return record.mastery * decay;
}

// Derive everything the UI needs to draw one plant.
export function plantState(record, now = Date.now()) {
  const health = plantHealth(record, now);
  const mastery = record ? record.mastery : 0;
  const stageIndex = Math.min(
    STAGES.length - 1,
    Math.floor(mastery * STAGES.length)
  );
  let condition = 'thriving';
  if (health < 0.08) condition = 'dead';
  else if (health < health0(mastery) * 0.45) condition = 'wilting';
  else if (health < health0(mastery) * 0.75) condition = 'thirsty';
  const days = record && record.lastPracticed
    ? (now - record.lastPracticed) / DAY_MS
    : Infinity;
  return {
    mastery,
    health,
    stage: STAGES[stageIndex],
    stageIndex,
    condition,
    daysSincePractice: Number.isFinite(days) ? Math.round(days * 10) / 10 : null,
  };
}
// Health right after practice (= mastery) used as the reference for thresholds.
function health0(mastery) {
  return Math.max(0.12, mastery);
}

// Garden score used for the leaderboard / competition.
export function gardenScore(plants, decorations) {
  let score = 0;
  for (const p of plants) {
    score += p.state.health * (p.state.stageIndex + 1) * 10;
    if (p.state.condition === 'thriving') score += 5;
  }
  score += (decorations ? decorations.length : 0) * 8;
  // Bonus for diversity of healthy species.
  const species = new Set(
    plants.filter((p) => p.state.health > 0.3).map((p) => p.species)
  );
  score += species.size * 4;
  return Math.round(score);
}

// Which species/decorations are available to a student right now.
export function unlocks(student, stats) {
  const level = levelForXp(student.xp || 0);
  const species = SPECIES.filter((s) => level >= s.level);
  const decorations = DECORATIONS.filter((d) => {
    if (d.need.mastered != null) return stats.mastered >= d.need.mastered;
    if (d.need.streak != null) return (student.streak || 0) >= d.need.streak;
    return false;
  });
  return { level, species, decorations };
}
