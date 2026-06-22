// Learning task runners. The same vocab deck can be practiced three ways;
// every answer posts to /api/review which updates mastery, XP and the garden.
import { h, clear, api, toast, shuffle } from './util.js';

export async function openTask(root, { studentId, deckId, type, onDone }) {
  const { deck, terms } = await api(`decks/${deckId}?studentId=${studentId}`);
  const queue = shuffle(terms);
  const results = [];
  let i = 0;

  const page = h('div.page');
  root.appendChild(page);

  function header() {
    return h('div.row', { style: { justifyContent: 'space-between', alignItems: 'center' } }, [
      h('div', [
        h('h2', `${typeLabel(type)} · ${deck.name}`),
        h('div.muted', `Word ${Math.min(i + 1, queue.length)} of ${queue.length}`),
      ]),
      h('button.btn.ghost', { onclick: () => onDone(results) }, 'Exit'),
    ]);
  }
  function dots() {
    return h('div.progress-dots', queue.map((_, k) =>
      h(`i${k < i ? '.done' : k === i ? '.cur' : ''}`)));
  }

  async function record(term, correct) {
    results.push({ term: term.term, correct });
    const r = await api('review', { body: { studentId, termId: term.id, correct } });
    handleRewards(r);
  }

  function next() {
    i++;
    if (i >= queue.length) return finish();
    render();
  }

  function render() {
    clear(page);
    page.append(header(), dots());
    const term = queue[i];
    if (type === 'quiz') page.appendChild(quizCard(term, queue, async (ok) => { await record(term, ok); }, next));
    else if (type === 'reading') page.appendChild(readingCard(term, queue, async (ok) => { await record(term, ok); }, next));
    else page.appendChild(flashCard(term, async (ok) => { await record(term, ok); next(); }));
  }

  function finish() {
    clear(page);
    const correct = results.filter((r) => r.correct).length;
    page.append(
      h('div.card.celebrate', { style: { textAlign: 'center', maxWidth: '460px', margin: '2rem auto' } }, [
        h('div', { style: { fontSize: '3rem' } }, correct === results.length ? '🌟' : '🌱'),
        h('h2', 'Practice complete!'),
        h('p', `You got ${correct} of ${results.length} right.`),
        h('p.muted', 'Your plants grew — water them again tomorrow so they keep blooming.'),
        h('button.btn.primary', { onclick: () => onDone(results) }, 'Back to my garden'),
      ])
    );
  }

  render();
}

function typeLabel(t) {
  return t === 'quiz' ? '📝 Quiz' : t === 'reading' ? '📖 Reading' : '🃏 Flashcards';
}

// ---- flashcards ----
function flashCard(term, answer) {
  const card = h('div.flash');
  const inner = h('div.flash-inner', [
    h('div.flash-face', [
      h('div.term', term.term),
      h('p.muted', 'Tap to reveal the meaning'),
    ]),
    h('div.flash-face.back', [
      h('div.def', term.definition),
      term.example ? h('div.ex', `“${term.example}”`) : null,
    ]),
  ]);
  let flipped = false;
  const actions = h('div.task-actions');
  card.append(inner, actions);
  inner.addEventListener('click', () => { if (!flipped) flip(); });
  function flip() {
    flipped = true;
    card.classList.add('flipped');
    clear(actions).append(
      h('span.muted', { style: { alignSelf: 'center' } }, 'Did you remember it?'),
      h('button.btn.bad', { onclick: () => answer(false) }, 'Missed it'),
      h('button.btn.good', { onclick: () => answer(true) }, 'Got it! 🌿'),
    );
  }
  return card;
}

// ---- quiz: given the definition, pick the right word ----
function quizCard(term, pool, record, next) {
  const distractors = shuffle(pool.filter((t) => t.id !== term.id)).slice(0, 3);
  const options = shuffle([term, ...distractors]);
  const wrap = h('div.card', { style: { maxWidth: '500px', margin: '1rem auto' } });
  wrap.append(
    h('p.muted', 'Which word means:'),
    h('h3', { style: { fontSize: '1.3rem' } }, `“${term.definition}”`),
  );
  let answered = false;
  options.forEach((opt) => {
    const b = h('button.quiz-opt', { onclick: async () => {
      if (answered) return; answered = true;
      const ok = opt.id === term.id;
      b.classList.add(ok ? 'correct' : 'wrong');
      if (!ok) wrap.querySelectorAll('.quiz-opt').forEach((x) => {
        if (x.dataset.id === term.id) x.classList.add('correct');
      });
      await record(ok);
      setTimeout(next, 850);
    } }, opt.term);
    b.dataset.id = opt.id;
    wrap.appendChild(b);
  });
  return wrap;
}

// ---- reading: fill the blank in the example sentence ----
function readingCard(term, pool, record, next) {
  const sentence = (term.example || `A good example of ${term.term}.`)
    .replace(new RegExp(term.term, 'i'), '_____');
  const distractors = shuffle(pool.filter((t) => t.id !== term.id)).slice(0, 3);
  const options = shuffle([term, ...distractors]);
  const wrap = h('div.card.reading', { style: { maxWidth: '520px', margin: '1rem auto' } });
  wrap.append(
    h('p.muted', 'Read the sentence and choose the missing word:'),
    h('p', sentence),
  );
  let answered = false;
  options.forEach((opt) => {
    const b = h('button.quiz-opt', { onclick: async () => {
      if (answered) return; answered = true;
      const ok = opt.id === term.id;
      b.classList.add(ok ? 'correct' : 'wrong');
      // reveal full sentence
      wrap.querySelectorAll('p')[1].innerHTML =
        (term.example || '').replace(new RegExp(term.term, 'i'),
          `<span class="gap">${term.term}</span>`);
      await record(ok);
      setTimeout(next, 1000);
    } }, opt.term);
    wrap.appendChild(b);
  });
  return wrap;
}

// Surface XP / unlock rewards from a review response.
function handleRewards(r) {
  if (r.leveledUp) toast(`⭐ Level up! You're now level ${r.level}`);
  if (r.unlocked?.species?.length) {
    const s = r.unlocked.species[0];
    toast(`🔓 New plant unlocked: ${s.emoji} ${s.name}`);
  }
  if (r.unlocked?.decorations?.length) {
    const d = r.unlocked.decorations[0];
    toast(`🎁 New decoration: ${d.emoji} ${d.name}`);
  }
}
