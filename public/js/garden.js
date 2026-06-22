// Roblox-style 3D garden (Three.js, loaded via import map / CDN).
//
// The student's garden is a walkable 3D world: a blocky avatar character
// (styled from the student's chosen avatar), a third-person follow camera, an
// on-screen joystick for movement, and low-poly plants that grow with mastery
// and wilt/die without practice. Walk up to a plant to inspect it.
//
// Visiting another garden (interactive:false) shows the same world with a
// draggable, slowly auto-rotating camera and no character.
//
// renderGarden(container, garden, opts) keeps the same signature as before, so
// the home and visit views don't change. It loads Three.js lazily and falls
// back to a friendly message if WebGL/Three can't load.
import { h, clear, catalog } from './util.js';

const SPACING = 4.2;            // distance between planting tiles
let THREE = null;

const SPECIES_COLOR = {
  daisy: 0xfff4b0, tulip: 0xff6f91, sunflower: 0xffc93c, rose: 0xff4d6d,
  hibiscus: 0xff7eb6, sapling: 0x6abf4b, cactus: 0x4caf50, lotus: 0xf3a0c8,
};
const STAGE_SCALE = { seed: 0.35, sprout: 0.55, seedling: 0.78, bud: 0.95, bloom: 1.12, flourishing: 1.3 };

export async function renderGarden(container, garden, opts = {}) {
  clear(container);
  const scene = h('div.garden-scene');
  container.appendChild(scene);
  scene.appendChild(h('div.garden-hint',
    opts.interactive ? '🕹️ Use the joystick to walk · stand by a plant to inspect it'
                     : 'Drag to look around'));

  if (!THREE) {
    // Try the import-map specifier first, then fall back across CDNs so one
    // blocked host doesn't break the 3D world.
    const sources = [
      'three',
      'https://unpkg.com/three@0.160.0/build/three.module.js',
      'https://esm.sh/three@0.160.0',
    ];
    for (const src of sources) {
      try { THREE = await import(/* @vite-ignore */ src); if (THREE) break; }
      catch (err) { /* try next */ }
    }
    if (!THREE) {
      clear(scene);
      scene.appendChild(h('div.empty-note', [
        h('div', { style: { fontSize: '2rem' } }, '🌐🌱'),
        h('p', 'The 3D garden needs an internet connection to load.'),
        h('p.muted', 'Open this in your Codespace or phone browser (which have internet) and it will appear.'),
      ]));
      return null;
    }
  }
  try {
    const world = new GardenWorld(scene, garden, opts);
    world.start();
    return world;
  } catch (err) {
    console.error(err);
    clear(scene);
    scene.appendChild(h('div.empty-note', `Could not start the 3D garden: ${err.message}`));
    return null;
  }
}

class GardenWorld {
  constructor(mount, garden, opts) {
    this.mount = mount;
    this.opts = opts;
    this.garden = garden;
    this.plants = [];
    this.clock = new THREE.Clock();
    this.tmp = new THREE.Vector3();

    const n = Math.max(3, Math.ceil(Math.sqrt(Math.max(
      garden.plants.length + (garden.decorations?.length || 0), 9))));
    this.n = n;
    this.half = (n - 1) / 2;
    this.bound = (n * SPACING) / 2 + 6;

    this.initRenderer();
    this.initScene();
    this.buildGround();
    this.buildPlants();
    this.buildDecorations();

    if (opts.interactive) {
      this.buildCharacter();
      this.buildJoystick();
      this.buildPrompt();
    } else {
      this.initOrbit();
    }
    this.initCamera();
    this._onResize = () => this.resize();
    this._ro = new ResizeObserver(this._onResize);
    this._ro.observe(this.mount);
    this.resize();
  }

