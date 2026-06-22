// Word Garden API logic. Each exported function takes plain args and returns a
// plain JSON-serializable object. The HTTP layer (server.js) just routes to
// these, so the logic stays testable and transport-agnostic.
import * as db from './db.js';
import {
  applyReview, plantState, plantHealth, gardenScore, unlocks, levelForXp, xpForLevel,
  avatarUnlocks, defaultAvatar, SPECIES, DECORATIONS, AVATAR_PARTS, DAY_MS, STAGES,
  INTERESTS, interestName, TOWN_BUILDINGS,
} from './model.js';
import { defineWord, generateScenario, aiEnabled } from './ai.js';

const speciesById = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

// Unique-ish ids for content created at runtime (teacher authoring).
let _seq = 0;
const uid = (p) => `${p}_${Date.now().toString(36)}${(_seq++).toString(36)}`;

const SUBJECT_STYLES = [
  { icon: '📚', color: '#6c8' }, { icon: '🔬', color: '#69c' }, { icon: '🔢', color: '#c79' },
  { icon: '🌍', color: '#7b9' }, { icon: '🎨', color: '#c97' }, { icon: '🎵', color: '#9a7' },
];

// ---- helpers ---------------------------------------------------------------

function studentStats(studentId, now = Date.now()) {
  const data = db.get();
  let mastered = 0;
  let learning = 0;
  let total = 0;
  for (const key of Object.keys(data.mastery)) {
    if (!key.startsWith(studentId + ':')) continue;
    total++;
    const m = data.mastery[key].mastery;
    if (m >= 0.7) mastered++;
    else if (m > 0.05) learning++;
  }
  return { mastered, learning, total };
}

function computeGarden(studentId, now = Date.now()) {
  const data = db.get();
  const garden = data.gardens[studentId] || { plants: [], decorations: [] };
  const plants = garden.plants.map((p) => {
    const t = db.term(p.termId);
    const rec = data.mastery[db.masteryKey(studentId, p.termId)];
    return {
      ...p,
      term: t ? t.term : '???',
      definition: t ? t.definition : '',
      emoji: (speciesById[p.species] || {}).emoji || '🌱',
      speciesName: (speciesById[p.species] || {}).name || p.species,
      state: plantState(rec, now),
    };
  });
  const decos = (garden.decorations || []).map((id) => {
    const d = DECORATIONS.find((x) => x.id === id);
    return d ? { id, name: d.name, emoji: d.emoji } : null;
  }).filter(Boolean);
  return { plants, decorations: decos, score: gardenScore(plants, decos) };
}

function publicStudent(s, now = Date.now()) {
  const level = levelForXp(s.xp || 0);
  return {
    id: s.id, name: s.name, role: s.role, classId: s.classId,
    xp: s.xp || 0, level,
    xpThisLevel: (s.xp || 0) - xpForLevel(level),
    xpForNext: xpForLevel(level + 1) - xpForLevel(level),
    streak: s.streak || 0,
    avatar: s.avatar || defaultAvatar(),
    interests: s.interests || [],
    lastActive: s.lastActive || null,
  };
}

// ---- public endpoints ------------------------------------------------------

// Login picker: who can sign in.
export function bootstrap() {
  const data = db.get();
  return {
    students: data.users.filter((u) => u.role === 'student').map((s) => publicStudent(s)),
    teachers: data.users.filter((u) => u.role === 'teacher')
      .map((t) => ({ id: t.id, name: t.name, role: t.role })),
    catalog: { species: SPECIES, decorations: DECORATIONS, avatarParts: AVATAR_PARTS, stages: STAGES, interests: INTERESTS },
  };
}

// Everything a student needs for their home view.
export function studentHome(studentId, now = Date.now()) {
  const data = db.get();
  const s = db.user(studentId);
  if (!s || s.role !== 'student') throw httpErr(404, 'student not found');
  const stats = studentStats(studentId, now);
  const u = unlocks(s, stats);
  const garden = computeGarden(studentId, now);

  // Subjects -> decks with this student's progress.
  const subjects = data.subjects
    .filter((sub) => sub.classId === s.classId)
    .map((sub) => {
      const decks = data.decks.filter((d) => d.subjectId === sub.id).map((d) => {
        const terms = d.terms.map((t) => data.mastery[db.masteryKey(studentId, t.id)]);
        const avg = terms.length
          ? terms.reduce((a, r) => a + (r ? r.mastery : 0), 0) / terms.length
          : 0;
        const masteredHere = terms.filter((r) => r && r.mastery >= 0.7).length;
        return {
          id: d.id, name: d.name, primaryType: d.primaryType, tasks: d.tasks,
          termCount: d.terms.length, mastered: masteredHere,
          progress: Math.round(avg * 100),
        };
      });
      const avg = decks.length ? decks.reduce((a, d) => a + d.progress, 0) / decks.length : 0;
      return { ...sub, decks, progress: Math.round(avg) };
    });

  return {
    student: publicStudent(s, now),
    stats,
    unlocks: u,
    avatarUnlocks: avatarUnlocks(s),
    garden,
    subjects,
    rank: leaderboardRank(studentId, now),
  };
}

