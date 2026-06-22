// Leaderboard — the garden competition, shared by students (and reused look).
import { h, clear, api, avatarEl } from './util.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export async function renderLeaderboard(content, meId, onVisit) {
  const rows = await api('leaderboard');
  const page = h('div.page', [
    h('h2', '🏆 Garden Leaderboard'),
    h('p.muted', 'Gardens are scored on healthy, thriving plants, variety, and decorations. Keep practicing to climb!'),
  ]);
  const table = h('table.lb-table', [
    h('thead', [h('tr', [
      h('th', '#'), h('th', 'Gardener'), h('th', 'Thriving'), h('th', 'Plants'), h('th', 'Score')])]),
    h('tbody', rows.map((r) => {
      const me = r.student.id === meId;
      return h('tr', { style: me ? { background: '#eef8e8', fontWeight: '700' } : {} }, [
        h('td.place', r.place <= 3 ? h('span.medal', MEDALS[r.place - 1]) : String(r.place)),
        h('td', h('span', { style: { display: 'flex', alignItems: 'center', gap: '.5rem',
          cursor: onVisit ? 'pointer' : 'default' },
          onclick: onVisit ? () => onVisit(r.student.id) : null }, [
          avatarEl(r.student.avatar, '1.5rem'),
          h('span', r.student.name + (me ? ' (you)' : '')),
        ])),
        h('td', `${r.thriving} 🌿`),
        h('td', String(r.plantCount)),
        h('td', h('strong', String(r.score))),
      ]);
    })),
  ]);
  page.appendChild(h('div.card', [table]));
  clear(content).appendChild(page);
}
