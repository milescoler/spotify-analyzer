// Shared helpers: DOM building, API calls, avatar rendering, toasts.

export async function api(path, opts = {}) {
  const res = await fetch('/api/' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    method: opts.method || (opts.body ? 'POST' : 'GET'),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// Minimal hyperscript. h('div.card', {onclick}, [children]) or h('div', 'text').
export function h(sel, props, children) {
  const [tag, ...classes] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props && (typeof props === 'string' || typeof props === 'number')) {
    el.textContent = props;
    return el;
  }
  if (Array.isArray(props)) { children = props; props = null; }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (v != null) el.setAttribute(k, v);
    }
  }
  appendChildren(el, children);
  return el;
}
function appendChildren(el, children) {
  if (children == null) return;
  if (!Array.isArray(children)) children = [children];
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number'
      ? document.createTextNode(String(c)) : c);
  }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

// Catalog (species/decorations/avatar parts) fetched once at boot.
export const catalog = {};
export function setCatalog(c) { Object.assign(catalog, c); }

function emojiFor(part, id) {
  const opt = (catalog.avatarParts?.[part] || []).find((o) => o.id === id);
  return opt ? opt.emoji : '';
}
function colorFor(id) {
  const opt = (catalog.avatarParts?.color || []).find((o) => o.id === id);
  return opt ? opt.hex : '#5bb85b';
}

// Render an avatar at a given font-size (em drives everything).
export function avatarEl(avatar = {}, size = '3rem') {
  const a = { face: 'happy', hat: 'none', pet: 'none', color: 'green', ...avatar };
  const wrap = h('span.avatar', { style: { fontSize: size, '--c': colorFor(a.color) } });
  wrap.appendChild(h('span.ring'));
  wrap.appendChild(h('span.face', emojiFor('face', a.face) || '🙂'));
  const hat = emojiFor('hat', a.hat);
  if (hat) wrap.appendChild(h('span.hat', hat));
  const pet = emojiFor('pet', a.pet);
  if (pet) wrap.appendChild(h('span.pet', pet));
  return wrap;
}

let toastTimer = null;
export function toast(msg, ms = 2200) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = h('div.toast', msg);
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

export function modal(title, contentEl) {
  const bg = h('div.modal-bg', { onclick: (e) => { if (e.target === bg) bg.remove(); } });
  const close = () => bg.remove();
  const box = h('div.modal', [
    h('h2', [title, h('button.x', { onclick: close }, '×')]),
    contentEl,
  ]);
  bg.appendChild(box);
  document.body.appendChild(bg);
  return { close, bg };
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
