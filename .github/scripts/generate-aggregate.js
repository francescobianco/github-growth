#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const REPOS_DIR     = path.join(__dirname, '../data/repos');
const AGGREGATE_DIR = path.join(__dirname, '../data/aggregate');

fs.mkdirSync(AGGREGATE_DIR, { recursive: true });

// ── load all per-repo traffic files ──────────────────────────────────────────

function readAllTrafficData() {
  const data = [];
  if (!fs.existsSync(REPOS_DIR)) return data;
  for (const letter of fs.readdirSync(REPOS_DIR)) {
    const letterDir = path.join(REPOS_DIR, letter);
    if (!fs.statSync(letterDir).isDirectory()) continue;
    for (const repo of fs.readdirSync(letterDir)) {
      const trafficDir = path.join(letterDir, repo, 'traffic');
      if (!fs.existsSync(trafficDir)) continue;
      for (const file of fs.readdirSync(trafficDir)) {
        if (!file.endsWith('.json')) continue;
        try {
          data.push(JSON.parse(fs.readFileSync(path.join(trafficDir, file), 'utf8')));
        } catch (_) {}
      }
    }
  }
  return data;
}

// ── aggregations ─────────────────────────────────────────────────────────────

function buildDailyViews(allData) {
  const byDate = {};
  for (const d of allData) {
    for (const v of (d.views || [])) {
      const date = v.timestamp.slice(0, 10);
      if (!byDate[date]) byDate[date] = { count: 0, uniques: 0 };
      byDate[date].count   += v.count;
      byDate[date].uniques += v.uniques;
    }
  }
  return {
    generated_at: new Date().toISOString().slice(0, 10),
    days: Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
  };
}

function buildTopRepos(allData, n = 20) {
  const byRepo = {};
  for (const d of allData) {
    if (!byRepo[d.repo]) byRepo[d.repo] = { count: 0, uniques: 0 };
    byRepo[d.repo].count   += d.count   || 0;
    byRepo[d.repo].uniques += d.uniques || 0;
  }
  return {
    generated_at: new Date().toISOString().slice(0, 10),
    repos: Object.entries(byRepo)
      .map(([repo, v]) => ({ repo, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n),
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

const allData = readAllTrafficData();
console.log(`Loaded ${allData.length} traffic files from ${REPOS_DIR}`);

const daily   = buildDailyViews(allData);
const topRepos = buildTopRepos(allData);

fs.writeFileSync(path.join(AGGREGATE_DIR, 'daily-views.json'),  JSON.stringify(daily,    null, 2));
fs.writeFileSync(path.join(AGGREGATE_DIR, 'top-repos.json'),    JSON.stringify(topRepos, null, 2));

console.log(`Generated: data/aggregate/daily-views.json  (${daily.days.length} days)`);
console.log(`Generated: data/aggregate/top-repos.json    (${topRepos.repos.length} repos)`);