// A deck's terms with the student's mastery + plant state, plus task type.
export function deckView(studentId, deckId, now = Date.now()) {
  const data = db.get();
  const d = db.deck(deckId);
  if (!d) throw httpErr(404, 'deck not found');
  const garden = data.gardens[studentId] || { plants: [] };
  const plantedTerms = new Set(garden.plants.map((p) => p.termId));
  const terms = d.terms.map((t) => {
    const rec = data.mastery[db.masteryKey(studentId, t.id)];
    return {
      id: t.id, term: t.term, definition: t.definition, example: t.example,
      mastery: rec ? rec.mastery : 0,
      state: plantState(rec, now),
      planted: plantedTerms.has(t.id),
    };
  });
  return { deck: { id: d.id, name: d.name, tasks: d.tasks, primaryType: d.primaryType }, terms };
}

// Apply a flashcard/quiz review. Updates mastery, XP, streak, auto-plants new
// terms, and reports any newly unlocked species/decorations.
export function review({ studentId, termId, correct }, now = Date.now()) {
  const data = db.get();
  const s = db.user(studentId);
  if (!s || s.role !== 'student') throw httpErr(404, 'student not found');
  const t = db.term(termId);
  if (!t) throw httpErr(404, 'term not found');

  const beforeStats = studentStats(studentId, now);
  const beforeLevel = levelForXp(s.xp || 0);
  const beforeUnlocks = unlocks(s, beforeStats);

  const key = db.masteryKey(studentId, termId);
  const rec = applyReview(data.mastery[key], correct, now);
  data.mastery[key] = rec;

  if (correct) s.xp = (s.xp || 0) + 10;

  // Daily streak: if last active was yesterday or today keep/extend it.
  const lastDay = Math.floor((s.lastActive || 0) / DAY_MS);
  const today = Math.floor(now / DAY_MS);
  if (lastDay === today) { /* same day, streak unchanged */ }
  else if (lastDay === today - 1) s.streak = (s.streak || 0) + 1;
  else s.streak = 1;
  s.lastActive = now;

  // Auto-plant the term the first time it's practiced.
  const garden = data.gardens[studentId] || (data.gardens[studentId] = { plants: [], decorations: [] });
  let planted = null;
  if (!garden.plants.some((p) => p.termId === termId)) {
    const level = levelForXp(s.xp || 0);
    const available = SPECIES.filter((sp) => level >= sp.level);
    const sp = available[garden.plants.length % available.length] || SPECIES[0];
    planted = {
      id: 'plant_' + termId, termId, species: sp.id,
      plot: garden.plants.length,
    };
    garden.plants.push(planted);
  }

  // Auto-grant any milestone decorations now earned.
  const afterStats = studentStats(studentId, now);
  const afterUnlocks = unlocks(s, afterStats);
  for (const deco of afterUnlocks.decorations) {
    if (!garden.decorations.includes(deco.id)) garden.decorations.push(deco.id);
  }

  db.save();

  const newSpecies = afterUnlocks.species.filter(
    (sp) => !beforeUnlocks.species.some((b) => b.id === sp.id)
  );
  const newDecos = afterUnlocks.decorations.filter(
    (dc) => !beforeUnlocks.decorations.some((b) => b.id === dc.id)
  );

  return {
    state: plantState(rec, now),
    xp: s.xp, level: levelForXp(s.xp),
    leveledUp: levelForXp(s.xp) > beforeLevel,
    streak: s.streak,
    autoPlanted: planted ? { ...planted, term: t.term } : null,
    unlocked: { species: newSpecies, decorations: newDecos },
  };
}

