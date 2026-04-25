#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const AGGREGATE_DIR = path.join(__dirname, '../data/aggregate');
const CHARTS_DIR    = path.join(__dirname, '../charts');

fs.mkdirSync(CHARTS_DIR, { recursive: true });

// ── data loading ──────────────────────────────────────────────────────────────

function readAggregate(name) {
  const file = path.join(AGGREGATE_DIR, name);
  if (!fs.existsSync(file)) { console.warn(`Missing: ${file}`); return null; }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ── design tokens ─────────────────────────────────────────────────────────────

const T = {
  bg:      '#161b22',
  border:  '#30363d',
  radius:  8,
  title:   '#e6edf3',
  label:   '#8b949e',
  grid:    '#21262d',
  axis:    '#30363d',
  views:   '#58a6ff',
  uniques: '#3fb950',
};

const css = `
  .lbl { font: 11px sans-serif; fill: ${T.label}; }
  .ttl { font: bold 13px sans-serif; fill: ${T.title}; }
  .grid { stroke: ${T.grid}; stroke-width: 1; }
  .axis { stroke: ${T.axis}; stroke-width: 1; fill: none; }
  .lv  { fill: none; stroke: ${T.views};   stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .lu  { fill: none; stroke: ${T.uniques}; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 4 2; }
`;

function box(width, height) {
  return `<rect width="${width}" height="${height}" rx="${T.radius}" ry="${T.radius}" fill="${T.bg}" stroke="${T.border}" stroke-width="1"/>`;
}

function svgWrap(width, height, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style>${css}</style>
${box(width, height)}
${content}
</svg>`;
}

// ── shared helpers ────────────────────────────────────────────────────────────

function yTicks(maxVal, pad, W, H) {
  return [0, 0.25, 0.5, 0.75, 1].map(t => {
    const v = Math.round(maxVal * t);
    const y = pad.top + H - t * H;
    return `<line x1="${pad.left}" y1="${y}" x2="${pad.left + W}" y2="${y}" class="grid"/>
<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" class="lbl">${v}</text>`;
  }).join('\n');
}

// ── line chart ────────────────────────────────────────────────────────────────

function lineChart(daily, { width = 800, height = 300, title = '' } = {}) {
  const pad = { top: 44, right: 30, bottom: 50, left: 55 };
  const W   = width  - pad.left - pad.right;
  const H   = height - pad.top  - pad.bottom;
  const n   = daily.length;
  const maxV = Math.max(...daily.map(d => d.count), 1);

  const x   = i => pad.left + (n > 1 ? i / (n - 1) : 0.5) * W;
  const y   = v => pad.top  + H - (v / maxV) * H;
  const pts = k => daily.map((d, i) => `${x(i)},${y(d[k])}`).join(' ');

  const step   = n > 10 ? 2 : 1;
  const xLabels = daily
    .map((d, i) => i % step === 0
      ? `<text x="${x(i)}" y="${pad.top + H + 18}" text-anchor="middle" class="lbl">${d.date.slice(5)}</text>`
      : '')
    .join('');

  const dots = daily.map((d, i) => `
<circle cx="${x(i)}" cy="${y(d.count)}"   r="3" fill="${T.views}"/>
<circle cx="${x(i)}" cy="${y(d.uniques)}" r="3" fill="${T.uniques}"/>`).join('');

  const ly = height - 12;

  const inner = `
<text x="${width / 2}" y="26" text-anchor="middle" class="ttl">${title}</text>
${yTicks(maxV, pad, W, H)}
<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + H}" class="axis"/>
<line x1="${pad.left}" y1="${pad.top + H}" x2="${pad.left + W}" y2="${pad.top + H}" class="axis"/>
<polyline points="${pts('count')}"   class="lv"/>
<polyline points="${pts('uniques')}" class="lu"/>
${dots}
${xLabels}
<line x1="${pad.left}" y1="${ly}" x2="${pad.left + 16}" y2="${ly}" class="lv"/>
<text x="${pad.left + 20}" y="${ly + 4}" class="lbl">Views</text>
<line x1="${pad.left + 72}" y1="${ly}" x2="${pad.left + 88}" y2="${ly}" class="lu"/>
<text x="${pad.left + 92}" y="${ly + 4}" class="lbl">Unique visitors</text>`;

  return svgWrap(width, height, inner);
}

// ── bar chart ─────────────────────────────────────────────────────────────────

function barChart(repos, { width = 800, title = '' } = {}) {
  const BAR_H = 22;
  const GAP   = 6;
  const pad   = { top: 44, right: 60, bottom: 36, left: 160 };
  const W     = width - pad.left - pad.right;
  const height = pad.top + repos.length * (BAR_H + GAP) + pad.bottom;

  if (repos.length === 0) return svgWrap(width, 80,
    `<text x="${width / 2}" y="44" text-anchor="middle" class="lbl">No data</text>`);

  const maxV = Math.max(...repos.map(d => d.count), 1);
  const xw   = v => (v / maxV) * W;
  const yp   = i => pad.top + i * (BAR_H + GAP);

  const bars = repos.map((d, i) => `
<rect x="${pad.left}" y="${yp(i)}" width="${xw(d.count)}" height="${BAR_H}" fill="${T.views}" rx="3"/>
<rect x="${pad.left}" y="${yp(i)}" width="${xw(d.uniques)}" height="${BAR_H / 3}" fill="${T.uniques}" rx="2" opacity="0.85"/>
<text x="${pad.left - 8}" y="${yp(i) + BAR_H / 2 + 4}" text-anchor="end" class="lbl">${d.repo}</text>
<text x="${pad.left + xw(d.count) + 6}" y="${yp(i) + BAR_H / 2 + 4}" class="lbl">${d.count}</text>`).join('');

  const ly = height - 12;

  const inner = `
<text x="${width / 2}" y="26" text-anchor="middle" class="ttl">${title}</text>
${bars}
<rect x="${pad.left}" y="${ly - 8}" width="12" height="8" fill="${T.views}"   rx="1"/>
<text x="${pad.left + 16}" y="${ly}" class="lbl">Views</text>
<rect x="${pad.left + 66}" y="${ly - 8}" width="12" height="8" fill="${T.uniques}" rx="1" opacity="0.85"/>
<text x="${pad.left + 82}" y="${ly}" class="lbl">Unique visitors</text>`;

  return svgWrap(width, height, inner);
}

// ── main ──────────────────────────────────────────────────────────────────────

const dailyData  = readAggregate('daily-views.json');
const topRepoData = readAggregate('top-repos.json');

if (dailyData) {
  fs.writeFileSync(
    path.join(CHARTS_DIR, 'daily-traffic.svg'),
    lineChart(dailyData.days, { title: 'Total Daily Traffic (all repos)' })
  );
  console.log('Generated: .github/charts/daily-traffic.svg');
}

if (topRepoData) {
  fs.writeFileSync(
    path.join(CHARTS_DIR, 'top-repos.svg'),
    barChart(topRepoData.repos.slice(0, 10), { title: 'Top 10 Repos by Total Views' })
  );
  console.log('Generated: .github/charts/top-repos.svg');
}
