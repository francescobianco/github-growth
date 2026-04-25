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

// ── svg helpers ───────────────────────────────────────────────────────────────

const COLORS = { views: '#0969da', uniques: '#1a7f37', grid: '#eaecef', axis: '#d0d7de' };

const css = `
  .lbl  { font: 11px sans-serif; fill: #57606a; }
  .ttl  { font: bold 13px sans-serif; fill: #24292f; }
  .grid { stroke: ${COLORS.grid}; stroke-width: 1; }
  .axis { stroke: ${COLORS.axis}; stroke-width: 1; fill: none; }
  .lv   { fill: none; stroke: ${COLORS.views};   stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .lu   { fill: none; stroke: ${COLORS.uniques}; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 4 2; }
`;

function yTicks(maxVal, pad, H) {
  return [0, 0.25, 0.5, 0.75, 1].map(t => {
    const v = Math.round(maxVal * t);
    const y = pad.top + H - t * H;
    return `<line x1="${pad.left}" y1="${y}" x2="${pad.left + (800 - pad.left - pad.right)}" y2="${y}" class="grid"/>
    <text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" class="lbl">${v}</text>`;
  }).join('\n');
}

// ── line chart ────────────────────────────────────────────────────────────────

function lineChart(daily, { width = 800, height = 300, title = '' } = {}) {
  const pad = { top: 40, right: 30, bottom: 50, left: 55 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const n = daily.length;
  const maxV = Math.max(...daily.map(d => d.count), 1);

  const x = i  => pad.left + (n > 1 ? i / (n - 1) : 0.5) * W;
  const y = v  => pad.top + H - (v / maxV) * H;
  const pts = k => daily.map((d, i) => `${x(i)},${y(d[k])}`).join(' ');

  const step = n > 10 ? 2 : 1;
  const xLabels = daily
    .map((d, i) => i % step === 0
      ? `<text x="${x(i)}" y="${pad.top + H + 18}" text-anchor="middle" class="lbl">${d.date.slice(5)}</text>`
      : '')
    .join('');

  const dots = daily.map((d, i) => `
    <circle cx="${x(i)}" cy="${y(d.count)}"   r="3" fill="${COLORS.views}"/>
    <circle cx="${x(i)}" cy="${y(d.uniques)}" r="3" fill="${COLORS.uniques}"/>`).join('');

  const legendY = height - 10;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style>${css}</style>
<text x="${width / 2}" y="22" text-anchor="middle" class="ttl">${title}</text>
${yTicks(maxV, pad, H)}
<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + H}" class="axis"/>
<line x1="${pad.left}" y1="${pad.top + H}" x2="${pad.left + W}" y2="${pad.top + H}" class="axis"/>
<polyline points="${pts('count')}"   class="lv"/>
<polyline points="${pts('uniques')}" class="lu"/>
${dots}
${xLabels}
<line x1="${pad.left}" y1="${legendY}" x2="${pad.left + 16}" y2="${legendY}" class="lv"/>
<text x="${pad.left + 20}" y="${legendY + 4}" class="lbl">Views</text>
<line x1="${pad.left + 70}" y1="${legendY}" x2="${pad.left + 86}" y2="${legendY}" class="lu"/>
<text x="${pad.left + 90}" y="${legendY + 4}" class="lbl">Unique visitors</text>
</svg>`;
}

// ── bar chart ─────────────────────────────────────────────────────────────────

function barChart(repos, { width = 800, title = '' } = {}) {
  if (repos.length === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="60"><text x="50%" y="35" text-anchor="middle" class="lbl">No data</text></svg>`;

  const BAR_H = 22;
  const GAP   = 6;
  const pad   = { top: 40, right: 50, bottom: 36, left: 160 };
  const W     = width - pad.left - pad.right;
  const height = pad.top + repos.length * (BAR_H + GAP) + pad.bottom;

  const maxV = Math.max(...repos.map(d => d.count), 1);
  const xw   = v => (v / maxV) * W;
  const yp   = i => pad.top + i * (BAR_H + GAP);

  const bars = repos.map((d, i) => `
<rect x="${pad.left}" y="${yp(i)}" width="${xw(d.count)}" height="${BAR_H}" fill="${COLORS.views}" rx="3"/>
<rect x="${pad.left}" y="${yp(i)}" width="${xw(d.uniques)}" height="${BAR_H / 3}" fill="${COLORS.uniques}" rx="2" opacity="0.85"/>
<text x="${pad.left - 6}" y="${yp(i) + BAR_H / 2 + 4}" text-anchor="end" class="lbl">${d.repo}</text>
<text x="${pad.left + xw(d.count) + 5}" y="${yp(i) + BAR_H / 2 + 4}" class="lbl">${d.count}</text>`).join('');

  const ly = height - 12;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style>${css}</style>
<text x="${width / 2}" y="22" text-anchor="middle" class="ttl">${title}</text>
${bars}
<rect x="${pad.left}" y="${ly - 8}" width="12" height="8" fill="${COLORS.views}" rx="1"/>
<text x="${pad.left + 16}" y="${ly}" class="lbl">Views</text>
<rect x="${pad.left + 65}" y="${ly - 8}" width="12" height="8" fill="${COLORS.uniques}" rx="1" opacity="0.85"/>
<text x="${pad.left + 81}" y="${ly}" class="lbl">Unique visitors</text>
</svg>`;
}

// ── main ──────────────────────────────────────────────────────────────────────

const dailyData   = readAggregate('daily-views.json');
const topReosData = readAggregate('top-repos.json');

if (dailyData) {
  fs.writeFileSync(
    path.join(CHARTS_DIR, 'daily-traffic.svg'),
    lineChart(dailyData.days, { title: 'Total Daily Traffic (all repos)' })
  );
  console.log('Generated: .github/charts/daily-traffic.svg');
}

if (topReosData) {
  fs.writeFileSync(
    path.join(CHARTS_DIR, 'top-repos.svg'),
    barChart(topReosData.repos.slice(0, 10), { title: 'Top 10 Repos by Total Views' })
  );
  console.log('Generated: .github/charts/top-repos.svg');
}