// Re-style a plant (change its species) or move it to another plot.
export function updatePlant({ studentId, plantId, species, plot }) {
  const data = db.get();
  const garden = data.gardens[studentId];
  if (!garden) throw httpErr(404, 'garden not found');
  const plant = garden.plants.find((p) => p.id === plantId);
  if (!plant) throw httpErr(404, 'plant not found');
  if (species && speciesById[species]) plant.species = species;
  if (Number.isInteger(plot)) plant.plot = plot;
  db.save();
  return computeGarden(studentId);
}

export function updateAvatar({ studentId, avatar }) {
  const s = db.user(studentId);
  if (!s || s.role !== 'student') throw httpErr(404, 'student not found');
  const unlocked = avatarUnlocks(s);
  const next = { ...defaultAvatar(), ...(s.avatar || {}) };
  // Only accept parts the student has unlocked.
  for (const part of Object.keys(AVATAR_PARTS)) {
    const choice = avatar[part];
    if (choice == null) continue;
    const opt = (unlocked[part] || []).find((o) => o.id === choice);
    if (opt && opt.unlocked) next[part] = choice;
  }
  s.avatar = next;
  db.save();
  return { avatar: next };
}

// All gardens, for visiting other students.
export function gardensList(now = Date.now()) {
  const data = db.get();
  return data.users.filter((u) => u.role === 'student').map((s) => {
    const g = computeGarden(s.id, now);
    return {
      student: publicStudent(s, now),
      score: g.score,
      plantCount: g.plants.length,
      thriving: g.plants.filter((p) => p.state.condition === 'thriving').length,
      preview: g.plants.slice(0, 6).map((p) => ({ emoji: p.emoji, condition: p.state.condition })),
    };
  });
}

// Visiting a specific garden (full view).
export function gardenView(studentId, now = Date.now()) {
  const s = db.user(studentId);
  if (!s || s.role !== 'student') throw httpErr(404, 'student not found');
  const data = db.get();
  return {
    owner: publicStudent(s, now),
    garden: computeGarden(studentId, now),
    cheers: data.cheers.filter((c) => c.to === studentId).length,
  };
}

export function cheer({ fromId, toId }) {
  const data = db.get();
  data.cheers.push({ from: fromId, to: toId, at: Date.now() });
  db.save();
  return { cheers: data.cheers.filter((c) => c.to === toId).length };
}

// ---- student adventures (interest-personalized scenarios in the town) -------

export function updateInterests({ studentId, interests }) {
  const s = db.user(studentId);
  if (!s || s.role !== 'student') throw httpErr(404, 'student not found');
  const valid = new Set(INTERESTS.map((i) => i.id));
  s.interests = (interests || []).filter((id) => valid.has(id)).slice(0, 4);
  db.save();
  return { interests: s.interests };
}

function classOf(student) {
  return db.get().classes.find((c) => c.id === student.classId) || {};
}

// All terms available to a student (their class's decks), with deck attached.
function studentTerms(student) {
  const data = db.get();
  const subjectIds = new Set(data.subjects.filter((s) => s.classId === student.classId).map((s) => s.id));
  const out = [];
  for (const d of data.decks) {
    if (!subjectIds.has(d.subjectId)) continue;
    for (const t of d.terms) out.push({ ...t, deck: d });
  }
  return out;
}

// Pick the best word to drill: a learned-but-decaying one first (spaced
// repetition), otherwise something not yet mastered, otherwise anything.
function pickAdventureTerm(student, now = Date.now()) {
  const data = db.get();
  const terms = studentTerms(student);
  if (!terms.length) return null;
  const scored = terms.map((t) => {
    const rec = data.mastery[db.masteryKey(student.id, t.id)];
    const mastery = rec ? rec.mastery : 0;
    const health = rec ? plantHealth(rec, now) : 0;
    return { t, rec, mastery, health };
  });
  const due = scored.filter((x) => x.rec && x.mastery > 0.2 && x.health < 0.6)
    .sort((a, b) => a.health - b.health);
  if (due.length) return due[0].t;
  const fresh = scored.filter((x) => x.mastery < 0.7).sort((a, b) => a.mastery - b.mastery);
  if (fresh.length) return fresh[0].t;
  return scored[Math.floor(Math.random() * scored.length)].t;
}

