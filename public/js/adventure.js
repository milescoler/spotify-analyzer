// Adventure — the interest-personalized learning activity. The tool picks a word
// the student needs to practice, drops them into a short scenario themed to one
// of their interests (set in the class town), and drills it as a choice. Every
// answer feeds the student's farm (plant growth) and the shared town.
import { h, clear, api, toast } from './util.js';

const ROUNDS = 5;

export async function openAdventure(root, { studentId, onDone }) {
  const page = h('div.page');
  root.appendChild(page);
  const results = [];
  let round = 0;

  async function nextScenario() {
    clear(page);
    page.appendChild(h('div.empty-note', '✨ Conjuring your adventure…'));
    let data;
    try {
      data = await api('scenario', { body: { studentId } });
    } catch (err) {
      clear(page);
      page.append(
        h('div.empty-note', [
          h('p', '🌱 No words to practice yet.'),
          h('p.muted', err.message),
          h('button.btn.primary', { onclick: () => onDone(results) }, 'Back'),
        ]),
      );
      return;
    }
    render(data);
  }

  function header(data) {
    return h('div.row', { style: { justifyContent: 'space-between', alignItems: 'center' } }, [
      h('div', [
        h('div.adv-town', `🏰 ${data.town}`),
        h('div.muted', { style: { fontSize: '.8rem' } },
          `Themed to ${data.interestName} · word ${round + 1} of ${ROUNDS}`),
      ]),
      h('button.btn.ghost', { onclick: () => onDone(results) }, 'Exit'),
    ]);
  }

  function render(data) {
    clear(page);
    const sc = data.scenario;
    const card = h('div.card.adv-card');
    let answered = false;

    const optionsBox = h('div');
    sc.choices.forEach((choice, i) => {
      const btn = h('button.quiz-opt', { onclick: async () => {
        if (answered) return; answered = true;
        const correct = i === sc.answerIndex;
        btn.classList.add(correct ? 'correct' : 'wrong');
        if (!correct) {
          [...optionsBox.children][sc.answerIndex]?.classList.add('correct');
        }
        const r = await api('review', { body: { studentId, termId: data.term.id, correct } });
        rewards(r);
        results.push({ term: data.term.term, correct });
        // Show the explanation + advance control.
        card.appendChild(h('div.adv-explain', [
          h('strong', correct ? '🌟 Yes! ' : '🌱 Good try — '),
          sc.explanation || `“${data.term.term}” means ${data.term.definition}.`,
        ]));
        card.appendChild(h('div.task-actions', [
          h('button.btn.primary', { onclick: () => {
            round += 1;
            if (round >= ROUNDS) return finish();
            nextScenario();
          } }, round + 1 >= ROUNDS ? 'Finish' : 'Next word →'),
        ]));
      } }, choice);
      optionsBox.appendChild(btn);
    });

    card.append(
      h('p.adv-setup', sc.setup),
      h('h3', sc.question),
      optionsBox,
    );
    page.append(header(data), card);
  }

  function finish() {
    clear(page);
    const correct = results.filter((r) => r.correct).length;
    page.appendChild(h('div.card.celebrate', { style: { textAlign: 'center', maxWidth: '460px', margin: '2rem auto' } }, [
      h('div', { style: { fontSize: '3rem' } }, correct >= ROUNDS - 1 ? '🏆' : '🌻'),
      h('h2', 'Adventure complete!'),
      h('p', `You practiced ${results.length} words and got ${correct} right.`),
      h('p.muted', 'Your farm grew — and your work helped build the town! 🏰'),
      h('button.btn.primary', { onclick: () => onDone(results) }, 'Back to my farm'),
    ]));
  }

  function rewards(r) {
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

  nextScenario();
}
