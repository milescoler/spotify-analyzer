// Entry point: load catalog, show the sign-in picker, and route to the student
// or teacher experience.
import { h, clear, api, avatarEl, setCatalog } from './util.js';
import { mountStudent } from './student.js';
import { mountTeacher } from './teacher.js';

const root = document.getElementById('app');
const SAVED = 'wordgarden.user';

async function boot() {
  let data;
  try {
    data = await api('bootstrap');
  } catch (e) {
    clear(root).appendChild(h('div.boot', '⚠️ Could not reach the server. Is it running?'));
    return;
  }
  setCatalog(data.catalog);

  const remembered = localStorage.getItem(SAVED);
  if (remembered) {
    const found = [...data.students, ...data.teachers].find((u) => u.id === remembered);
    if (found) return enter(found);
  }
  showLogin(data);
}

function showLogin(data) {
  const wrap = h('div.login-wrap', [
    h('h1', '🌱 Word Garden'),
    h('p.sub', 'Grow a garden by learning words. Practice to make your plants bloom — neglect them and they wilt!'),
    h('div.section-label', '👧 I am a student'),
    h('div.who-grid', data.students.map((s) =>
      h('div.who-card', { onclick: () => enter(s) }, [
        avatarEl(s.avatar, '2.6rem'),
        h('div.nm', s.name),
        h('div.lv', `Level ${s.level}`),
      ]))),
    h('div.section-label', '🍎 I am a teacher'),
    h('div.who-grid', data.teachers.map((t) =>
      h('div.who-card', { onclick: () => enter(t) }, [
        h('div.av', '🍎'),
        h('div.nm', t.name),
        h('div.lv', 'Teacher'),
      ]))),
    h('p.muted', { style: { marginTop: '2rem', fontSize: '.8rem' } }, [
      'Demo environment · ',
      h('button.linkbtn', { style: { color: 'var(--muted)' }, onclick: async () => {
        if (confirm('Reset all demo data to its starting state?')) {
          await api('reset', { method: 'POST', body: {} });
          location.reload();
        }
      } }, 'reset demo data'),
    ]),
  ]);
  clear(root).append(h('div.app-shell', [wrap]));
}

function enter(user) {
  localStorage.setItem(SAVED, user.id);
  const switchUser = () => { localStorage.removeItem(SAVED); boot(); };
  if (user.role === 'teacher') mountTeacher(root, user.id, switchUser);
  else mountStudent(root, user.id, switchUser);
}

boot();