// Generate one personalized scenario set in the class town.
export async function scenario({ studentId, termId }, now = Date.now()) {
  const s = db.user(studentId);
  if (!s || s.role !== 'student') throw httpErr(404, 'student not found');
  const klass = classOf(s);
  const term = termId ? db.term(termId) : pickAdventureTerm(s, now);
  if (!term) throw httpErr(404, 'no words available — ask your teacher to add some');

  const interests = s.interests && s.interests.length ? s.interests : ['animals'];
  const interest = interests[Math.floor(Math.random() * interests.length)];
  const siblings = (term.deck ? term.deck.terms : [])
    .filter((x) => x.id !== term.id).map((x) => x.definition);

  const sc = await generateScenario({
    word: term.term, definition: term.definition, example: term.example,
    interest, grade: klass.gradeLevel || 3, siblings,
  });
  return {
    term: { id: term.id, term: term.term, definition: term.definition },
    scenario: sc,
    interest, interestName: interestName(interest),
    town: klass.townName || 'our town',
    aiEnabled: aiEnabled(),
  };
}

// ---- the shared class town (collective build) ------------------------------

export function townState(classId, now = Date.now()) {
  const data = db.get();
  const klass = classId
    ? data.classes.find((c) => c.id === classId)
    : data.classes[0];
  if (!klass) throw httpErr(404, 'class not found');
  const students = data.users.filter((u) => u.role === 'student' && u.classId === klass.id);

  const contributions = students.map((s) => {
    const mastered = Object.keys(data.mastery)
      .filter((k) => k.startsWith(s.id + ':') && data.mastery[k].mastery >= 0.7).length;
    return { student: publicStudent(s, now), mastered };
  }).sort((a, b) => b.mastered - a.mastered);

  const totalMastered = contributions.reduce((a, c) => a + c.mastered, 0);
  const buildings = TOWN_BUILDINGS.map((b) => ({ ...b, built: totalMastered >= b.need }));
  const next = buildings.find((b) => !b.built) || null;
  const builtCount = buildings.filter((b) => b.built).length;

  return {
    name: klass.townName || klass.name,
    className: klass.name,
    level: builtCount + 1,
    totalMastered,
    buildings,
    next: next ? { ...next, remaining: Math.max(0, next.need - totalMastered) } : null,
    contributions,
    studentCount: students.length,
  };
}

// ---- teacher authoring -----------------------------------------------------
// Teachers supply a subject + a vocab list (definitions optional). The AI fills
// in any missing definitions and the examples; without an API key, samples are
// stored and flagged `aiPending` so they can be auto-filled once a key is added.

function teacherClass(teacherId) {
  const data = db.get();
  const t = db.user(teacherId);
  if (!t || t.role !== 'teacher') throw httpErr(404, 'teacher not found');
  const klass = data.classes.find((c) => c.teacherId === teacherId);
  if (!klass) throw httpErr(404, 'class not found');
  return klass;
}

export function createSubject({ teacherId, name }) {
  const data = db.get();
  const klass = teacherClass(teacherId);
  if (!name || !name.trim()) throw httpErr(400, 'subject name required');
  const style = SUBJECT_STYLES[data.subjects.length % SUBJECT_STYLES.length];
  const subject = { id: uid('subj'), classId: klass.id, name: name.trim(), ...style };
  data.subjects.push(subject);
  db.save();
  return subject;
}

// Create a deck of words under a subject (new or existing). `words` is an array
// of { term, definition? } (definition optional per word).
export async function createDeck({ teacherId, subjectId, subjectName, name, words }) {
  const data = db.get();
  const klass = teacherClass(teacherId);
  const grade = klass.gradeLevel || 3;

  let subject = subjectId ? data.subjects.find((s) => s.id === subjectId) : null;
  if (!subject) subject = createSubject({ teacherId, name: subjectName || name || 'New Subject' });

  const list = (words || [])
    .map((w) => (typeof w === 'string' ? { term: w } : w))
    .filter((w) => w && w.term && w.term.trim());
  if (!list.length) throw httpErr(400, 'no words provided');

  const terms = await Promise.all(list.map(async (w) => {
    const filled = await defineWord({
      word: w.term.trim(), subject: subject.name, grade, definition: w.definition,
    });
    return {
      id: uid('term'), term: w.term.trim(),
      definition: filled.definition, example: filled.example,
      aiGenerated: filled.aiGenerated, aiPending: filled.aiPending,
    };
  }));

  const deck = {
    id: uid('deck'), subjectId: subject.id,
    name: (name && name.trim()) || `${subject.name} Words`,
    primaryType: 'flashcards', tasks: ['flashcards', 'quiz', 'reading'], terms,
  };
  data.decks.push(deck);
  db.save();
  return {
    deck: { id: deck.id, name: deck.name, termCount: terms.length },
    subject: { id: subject.id, name: subject.name, icon: subject.icon },
    aiEnabled: aiEnabled(),
    pendingDefinitions: terms.filter((t) => t.aiPending).length,
  };
}

