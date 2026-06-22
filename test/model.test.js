// Minimal assertions for the learning/garden math. Run with: npm test
import assert from 'assert';
import {
  applyReview, plantHealth, plantState, gardenScore, levelForXp, xpForLevel, DAY_MS,
} from '../lib/model.js';

let pass = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); pass++; };

// Mastery rises with correct answers and falls with wrong ones.
let rec = null;
for (let i = 0; i < 5; i++) rec = applyReview(rec, true);
ok(rec.mastery > 0.7, 'five correct answers reach mastery');
const dropped = applyReview(rec, false);
ok(dropped.mastery < rec.mastery, 'a miss lowers mastery');

// Health decays over time without practice.
const now = Date.now();
const fresh = applyReview(null, true, now);
const old = { ...fresh, lastPracticed: now - 30 * DAY_MS };
ok(plantHealth(old, now) < plantHealth(fresh, now), 'health decays over time');

// A long-neglected, well-learned plant eventually reads as dead.
let strong = null;
for (let i = 0; i < 6; i++) strong = applyReview(strong, true, now - 60 * DAY_MS);
ok(plantState(strong, now).condition === 'dead', 'neglected plant dies');

// Leveling curve is monotonic.
ok(levelForXp(0) === 1, 'start at level 1');
ok(levelForXp(xpForLevel(3)) === 3, 'xpForLevel inverts levelForXp');
ok(xpForLevel(4) > xpForLevel(3), 'xp thresholds increase');

// Garden score rewards healthy plants.
const plants = [{ species: 'rose', state: plantState(fresh, now) }];
ok(gardenScore(plants, []) > 0, 'thriving plant scores points');
ok(gardenScore(plants, ['fence']) > gardenScore(plants, []), 'decorations add score');

console.log(`✅ all ${pass} assertions passed`);
