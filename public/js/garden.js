// Renders a student's garden: a soil grid of plots with growing/wilting plants,
// plus unlocked decorations. Health, growth stage and condition come computed
// from the server.
import { h, clear } from './util.js';

const STAGE_SCALE = { seed: 0.5, sprout: 0.65, seedling: 0.8, bud: 0.9, bloom: 1.0, flourishing: 1.15 };

export function renderGarden(container, garden, opts = {}) {
  const { interactive = false, onPlotClick = null, plots = 12 } = opts;
  clear(container);
  const scene = h('div.garden-scene');

  // Decorations float along the top of the scene.
  if (garden.decorations?.length) {
    scene.appendChild(h('div.garden-deco-bar',
      garden.decorations.map((d) => h('span', { title: d.name }, d.emoji))));
  }

  const grid = h('div.plot-grid');
  const byPlot = new Map(garden.plants.map((p) => [p.plot, p]));
  const total = Math.max(plots, garden.plants.length, 6);

  for (let i = 0; i < total; i++) {
    const plant = byPlot.get(i);
    grid.appendChild(plant
      ? plantPlot(plant, interactive, onPlotClick)
      : emptyPlot(i, interactive, onPlotClick));
  }
  scene.appendChild(grid);
  container.appendChild(scene);
}

function plantPlot(plant, interactive, onPlotClick) {
  const st = plant.state;
  const scale = STAGE_SCALE[st.stage] || 1;
  const emoji = st.condition === 'dead' ? '🥀' : (st.stageIndex <= 0 ? '🌱' : plant.emoji);

  const el = h('div.plot', {
    title: `${plant.term} — ${plant.speciesName}\n${st.condition}, ${Math.round(st.health * 100)}% health`,
    onclick: interactive && onPlotClick ? () => onPlotClick(plant) : null,
  }, [
    h('div.health-bar', [h('i', { style: { width: Math.round(st.health * 100) + '%',
      background: healthColor(st.health) } })]),
    h(`span.plant-emoji.${st.condition}`, { style: { transform: `scale(${scale})` } }, emoji),
    h('div.label', plant.term),
    h('div.stage-dots', Array.from({ length: 5 }, (_, i) =>
      h(`i${i < st.stageIndex ? '.on' : ''}`))),
    st.condition === 'thirsty' ? h('span.water-drop', '💧') : null,
  ]);
  return el;
}

function emptyPlot(i, interactive, onPlotClick) {
  return h('div.plot.empty', {
    title: 'Empty plot — practice a word to plant here',
    onclick: interactive && onPlotClick ? () => onPlotClick(null, i) : null,
  });
}

function healthColor(h) {
  if (h < 0.1) return '#9a9a9a';
  if (h < 0.4) return '#e07a5f';
  if (h < 0.7) return '#e6b34a';
  return '#5bb85b';
}