  initRenderer() {
    const canvas = h('canvas.garden-canvas');
    this.mount.insertBefore(canvas, this.mount.firstChild);
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  initScene() {
    const s = new THREE.Scene();
    s.background = new THREE.Color(0x9fd4ff);
    s.fog = new THREE.Fog(0x9fd4ff, 40, 90);
    this.scene = s;

    const amb = new THREE.HemisphereLight(0xffffff, 0x6b8f4e, 0.9);
    s.add(amb);
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.1);
    sun.position.set(12, 24, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const d = this.bound + 8;
    Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 80 });
    s.add(sun);
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    this.camOffset = new THREE.Vector3(0, 13, 17);
    if (this.character) {
      this.camera.position.copy(this.character.position).add(this.camOffset);
      this.camera.lookAt(this.character.position);
    } else {
      this.camera.position.set(0, 16, this.bound + 10);
      this.camera.lookAt(0, 0, 0);
    }
  }

  buildGround() {
    // Big grass plane.
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshStandardMaterial({ color: 0x7cc35a }));
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.scene.add(grass);

    // Raised soil platform for the planting area.
    const sz = this.n * SPACING + 2;
    const plat = new THREE.Mesh(
      new THREE.BoxGeometry(sz, 0.6, sz),
      new THREE.MeshStandardMaterial({ color: 0x9c6b43 }));
    plat.position.y = 0.3;
    plat.receiveShadow = true;
    this.scene.add(plat);

    // Dirt tiles where things grow.
    const tileGeo = new THREE.BoxGeometry(SPACING * 0.82, 0.2, SPACING * 0.82);
    const tileMat = new THREE.MeshStandardMaterial({ color: 0x7d5635 });
    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < this.n; c++) {
        const t = new THREE.Mesh(tileGeo, tileMat);
        const p = this.tilePos(c, r);
        t.position.set(p.x, 0.65, p.z);
        t.receiveShadow = true;
        this.scene.add(t);
      }
    }

    // Low fence around the platform.
    this.buildFence(sz);
  }

  buildFence(sz) {
    const postMat = new THREE.MeshStandardMaterial({ color: 0xede3cf });
    const half = sz / 2;
    const step = SPACING;
    const make = (x, z) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 0.35), postMat);
      post.position.set(x, 0.9, z);
      post.castShadow = true;
      this.scene.add(post);
    };
    for (let x = -half; x <= half + 0.01; x += step) { make(x, -half); make(x, half); }
    for (let z = -half; z <= half + 0.01; z += step) { make(-half, z); make(half, z); }
  }

  tilePos(col, row) {
    return { x: (col - this.half) * SPACING, z: (row - this.half) * SPACING };
  }

  buildPlants() {
    const sorted = [...this.garden.plants].sort((a, b) => a.plot - b.plot);
    sorted.forEach((plant, i) => {
      const col = i % this.n, row = Math.floor(i / this.n);
      const pos = this.tilePos(col, row);
      const group = this.makePlant(plant);
      group.position.set(pos.x, 0.75, pos.z);
      this.scene.add(group);
      this.plants.push({ plant, group, pos });
    });
  }

  // A low-poly plant: mound + stem + bloom, scaled by stage, tinted by health.
  makePlant(plant) {
    const st = plant.state;
    const g = new THREE.Group();
    const scale = STAGE_SCALE[st.stage] || 0.6;
    const dead = st.condition === 'dead';
    const wilt = st.condition === 'wilting';

    const stemColor = dead ? 0x8a7a5a : wilt ? 0x9bAa5f : 0x4f9e3f;
    const bloomColor = dead ? 0x9b8a6a : SPECIES_COLOR[plant.species] || 0xff7eb6;

    // Mound.
    const mound = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.85, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2e }));
    mound.position.y = 0.15; mound.castShadow = true; g.add(mound);

    // Stem.
    const stemH = 1.6 * scale;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, stemH, 6),
      new THREE.MeshStandardMaterial({ color: stemColor }));
    stem.position.y = 0.3 + stemH / 2; stem.castShadow = true; g.add(stem);

    // Bloom — a sphere of "petals" (icosahedron) for flowers, cone for sapling.
    const bloom = plant.species === 'sapling' || plant.species === 'cactus'
      ? new THREE.Mesh(new THREE.ConeGeometry(0.7 * scale, 1.3 * scale, 8),
          new THREE.MeshStandardMaterial({ color: dead ? 0x8a7a5a : 0x4caf50 }))
      : new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * scale, 0),
          new THREE.MeshStandardMaterial({ color: bloomColor, flatShading: true }));
    bloom.position.y = 0.3 + stemH + 0.2 * scale;
    bloom.castShadow = true;
    g.add(bloom);
    g.userData.bloom = bloom;
    g.userData.stem = stem;
    g.userData.baseY = bloom.position.y;

    // Tilt dead/wilting plants over.
    if (dead) g.rotation.z = 0.7;
    else if (wilt) g.rotation.z = 0.3;

    // Floating word label.
    const label = makeLabelSprite(`${dead ? '🥀' : plant.emoji} ${plant.term}`);
    label.position.set(0, 0.3 + stemH + 1.1 * scale + 0.4, 0);
    label.scale.multiplyScalar(0.9);
    g.add(label);
    g.userData.label = label;

    // Health ring on the soil.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.78, 0.95, 20),
      new THREE.MeshBasicMaterial({ color: healthColor(st.health), side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.32;
    g.add(ring);
    return g;
  }

  buildDecorations() {
    const decos = this.garden.decorations || [];
    decos.forEach((d, i) => {
      // Place decorations just outside the planting rows, along the front.
      const x = (i - (decos.length - 1) / 2) * SPACING;
      const z = this.half * SPACING + SPACING;
      const sprite = makeLabelSprite(d.emoji, 2.4);
      sprite.position.set(x, 1.3, z);
      this.scene.add(sprite);
    });
  }

  // ---- character (Roblox-style blocky avatar) ----
  buildCharacter() {
    const av = this.opts.avatar || {};
    const bodyHex = colorHex(av.color) || 0x4a90d9;
    const skin = 0xf2c79b;
    const g = new THREE.Group();

    const mat = (c) => new THREE.MeshStandardMaterial({ color: c });
    const legL = box(0.32, 0.7, 0.32, mat(0x3a3f52)); legL.position.set(-0.18, 0.35, 0);
    const legR = box(0.32, 0.7, 0.32, mat(0x3a3f52)); legR.position.set(0.18, 0.35, 0);
    const torso = box(0.8, 0.8, 0.45, mat(bodyHex)); torso.position.set(0, 1.1, 0);
    const armL = box(0.24, 0.7, 0.28, mat(bodyHex)); armL.position.set(-0.56, 1.15, 0);
    const armR = box(0.24, 0.7, 0.28, mat(bodyHex)); armR.position.set(0.56, 1.15, 0);

    // Head with the avatar face on the front.
    const headMat = [mat(skin), mat(skin), mat(skin), mat(skin),
      new THREE.MeshStandardMaterial({ map: faceTexture(av.face) }), mat(skin)];
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), headMat);
    head.position.set(0, 1.95, 0);

    [legL, legR, torso, armL, armR, head].forEach((m) => { m.castShadow = true; g.add(m); });
    this.charLimbs = { legL, legR, armL, armR };

    // Hat as a floating emoji above the head (matches avatar studio).
    const hatEmoji = emojiOf('hat', av.hat);
    if (hatEmoji) { const hs = makeLabelSprite(hatEmoji, 1.4); hs.position.set(0, 2.6, 0); g.add(hs); }
    // Pet trailing beside the character.
    const petEmoji = emojiOf('pet', av.pet);
    if (petEmoji) { this.pet = makeLabelSprite(petEmoji, 1.2); this.pet.position.set(1, 1, 1); g.add(this.pet); }

    g.position.set(0, 0, this.half * SPACING + SPACING + 2);
    this.character = g;
    this.charVel = new THREE.Vector3();
    this.scene.add(g);
  }

  // ---- on-screen joystick ----
  buildJoystick() {
    this.joy = { x: 0, y: 0, active: false };
    const base = h('div.joystick');
    const knob = h('div.joystick-knob');
    base.appendChild(knob);
    this.mount.appendChild(base);
    const R = 46;
    const set = (dx, dy) => {
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(len, R);
      const nx = dx / len * cl, ny = dy / len * cl;
      knob.style.transform = `translate(${nx}px, ${ny}px)`;
      this.joy.x = nx / R; this.joy.y = -ny / R; // up on screen = +y (forward)
    };
    const reset = () => { this.joy.x = this.joy.y = 0; this.joy.active = false; knob.style.transform = 'translate(0,0)'; };
    let id = null, cx = 0, cy = 0;
    base.addEventListener('pointerdown', (e) => {
      id = e.pointerId; base.setPointerCapture(id);
      const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      this.joy.active = true; set(e.clientX - cx, e.clientY - cy);
    });
    base.addEventListener('pointermove', (e) => { if (this.joy.active) set(e.clientX - cx, e.clientY - cy); });
    const up = () => reset();
    base.addEventListener('pointerup', up);
    base.addEventListener('pointercancel', up);

    // Keyboard fallback (desktop).
    this.keys = {};
    this._kd = (e) => { this.keys[e.key.toLowerCase()] = true; };
    this._ku = (e) => { this.keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
  }

  buildPrompt() {
    this.prompt = h('button.garden-prompt', { onclick: () => {
      if (this.nearPlant) this.opts.onPlotClick?.(this.nearPlant.plant);
    } });
    this.prompt.style.display = 'none';
    this.mount.appendChild(this.prompt);
  }

  // ---- drag-to-orbit camera for visiting ----
  initOrbit() {
    this.orbit = { yaw: 0.6, pitch: 0.9, dist: this.bound + 12, drag: false, idle: 0 };
    const c = this.canvas;
    let last = null;
    c.style.cursor = 'grab';
    c.addEventListener('pointerdown', (e) => { this.orbit.drag = true; last = { x: e.clientX, y: e.clientY }; this.orbit.idle = 0; });
    c.addEventListener('pointermove', (e) => {
      if (!this.orbit.drag) return;
      this.orbit.yaw -= (e.clientX - last.x) * 0.01;
      this.orbit.pitch = Math.min(1.3, Math.max(0.25, this.orbit.pitch - (e.clientY - last.y) * 0.01));
      last = { x: e.clientX, y: e.clientY };
    });
    const up = () => { this.orbit.drag = false; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.orbit.dist = Math.min(60, Math.max(8, this.orbit.dist + e.deltaY * 0.02)); }, { passive: false });
  }

  resize() {
    const w = this.mount.clientWidth || 600, hgt = this.mount.clientHeight || 440;
    this.renderer.setSize(w, hgt, false);
    this.camera.aspect = w / hgt;
    this.camera.updateProjectionMatrix();
  }

  start() {
    const loop = () => {
      if (!this.canvas.isConnected) return this.dispose();
      this.update(Math.min(this.clock.getDelta(), 0.05));
      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  update(dt) {
    const t = this.clock.elapsedTime;
    // Idle sway for living plants; labels always face the camera.
    for (const { plant, group } of this.plants) {
      const st = plant.state;
      if (group.userData.bloom && st.condition === 'thriving') {
        group.userData.bloom.position.y = group.userData.baseY + Math.sin(t * 2 + group.position.x) * 0.05;
        group.rotation.z = Math.sin(t * 1.5 + group.position.z) * 0.04;
      } else if (st.condition === 'thirsty') {
        group.rotation.z = 0.12 + Math.sin(t * 2) * 0.03;
      }
    }

    if (this.character) this.updateCharacter(dt, t);
    else this.updateOrbit(dt);
  }

  updateCharacter(dt, t) {
    // Movement vector from joystick (+ keyboard).
    let mx = this.joy?.x || 0, mz = -(this.joy?.y || 0); // +y forward = -z
    if (this.keys) {
      if (this.keys['w'] || this.keys['arrowup']) mz -= 1;
      if (this.keys['s'] || this.keys['arrowdown']) mz += 1;
      if (this.keys['a'] || this.keys['arrowleft']) mx -= 1;
      if (this.keys['d'] || this.keys['arrowright']) mx += 1;
    }
    const len = Math.hypot(mx, mz);
    const ch = this.character;
    if (len > 0.05) {
      mx /= len; mz /= len;
      const speed = 7;
      ch.position.x = clamp(ch.position.x + mx * speed * dt, -this.bound, this.bound);
      ch.position.z = clamp(ch.position.z + mz * speed * dt, -this.bound, this.bound);
      ch.rotation.y = Math.atan2(mx, mz);
      // Walk animation: swing limbs.
      const sw = Math.sin(t * 12) * 0.5;
      this.charLimbs.legL.rotation.x = sw; this.charLimbs.legR.rotation.x = -sw;
      this.charLimbs.armL.rotation.x = -sw; this.charLimbs.armR.rotation.x = sw;
    } else {
      for (const k in this.charLimbs) this.charLimbs[k].rotation.x *= 0.8;
    }
    if (this.pet) this.pet.position.y = 1 + Math.sin(t * 3) * 0.15;

    // Follow camera (fixed world angle, smoothed).
    this.tmp.copy(ch.position).add(this.camOffset);
    this.camera.position.lerp(this.tmp, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(ch.position.x, ch.position.y + 1.4, ch.position.z);

    // Proximity inspect prompt.
    let near = null, best = 9;
    for (const p of this.plants) {
      const dx = p.pos.x - ch.position.x, dz = p.pos.z - ch.position.z;
      const d = Math.hypot(dx, dz);
      if (d < best) { best = d; near = p; }
    }
    if (near && best < 2.6) {
      if (this.nearPlant !== near) {
        this.nearPlant = near;
        const st = near.plant.state;
        this.prompt.textContent = `🔍 ${near.plant.term} — ${Math.round(st.health * 100)}% · tap to inspect`;
        this.prompt.style.display = '';
      }
    } else if (this.nearPlant) {
      this.nearPlant = null; this.prompt.style.display = 'none';
    }
  }

  updateOrbit(dt) {
    const o = this.orbit;
    if (!o.drag) { o.idle += dt; if (o.idle > 1.5) o.yaw += dt * 0.15; }
    const cx = Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist;
    const cz = Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist;
    const cy = Math.sin(o.pitch) * o.dist;
    this.camera.position.set(cx, Math.max(4, cy), cz);
    this.camera.lookAt(0, 1, 0);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this._ro?.disconnect();
    if (this._kd) { window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku); }
    this.renderer?.dispose();
  }
}

// ---- helpers ----------------------------------------------------------------

function box(w, hgt, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function colorHex(colorId) {
  const opt = (catalog.avatarParts?.color || []).find((o) => o.id === colorId);
  return opt ? parseInt(opt.hex.replace('#', '0x')) : null;
}
function emojiOf(part, id) {
  const opt = (catalog.avatarParts?.[part] || []).find((o) => o.id === id);
  return opt ? opt.emoji : '';
}

// A canvas texture of an emoji, used for the character's face.
function faceTexture(faceId) {
  const emoji = emojiOf('face', faceId) || '🙂';
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f2c79b'; ctx.fillRect(0, 0, 128, 128);
  ctx.font = '88px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 70);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 2;
  return tex;
}

// A billboard text/emoji sprite that always faces the camera.
function makeLabelSprite(text, worldScale = 3) {
  const cv = document.createElement('canvas');
  const pad = 16; const font = 52;
  const ctx = cv.getContext('2d');
  ctx.font = `${font}px sans-serif`;
  const w = Math.max(64, ctx.measureText(text).width + pad * 2);
  cv.width = w; cv.height = font + pad * 2;
  const c2 = cv.getContext('2d');
  c2.font = `${font}px sans-serif`;
  c2.fillStyle = 'rgba(20,30,18,.55)';
  roundRect(c2, 0, 0, cv.width, cv.height, 18); c2.fill();
  c2.fillStyle = '#fff'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
  c2.fillText(text, cv.width / 2, cv.height / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  spr.scale.set(worldScale * (cv.width / cv.height), worldScale, 1);
  return spr;
}

function roundRect(ctx, x, y, w, hgt, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hgt, r);
  ctx.arcTo(x + w, y + hgt, x, y + hgt, r);
  ctx.arcTo(x, y + hgt, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function healthColor(hp) {
  if (hp < 0.1) return 0x9a9a9a;
  if (hp < 0.4) return 0xe07a5f;
  if (hp < 0.7) return 0xe6b34a;
  return 0x5bb85b;
}
