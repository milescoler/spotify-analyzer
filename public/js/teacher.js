// Teacher analytics dashboard: class overview, a cross-subject skill-tree
// heatmap per student, subject averages, and a "needs attention" list.
import { h, clear, api, avatarEl, modal } from './util.js';

export function mountTeacher(root, teacherId, switchUser) {
  const view = h('div.app-shell');
  const content = h('div');

  function topbar(name) {
    return h('div.topbar', [
      h('span.brand', '🌱 Word Garden'),
      h('span', { style: { fontWeight: 700 } }, 'Teacher Dashboard'),
      h('span.spacer'),
      h('span.who', name),
      h('button.linkbtn', { onclick: switchUser }, 'switch'),
    ]);
  }

  function heatColor(v) {
    // red -> amber -> green scale
    const hue = Math.round((v / 100) * 120);
    return `hsl(${hue} 60% 45%)`;
  }

  async function render() {
    const d = await api(`teacher/${teacherId}/dashboard`);
    const page = h('div.page');

    page.append(
      h('h2', `${d.teacher.name} · ${d.classes[0]?.name || 'Class'}`),
      h('p.muted', 'Each student grows a Word Garden as they master vocabulary. This dashboard rolls up their skill trees across every subject.'),
    );

    // Headline tiles.
    page.appendChild(h('div.stat-tiles', [
      tile(d.studentCount, 'Students'),
      tile(d.subjects.length, 'Subjects'),
      tile(d.classAvg + '%', 'Class avg mastery'),
      tile(d.needsAttention.length, 'Need attention'),
    ]));

    // Subject averages bar chart.
    page.appendChild(h('div.card', { style: { marginTop: '1rem' } }, [
      h('h3', 'Mastery by Subject'),
      h('div.subj-bars', d.subjectAverages.map((s) => h('div.bar-row', [
        h('span', { style: { width: '170px' } }, `${s.icon} ${s.subject}`),
        h('div.bar-track', [h('div.bar-fill', { style: { width: s.mastery + '%', background: heatColor(s.mastery) } })]),
        h('strong', { style: { width: '3rem', textAlign: 'right' } }, s.mastery + '%'),
      ]))),
    ]));

    // Needs-attention.
    if (d.needsAttention.length) {
      page.appendChild(h('div.card', { style: { marginTop: '1rem', borderColor: '#e6b34a' } }, [
        h('h3', '⚠️ Needs Attention'),
        h('ul.attention-list', d.needsAttention.map((a) =>
          h('li', `${a.name} — ${a.overall}% mastery${a.daysInactive != null ? `, inactive ${a.daysInactive} day(s)` : ''}`))),
      ]));
    }

    // Cross-subject skill-tree heatmap.
    const heat = h('div.card', { style: { marginTop: '1rem' } }, [
      h('h3', 'Student Skill Trees (across subjects)'),
      h('p.muted', { style: { fontSize: '.8rem' } }, 'Each cell is a deck (skill). Color = mastery. ⚠ = a learned skill is decaying from lack of practice. Click a student for detail.'),
    ]);

    const decksFlat = [];
    d.subjects.forEach((sub) => {
      const sample = d.grid[0]?.bySubject.find((b) => b.subject.id === sub.id);
      (sample?.skills || []).forEach((sk) => decksFlat.push({ subject: sub, skill: sk }));
    });

    const heatWrap = h('div.heat-grid');
    const table = h('table.heat-table');
    const head = h('tr', [h('th.sticky', 'Student'), h('th', 'Overall')]);
    d.subjects.forEach((sub) => {
      const cols = d.grid[0]?.bySubject.find((b) => b.subject.id === sub.id)?.skills.length || 1;
      head.appendChild(h('th', { colspan: cols, style: { background: sub.color + '22' } }, `${sub.icon} ${sub.name}`));
    });
    table.appendChild(h('thead', [head,
      h('tr', [h('th.sticky', ''), h('th', ''),
        ...decksFlat.map((df) => h('th', { title: df.skill.name, style: { fontSize: '.7rem' } },
          df.skill.name.split(' ')[0]))])]));

    const tbody = h('tbody');
    d.grid.forEach((g) => {
      const tr = h('tr', { style: { cursor: 'pointer' }, onclick: () => openStudent(g) });
      tr.appendChild(h('td.name', [
        h('span', { style: { display: 'flex', alignItems: 'center', gap: '.4rem' } }, [
          avatarEl(g.student.avatar, '1.4rem'), g.student.name]),
      ]));
      tr.appendChild(h('td', { style: { background: heatColor(g.overall), color: '#fff', fontWeight: 700 } }, g.overall + ''));
      g.bySubject.forEach((b) => b.skills.forEach((sk) => {
        tr.appendChild(h('td', {
          style: { background: heatColor(sk.mastery), color: '#fff' },
          title: `${sk.name}: ${sk.mastery}% (${sk.mastered}/${sk.total} mastered)`,
        }, sk.stale ? '⚠' : sk.mastery));
      }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    heatWrap.appendChild(table);
    heat.appendChild(heatWrap);
    page.appendChild(heat);

    clear(content).appendChild(page);
  }

  function openStudent(g) {
    const body = h('div', [
      h('div.row', { style: { alignItems: 'center' } }, [
        avatarEl(g.student.avatar, '2.4rem'),
        h('div', [h('strong', g.student.name),
          h('div.muted', `Level ${g.student.level} · ${g.student.xp} XP · ${g.student.streak}🔥 streak`)]),
      ]),
      h('div.stat-tiles', { style: { marginTop: '1rem' } }, [
        tile(g.overall + '%', 'Overall'),
        tile(g.stats.mastered, 'Mastered'),
        tile(g.stats.learning, 'Learning'),
        tile(g.daysInactive ?? 0, 'Days inactive'),
      ]),
      ...g.bySubject.map((b) => h('div', { style: { marginTop: '1rem' } }, [
        h('strong', `${b.subject.icon} ${b.subject.name} — ${b.mastery}%`),
        ...b.skills.map((sk) => h('div.bar-row', { style: { display: 'flex', gap: '.5rem', alignItems: 'center', margin: '.25rem 0' } }, [
          h('span', { style: { width: '160px', fontSize: '.85rem' } }, sk.name + (sk.stale ? ' ⚠' : '')),
          h('div.bar-track', { style: { flex: 1, height: '12px', borderRadius: '6px', background: '#eaf4df', overflow: 'hidden' } },
            [h('div', { style: { width: sk.mastery + '%', height: '100%', background: heatColor(sk.mastery) } })]),
          h('span', { style: { width: '4rem', textAlign: 'right', fontSize: '.8rem' } }, `${sk.mastered}/${sk.total}`),
        ])),
      ])),
    ]);
    modal('Student Detail', body);
  }

  function tile(big, lbl) {
    return h('div.tile', [h('div.big', String(big)), h('div.lbl', lbl)]);
  }

  (async () => {
    const d = await api(`teacher/${teacherId}/dashboard`);
    view.append(topbar(d.teacher.name), content);
    clear(root).appendChild(view);
    render();
  })();
}
