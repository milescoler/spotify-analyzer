// Student experience: garden home, learning tasks, avatar studio, exploring
// other gardens, and the leaderboard.
import { h, clear, api, toast, avatarEl, modal, catalog } from './util.js';
import { renderGarden } from './garden.js';
import { openTask } from './tasks.js';
import { openAdventure } from './adventure.js';
import { renderLeaderboard } from './shared.js';

export function mountStudent(root, studentId, switchUser) {
  let home = null;
  const view = h('div.app-shell');
  const content = h('div');
  const nav = h('nav');
  let current = 'garden';

  const tabs = [
    ['garden', '🌻 My Farm'],
    ['learn', '📚 Learn'],
    ['town', '🏰 Town'],
    ['explore', '🧭 Visit Farms'],
    ['leaderboard', '🏆 Leaderboard'],
  ];

  function topbar() {
    const s = home.student;
    return h('div.topbar', [
      h('span.brand', '🌱 Word Garden'),
      nav,
      h('span.spacer'),
      h('span.who', { onclick: openAvatarStudio, style: { cursor: 'pointer' } }, [
        avatarEl(s.avatar, '1.8rem'),
        h('span', `${s.name} · Lv ${s.level}`),
      ]),
      h('button.linkbtn', { onclick: switchUser }, 'switch'),
    ]);
  }

  function renderNav() {
    clear(nav);
    tabs.forEach(([id, label]) => nav.appendChild(
      h(`button${current === id ? '.active' : ''}`, { onclick: () => go(id) }, label)));
  }

  async function refresh() {
    home = await api(`students/${studentId}/home`);
  }

  async function go(tab) {
    current = tab;
    renderNav();
    clear(content);
    if (tab === 'garden') return renderHome();
    if (tab === 'learn') return renderLearn();
    if (tab === 'town') return renderTown();
    if (tab === 'explore') return renderExplore();
    if (tab === 'leaderboard') return renderLeaderboard(content, studentId, visitGarden);
  }

  // ---- garden home ----
  function renderHome() {
    const s = home.student;
    const g = home.garden;
    const page = h('div.page');

    page.append(
      h('div.row', { style: { justifyContent: 'space-between', alignItems: 'flex-end' } }, [
        h('div', [h('h2', `${s.name}'s Garden`),
          h('div.muted', `Garden score ${g.score} · ${home.rank ? `rank #${home.rank.place} of ${home.rank.of}` : ''}`)]),
        h('div', { style: { textAlign: 'right', minWidth: '180px' } }, [
          h('div.muted', `Level ${s.level} · ${s.xp} XP`),
          h('div.xpbar', [h('i', { style: { width:
            Math.round(100 * s.xpThisLevel / Math.max(1, s.xpForNext)) + '%' } })]),
          h('div.muted', { style: { fontSize: '.75rem' } },
            `${s.xpForNext - s.xpThisLevel} XP to level ${s.level + 1}`),
        ]),
      ]),
    );

    const gardenBox = h('div', { style: { margin: '1rem 0' } });
    renderGarden(gardenBox, g, { interactive: true, avatar: s.avatar, onPlotClick: (plant) => {
      if (plant) openPlantCard(plant);
      else { toast('Practice a word in the Learn tab to plant it here 🌱'); go('learn'); }
    } });
    page.appendChild(gardenBox);

    page.appendChild(h('div.stat-tiles', [
      tile(home.stats.mastered, 'Words mastered'),
      tile(home.stats.learning, 'Still growing'),
      tile(s.streak + '🔥', 'Day streak'),
      tile(g.decorations.length, 'Decorations'),
    ]));

    // Nudge about wilting plants.
    const wilting = g.plants.filter((p) => ['wilting', 'dead'].includes(p.state.condition));
    if (wilting.length) {
      page.appendChild(h('div.card', { style: { marginTop: '1rem', borderColor: '#e6b34a' } }, [
        h('strong', `🥀 ${wilting.length} plant${wilting.length > 1 ? 's are' : ' is'} wilting!`),
        h('p.muted', 'Practice these words again to bring them back to life:'),
        h('div.row', wilting.slice(0, 6).map((p) =>
          h('span.pill.warn', p.term))),
      ]));
    }
    clear(content).appendChild(page);
  }

  function tile(big, lbl) {
    return h('div.tile', [h('div.big', String(big)), h('div.lbl', lbl)]);
  }

  function openPlantCard(plant) {
    const st = plant.state;
    const body = h('div', [
      h('div', { style: { textAlign: 'center', fontSize: '3rem' } },
        st.condition === 'dead' ? '🥀' : plant.emoji),
      h('p', [h('strong', plant.term), ' — ', plant.definition]),
      h('div.row', [
        h('span.pill green', `${plant.speciesName}`),
        h(`span.pill.${st.condition === 'thriving' ? 'green' : st.condition === 'dead' ? 'bad' : 'warn'}`,
          st.condition),
        h('span.pill', `${Math.round(st.health * 100)}% health`),
      ]),
      h('p.muted', st.daysSincePractice == null
        ? 'Not practiced yet.'
        : `Last practiced ${st.daysSincePractice} day(s) ago.`),
      h('button.btn.primary', { style: { marginTop: '.5rem' }, onclick: () => {
        m.close(); go('learn');
      } }, st.condition === 'dead' ? 'Revive by practicing 🌧️' : 'Water by practicing 💧'),
    ]);
    const m = modal(`${plant.emoji} ${plant.term}`, body);
  }

  // ---- learn ----
  function renderLearn() {
    const page = h('div.page', [h('h2', 'Learning Tasks')]);

    // Featured: personalized Adventure.
    const s = home.student;
    const interestChips = (s.interests || []).map((id) => {
      const opt = (catalog.interests || []).find((x) => x.id === id);
      return opt ? `${opt.emoji} ${opt.name}` : id;
    });
    page.appendChild(h('div.card.adventure-cta', [
      h('div', { style: { flex: 1 } }, [
        h('h3', { style: { margin: 0 } }, '🗺️ Adventure'),
        h('p.muted', { style: { margin: '.3rem 0' } },
          'Practice your words inside a story made just for you.'),
        h('div.muted', { style: { fontSize: '.8rem' } }, [
          'Themed to: ',
          interestChips.length ? interestChips.join('  ·  ') : 'pick your interests →',
          ' ',
          h('button.linkbtn', { style: { color: 'var(--green-d)' }, onclick: openInterests }, '✏️ edit'),
        ]),
      ]),
      h('button.btn.primary', { onclick: startAdventure }, 'Start ▶'),
    ]));

    page.appendChild(h('p.muted', 'Or practice a specific word set from your teacher:'));
    home.subjects.forEach((sub) => {
      const block = h('div.subject', [
        h('div.head', [
          h('span.icon', sub.icon),
          h('div', [h('strong', sub.name),
            h('div.muted', { style: { fontSize: '.8rem' } }, `${sub.progress}% mastered`)]),
        ]),
      ]);
      const list = h('div.deck-list');
      sub.decks.forEach((d) => {
        list.appendChild(h('div.deck', { onclick: () => openDeck(d) }, [
          h('div.nm', d.name),
          h('div.meta', [h('span', `${d.mastered}/${d.termCount} mastered`),
            h('span', taskIcons(d.tasks))]),
          h('div.progress-line', [h('i', { style: { width: d.progress + '%' } })]),
        ]));
      });
      block.appendChild(list);
      page.appendChild(block);
    });
    clear(content).appendChild(page);
  }

  function taskIcons(tasks) {
    const map = { flashcards: '🃏', quiz: '📝', reading: '📖' };
    return tasks.map((t) => map[t] || '').join(' ');
  }

  function openDeck(deck) {
    const body = h('div', [
      h('p.muted', 'Choose how you want to practice these words:'),
      ...['flashcards', 'quiz', 'reading'].filter((t) => deck.tasks.includes(t)).map((t) =>
        h('button.quiz-opt', { onclick: () => { m.close(); startTask(deck.id, t); } },
          `${{ flashcards: '🃏 Flashcards', quiz: '📝 Quiz', reading: '📖 Reading' }[t]}`)),
    ]);
    const m = modal(deck.name, body);
  }

  async function startTask(deckId, type) {
    clear(content);
    await openTask(content, { studentId, deckId, type, onDone: async () => {
      await refresh();
      go('garden');
    } });
  }

  async function startAdventure() {
    clear(content);
    await openAdventure(content, { studentId, onDone: async () => {
      await refresh();
      go('garden');
    } });
  }

  // ---- interests editor (drives personalization) ----
  function openInterests() {
    const all = catalog.interests || [];
    const chosen = new Set(home.student.interests || []);
    const grid = h('div.opt-row', { style: { flexWrap: 'wrap' } });
    all.forEach((opt) => {
      const chip = h(`button.interest-chip${chosen.has(opt.id) ? '.sel' : ''}`, {
        onclick: () => {
          if (chosen.has(opt.id)) chosen.delete(opt.id);
          else { if (chosen.size >= 4) { toast('Pick up to 4'); return; } chosen.add(opt.id); }
          chip.classList.toggle('sel');
        },
      }, `${opt.emoji} ${opt.name}`);
      grid.appendChild(chip);
    });
    const body = h('div', [
      h('p.muted', 'Pick up to 4 things you love — your adventures will be set in them.'),
      grid,
      h('button.btn.primary', { onclick: async () => {
        await api('interests', { body: { studentId, interests: [...chosen] } });
        await refresh();
        toast('Interests saved! ✨');
        m.close();
        if (current === 'learn') renderLearn();
      } }, 'Save interests'),
    ]);
    const m = modal('✨ My Interests', body);
  }

  // ---- the shared class town ----
  async function renderTown() {
    const t = await api('town');
    const page = h('div.page', [
      h('h2', `🏰 ${t.name}`),
      h('p.muted', `Your class builds this town together — every word everyone masters helps it grow. Town level ${t.level} · ${t.totalMastered} words mastered class-wide.`),
    ]);

    // Buildings strip.
    page.appendChild(h('div.card', [
      h('h3', 'Town Buildings'),
      h('div.town-buildings', t.buildings.map((b) =>
        h(`div.town-building${b.built ? '.built' : ''}`, { title: b.built ? b.name : `${b.name} — needs ${b.need} words` }, [
          h('div.emoji', b.built ? b.emoji : '🚧'),
          h('div.nm', b.name),
          h('div.need', b.built ? 'Built!' : `${b.need} words`),
        ]))),
      t.next ? h('div', { style: { marginTop: '.6rem' } }, [
        h('div.muted', { style: { fontSize: '.85rem' } },
          `Next: ${t.next.emoji} ${t.next.name} — ${t.next.remaining} more word(s) to go!`),
        h('div.progress-line', [h('i', { style: {
          width: Math.round(100 * t.totalMastered / t.next.need) + '%' } })]),
      ]) : h('p.muted', '🎉 Every building is complete — amazing teamwork!'),
    ]));

    // Contribution leaderboard.
    page.appendChild(h('div.card', { style: { marginTop: '1rem' } }, [
      h('h3', '🌾 Town Builders'),
      ...t.contributions.map((c, i) => h('div.row', {
        style: { alignItems: 'center', justifyContent: 'space-between',
          padding: '.35rem 0', borderBottom: '1px solid var(--line)',
          fontWeight: c.student.id === studentId ? '800' : '400' },
      }, [
        h('span', { style: { display: 'flex', alignItems: 'center', gap: '.5rem' } }, [
          h('span', `${i + 1}.`), avatarEl(c.student.avatar, '1.4rem'),
          c.student.name + (c.student.id === studentId ? ' (you)' : '')]),
        h('span.pill.green', `${c.mastered} words`),
      ])),
    ]));
    clear(content).appendChild(page);
  }

  // ---- explore other gardens ----
  async function renderExplore() {
    const page = h('div.page', [h('h2', '🧭 Visit Classmates\' Gardens'),
      h('p.muted', 'See how your friends are growing. Leave a cheer to encourage them!')]);
    const gardens = await api('gardens');
    const cards = h('div.garden-cards');
    gardens.filter((g) => g.student.id !== studentId).forEach((g) => {
      cards.appendChild(h('div.mini-garden', { onclick: () => visitGarden(g.student.id) }, [
        h('div.row', { style: { alignItems: 'center', gap: '.5rem' } }, [
          avatarEl(g.student.avatar, '1.8rem'),
          h('div', [h('strong', g.student.name), h('div.muted', { style: { fontSize: '.75rem' } }, `Lv ${g.student.level}`)]),
        ]),
        h('div.preview', { style: { marginTop: '.5rem' } },
          g.preview.map((p) => p.condition === 'dead' ? '🥀' : p.emoji).join('') || '🟫'),
        h('div.muted', { style: { fontSize: '.8rem', marginTop: '.4rem' } },
          `Score ${g.score} · ${g.thriving}/${g.plantCount} thriving`),
      ]));
    });
    page.appendChild(cards);
    clear(content).appendChild(page);
  }

  async function visitGarden(otherId) {
    if (otherId === studentId) return go('garden');
    const data = await api(`students/${otherId}/garden`);
    clear(content);
    const page = h('div.page');
    let cheers = data.cheers;
    const cheerBtn = h('button.btn.primary', { onclick: async () => {
      const r = await api('cheer', { body: { fromId: studentId, toId: otherId } });
      cheers = r.cheers; cheerLbl.textContent = `👏 ${cheers} cheers`;
      toast(`You cheered for ${data.owner.name}! 👏`);
    } }, '👏 Cheer');
    const cheerLbl = h('span.muted', `👏 ${cheers} cheers`);
    page.append(
      h('div.row', { style: { justifyContent: 'space-between', alignItems: 'center' } }, [
        h('div.row', { style: { alignItems: 'center' } }, [
          h('button.btn.ghost', { onclick: () => go('explore') }, '← Back'),
          avatarEl(data.owner.avatar, '2rem'),
          h('div', [h('h2', { style: { margin: 0 } }, `${data.owner.name}'s Garden`),
            h('div.muted', `Level ${data.owner.level} · Score ${data.garden.score}`)]),
        ]),
        h('div.row', { style: { alignItems: 'center' } }, [cheerLbl, cheerBtn]),
      ]),
    );
    const box = h('div', { style: { marginTop: '1rem' } });
    renderGarden(box, data.garden, { interactive: false });
    page.appendChild(box);
    clear(content).appendChild(page);
  }

  // ---- avatar studio ----
  function openAvatarStudio() {
    const parts = catalog.avatarParts;
    const unlocked = home.avatarUnlocks;
    const draft = { ...home.student.avatar };
    const preview = h('div', { style: { textAlign: 'center', margin: '.5rem 0 1rem' } },
      [avatarEl(draft, '4rem')]);
    function repaint() {
      clear(preview).appendChild(avatarEl(draft, '4rem'));
    }
    const body = h('div', [preview]);
    const partLabels = { face: 'Face', hat: 'Hat', pet: 'Pet', color: 'Color' };
    for (const part of ['face', 'hat', 'pet', 'color']) {
      body.appendChild(h('div.muted', { style: { fontWeight: 700 } }, partLabels[part]));
      const rowOpts = h('div.opt-row');
      (unlocked[part] || parts[part]).forEach((opt) => {
        const isLocked = opt.unlocked === false;
        const o = h(`div.opt${draft[part] === opt.id ? '.sel' : ''}${isLocked ? '.locked' : ''}`, {
          onclick: () => {
            if (isLocked) { toast(`🔒 Unlocks at level ${opt.level}`); return; }
            draft[part] = opt.id;
            rowOpts.querySelectorAll('.opt').forEach((x) => x.classList.remove('sel'));
            o.classList.add('sel'); repaint();
          },
        }, opt.emoji || (part === 'hat' || part === 'pet' ? '∅' : ''));
        if (part === 'color') o.style.background = opt.hex;
        if (isLocked) o.appendChild(h('span.lock', '🔒'));
        rowOpts.appendChild(o);
      });
      body.appendChild(rowOpts);
    }
    body.appendChild(h('button.btn.primary', { onclick: async () => {
      await api('avatar', { body: { studentId, avatar: draft } });
      await refresh();
      clear(view).append(topbar(), content);
      renderNav();
      toast('Avatar saved! ✨');
      m.close();
    } }, 'Save avatar'));
    const m = modal('🎨 Avatar Studio', body);
  }

  // ---- boot ----
  (async () => {
    await refresh();
    view.append(topbar(), content);
    clear(root).appendChild(view);
    go('garden');
  })();
}