// Leaderboard sorted by garden score (the competition).
export function leaderboard(now = Date.now()) {
  const data = db.get();
  const rows = data.users.filter((u) => u.role === 'student').map((s) => {
    const g = computeGarden(s.id, now);
    return {
      student: publicStudent(s, now),
      score: g.score,
      thriving: g.plants.filter((p) => p.state.condition === 'thriving').length,
      plantCount: g.plants.length,
    };
  });
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => (r.place = i + 1));
  return rows;
}

function leaderboardRank(studentId, now) {
  const rows = leaderboard(now);
  const me = rows.find((r) => r.student.id === studentId);
  return me ? { place: me.place, of: rows.length, score: me.score } : null;
}

// ---- teacher analytics -----------------------------------------------------

// Skill-tree + mastery analytics across all subjects for a teacher's class.
export function teacherDashboard(teacherId, now = Date.now()) {
  const data = db.get();
  const t = db.user(teacherId);
  if (!t || t.role !== 'teacher') throw httpErr(404, 'teacher not found');
  const classes = data.classes.filter((c) => c.teacherId === teacherId);
  const classIds = new Set(classes.map((c) => c.id));
  const students = data.users.filter((u) => u.role === 'student' && classIds.has(u.classId));
  const subjects = data.subjects.filter((s) => classIds.has(s.classId));

  // Per-student, per-subject mastery (the cross-subject skill tree grid).
  const grid = students.map((s) => {
    const bySubject = subjects.map((sub) => {
      const decks = data.decks.filter((d) => d.subjectId === sub.id);
      const skills = decks.map((d) => {
        const recs = d.terms.map((tm) => data.mastery[db.masteryKey(s.id, tm.id)]);
        const avg = recs.length
          ? recs.reduce((a, r) => a + (r ? r.mastery : 0), 0) / recs.length : 0;
        return {
          deckId: d.id, name: d.name,
          mastery: Math.round(avg * 100),
          mastered: recs.filter((r) => r && r.mastery >= 0.7).length,
          total: d.terms.length,
          // recency flags a student who's let a skill decay.
          stale: recs.some((r) => r && r.mastery > 0.3 &&
            (now - r.lastPracticed) / DAY_MS > 7),
        };
      });
      const avg = skills.length ? skills.reduce((a, k) => a + k.mastery, 0) / skills.length : 0;
      return { subject: { id: sub.id, name: sub.name, icon: sub.icon, color: sub.color },
        mastery: Math.round(avg), skills };
    });
    const overall = bySubject.length
      ? Math.round(bySubject.reduce((a, b) => a + b.mastery, 0) / bySubject.length) : 0;
    return {
      student: publicStudent(s, now),
      overall,
      bySubject,
      stats: studentStats(s.id, now),
      lastActive: s.lastActive,
      daysInactive: s.lastActive ? Math.round((now - s.lastActive) / DAY_MS) : null,
    };
  });

  // Class-wide rollups for headline analytics.
  const classAvg = grid.length
    ? Math.round(grid.reduce((a, g) => a + g.overall, 0) / grid.length) : 0;
  const subjectAverages = subjects.map((sub) => {
    const vals = grid.map((g) => g.bySubject.find((b) => b.subject.id === sub.id).mastery);
    return { subject: sub.name, icon: sub.icon, color: sub.color,
      mastery: Math.round(vals.reduce((a, v) => a + v, 0) / (vals.length || 1)) };
  });
  const needsAttention = grid
    .filter((g) => (g.daysInactive != null && g.daysInactive >= 5) || g.overall < 40)
    .map((g) => ({ name: g.student.name, overall: g.overall, daysInactive: g.daysInactive }));

  return {
    teacher: { id: t.id, name: t.name },
    classes, subjects: subjects.map((s) => ({ id: s.id, name: s.name, icon: s.icon, color: s.color })),
    grid, classAvg, subjectAverages, needsAttention,
    studentCount: students.length,
  };
}

// ---- util ------------------------------------------------------------------

export function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
