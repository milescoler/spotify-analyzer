// Isometric "city builder" garden renderer (Canvas2D, no dependencies).
//
// The garden is a grid of raised soil tiles drawn in 2:1 isometric projection,
// giving a top-down 3D look. Each learned word is a plant sprite that grows
// through its stages, sways gently when healthy, droops when thirsty, and turns
// grey when it dies. Decorations are placed as objects on the land. Players can
// drag to pan, pinch / scroll / use buttons to zoom, and tap a plant to inspect
// it. Tapping bare soil routes back to practicing (to "plant" there).
import { h, clear } from './util.js';

const TILE_W = 64;          // isometric tile width  (screen px at zoom 1)
const TILE_H = 32;          // isometric tile height (2:1 diamond)
const BLOCK_H = 16;         // soil block thickness, gives the 3D edge

const STAGE_LIFT = { seed: 2, sprout: 6, seedling: 11, bud: 16, bloom: 20, flourishing: 24 };
const STAGE_SIZE = { seed: 16, sprout: 22, seedling: 30, bud: 36, bloom: 42, flourishing: 48 };

export function renderGarden(container, garden, opts = {}) {
  const { interactive = false, onPlotClick = null, plots = 12 } = opts;
  clear(container);

  const scene = h('div.garden-scene');
  const canvas = h('canvas.garden-canvas');
  scene.appendChild(canvas);

  if (interactive) {
    scene.appendChild(h('div.garden-hint', 'Drag to look around · pinch/scroll to zoom · tap a plant'));
  }
  const controls = h('div.garden-controls', [
    h('button', { title: 'Zoom in', onclick: () => view.zoomBy(1.2) }, '+'),
    h('button', { title: 'Zoom out', onclick: () => view.zoomBy(1 / 1.2) }, '−'),
    h('button', { title: 'Re-center', onclick: () => view.recenter() }, '⤢'),
  ]);
  scene.appendChild(controls);
  container.appendChild(scene);

  const view = new GardenScene(canvas, garden, { interactive, onPlotClick, plots });
  view.start();
  return view;
}

class GardenScene {
  constructor(canvas, garden, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts;
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.selected = null;
    this.layout(garden);
    this.bindInput();
    this.resize();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas);
  }

  // Assign plants + decorations to tiles on a square-ish plot of land.
  layout(garden) {
    const plants = [...garden.plants].sort((a, b) => a.plot - b.plot);
    const decos = garden.decorations || [];
    const needed = Math.max(plants.length + decos.length, this.opts.plots, 9);
    this.n = Math.max(3, Math.ceil(Math.sqrt(needed)));

    this.tiles = [];          // every ground tile
    this.objects = [];        // plants + decorations placed on tiles
    let idx = 0;
    const place = (gx, gy, payload) => {
      this.tiles.push({ gx, gy, kind: payload ? payload.kind : 'soil' });
      if (payload) this.objects.push({ ...payload, gx, gy });
    };
    const seq = [
      ...plants.map((p) => ({ kind: 'plant', plant: p })),
      ...decos.map((d) => ({ kind: 'deco', deco: d })),
    ];
    for (let gy = 0; gy < this.n; gy++) {
      for (let gx = 0; gx < this.n; gx++) {
        place(gx, gy, seq[idx] || null);
        idx++;
      }
    }
    // Painter's algorithm: draw back tiles first.
    this.tiles.sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
    this.objects.sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || 600;
    const hgt = this.canvas.clientHeight || 440;
    this.cssW = w; this.cssH = hgt;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(hgt * dpr);
    this.dpr = dpr;
    // Keep the plot centered until the player pans/zooms themselves.
    if (!this._userMoved) this.recenter();
  }

  // World coords (pre-zoom) for a tile's top-face center.
  worldOf(gx, gy) {
    return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) };
  }
  // Center the whole plot in the viewport.
  recenter() {
    this._userMoved = false;
    const mid = (this.n - 1) / 2;
    const c = this.worldOf(mid, mid);
    this.zoom = Math.min(1.4, Math.max(0.7, (this.cssW || 600) / (this.n * TILE_W + 120)));
    this.pan.x = this.cssW / 2 - c.x * this.zoom;
    this.pan.y = this.cssH / 2 - c.y * this.zoom + 10;
  }
  zoomBy(f) {
    this._userMoved = true;
    const cx = this.cssW / 2, cy = this.cssH / 2;
    const wx = (cx - this.pan.x) / this.zoom, wy = (cy - this.pan.y) / this.zoom;
    this.zoom = Math.min(2.4, Math.max(0.45, this.zoom * f));
    this.pan.x = cx - wx * this.zoom;
    this.pan.y = cy - wy * this.zoom;
  }

  // ---- input: drag to pan, wheel + pinch to zoom, tap to select ----
  bindInput() {
    const c = this.canvas;
    let dragging = false, moved = 0, last = null, pinchDist = 0;
    const pos = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture?.(e.pointerId);
      dragging = true; moved = 0; last = pos(e);
    });
    c.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const p = pos(e);
      this.pan.x += p.x - last.x; this.pan.y += p.y - last.y;
      moved += Math.abs(p.x - last.x) + Math.abs(p.y - last.y);
      if (moved > 6) this._userMoved = true;
      last = p;
    });
    const end = (e) => {
      if (dragging && moved < 6) this.handleTap(pos(e));
      dragging = false;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', () => { dragging = false; });

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    }, { passive: false });

    // Two-finger pinch zoom.
    c.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY);
      if (pinchDist) this.zoomBy(d / pinchDist);
      pinchDist = d;
    }, { passive: false });
    c.addEventListener('touchend', () => { pinchDist = 0; });
  }

  // Hit-test objects front-to-back (their drawn sprite), else the ground tile.
  handleTap(p) {
    if (!this.opts.interactive) return;
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      const s = this.screenOf(o.gx, o.gy);
      const size = (o.kind === 'plant' ? spriteSize(o.plant) : 34) * this.zoom;
      const cx = s.x, cy = s.y - (o.kind === 'plant' ? spriteLift(o.plant) : 18) * this.zoom;
      if (Math.abs(p.x - cx) < size * 0.55 && p.y > cy - size && p.y < cy + size * 0.4) {
        this.selected = o;
        if (o.kind === 'plant') this.opts.onPlotClick?.(o.plant);
        return;
      }
    }
    // Empty tile -> invite to plant.
    const t = this.tileAt(p);
    if (t && !this.objects.some((o) => o.gx === t.gx && o.gy === t.gy)) {
      this.selected = { gx: t.gx, gy: t.gy, kind: 'soil' };
      this.opts.onPlotClick?.(null, t.gy * this.n + t.gx);
    }
  }

  screenOf(gx, gy) {
    const w = this.worldOf(gx, gy);
    return { x: this.pan.x + w.x * this.zoom, y: this.pan.y + w.y * this.zoom };
  }
  tileAt(p) {
    const wx = (p.x - this.pan.x) / this.zoom, wy = (p.y - this.pan.y) / this.zoom;
    const gx = Math.round((wx / (TILE_W / 2) + wy / (TILE_H / 2)) / 2);
    const gy = Math.round((wy / (TILE_H / 2) - wx / (TILE_W / 2)) / 2);
    if (gx < 0 || gy < 0 || gx >= this.n || gy >= this.n) return null;
    return { gx, gy };
  }

  // ---- render loop ----
  start() {
    const loop = (t) => {
      if (!this.canvas.isConnected) { this._ro?.disconnect(); return; } // detached: stop
      this.draw(t || 0);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  draw(time) {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.save();
    ctx.translate(this.pan.x, this.pan.y);
    ctx.scale(this.zoom, this.zoom);

    for (const t of this.tiles) this.drawTile(t);
    for (const o of this.objects) {
      if (o.kind === 'plant') this.drawPlant(o, time);
      else this.drawDeco(o, time);
    }
    ctx.restore();
  }

  drawTile(t) {
    const { ctx } = this;
    const { x, y } = this.worldOf(t.gx, t.gy);
    const hw = TILE_W / 2, hh = TILE_H / 2;
    const selected = this.selected && this.selected.gx === t.gx && this.selected.gy === t.gy;
    const grass = (t.gx + t.gy) % 2 === 0 ? '#8fd06a' : '#83c75f';
    const soilTop = selected ? '#c8e89a' : grass;

    // Left & right block faces (the "3D" thickness).
    ctx.fillStyle = '#5a8f3c';
    ctx.beginPath();
    ctx.moveTo(x - hw, y); ctx.lineTo(x, y + hh);
    ctx.lineTo(x, y + hh + BLOCK_H); ctx.lineTo(x - hw, y + BLOCK_H);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6cab4c';
    ctx.beginPath();
    ctx.moveTo(x + hw, y); ctx.lineTo(x, y + hh);
    ctx.lineTo(x, y + hh + BLOCK_H); ctx.lineTo(x + hw, y + BLOCK_H);
    ctx.closePath(); ctx.fill();

    // Top face diamond.
    ctx.fillStyle = soilTop;
    ctx.beginPath();
    ctx.moveTo(x, y - hh); ctx.lineTo(x + hw, y);
    ctx.lineTo(x, y + hh); ctx.lineTo(x - hw, y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,90,40,.18)'; ctx.lineWidth = 1; ctx.stroke();

    // Empty plantable tile: faint marker.
    if (this.opts.interactive && t.kind === 'soil') {
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', x, y);
    }
  }

  drawPlant(o, time) {
    const { ctx } = this;
    const st = o.plant.state;
    const base = this.worldOf(o.gx, o.gy);
    const size = spriteSize(o.plant);
    const lift = spriteLift(o.plant);
    const emoji = st.condition === 'dead' ? '🥀'
      : st.stageIndex <= 0 ? '🌱' : o.plant.emoji;

    // Shadow on the soil.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y + 2, size * 0.32, size * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sway / droop depending on health.
    let tilt = 0, bob = 0;
    if (st.condition === 'dead') tilt = 0.5;
    else if (st.condition === 'wilting') tilt = 0.28 + Math.sin(time / 900 + o.gx) * 0.03;
    else if (st.condition === 'thirsty') tilt = 0.12 + Math.sin(time / 700 + o.gx) * 0.05;
    else { tilt = Math.sin(time / 800 + o.gx + o.gy) * 0.05; bob = Math.sin(time / 600 + o.gx) * 1.5; }

    ctx.save();
    ctx.translate(base.x, base.y - lift + bob);
    ctx.rotate(tilt);
    if (st.condition === 'dead') ctx.filter = 'grayscale(100%) brightness(.7)';
    else if (st.condition === 'wilting') ctx.filter = 'grayscale(45%)';
    ctx.font = `${size}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(emoji, 0, 0);
    ctx.restore();

    // Floating health bar.
    const bw = 26, bx = base.x - bw / 2, by = base.y - lift - size - 6;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    roundRect(ctx, bx - 1, by - 1, bw + 2, 6, 3); ctx.fill();
    ctx.fillStyle = healthColor(st.health);
    roundRect(ctx, bx, by, bw * Math.max(0.04, st.health), 4, 2); ctx.fill();

    if (st.condition === 'thirsty') {
      ctx.font = '13px serif'; ctx.textAlign = 'center';
      ctx.fillText('💧', base.x + size * 0.32, base.y - lift - size * 0.3);
    }
  }

  drawDeco(o, time) {
    const { ctx } = this;
    const base = this.worldOf(o.gx, o.gy);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y + 2, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(o.deco.emoji, base.x, base.y - 10);
  }
}

function spriteSize(plant) { return STAGE_SIZE[plant.state.stage] || 28; }
function spriteLift(plant) { return STAGE_LIFT[plant.state.stage] || 8; }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function healthColor(hp) {
  if (hp < 0.1) return '#9a9a9a';
  if (hp < 0.4) return '#e07a5f';
  if (hp < 0.7) return '#e6b34a';
  return '#5bb85b';
}
