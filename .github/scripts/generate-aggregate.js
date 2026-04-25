#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const REPOS_DIR     = path.join(__dirname, '../data/repos');
const AGGREGATE_DIR = path.join(__dirname, '../data/aggregate');

fs.mkdirSync(AGGREGATE_DIR, { recursive: true });

// ── helpers ───────────────────────────────────────────────────────────────────

function latestFile(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  if (!files.length) return null;
  try { return JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8')); }
  catch (_) { return null; }
}

function allFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (_) { return null; } })
    .filter(Boolean);
}

// ── load repos ────────────────────────────────────────────────────────────────

function loadRepos() {
  const repos = [];
  if (!fs.existsSync(REPOS_DIR)) return repos;
  for (const letter of fs.readdirSync(REPOS_DIR)) {
    const letterDir = path.join(REPOS_DIR, letter);
    if (!fs.statSync(letterDir).isDirectory()) continue;
    for (const repo of fs.readdirSync(letterDir)) {
      const base = path.join(letterDir, repo);

      // Use latest referrers file as source of truth for the table (matches original script).
      // Referrers show traffic from known sources — more meaningful than raw views.
      const info      = latestFile(path.join(base, 'info'))      || { stars: 0, forks: 0, watchers: 0, open_issues: 0, default_branch: 'main', language: null };
      const referrers = latestFile(path.join(base, 'referrers'));

      let views = 0, uniques = 0, sources = 0;
      if (Array.isArray(referrers) && referrers.length > 0) {
        for (const r of referrers) {
          views   += r.count   || 0;
          uniques += r.uniques || 0;
        }
        sources = referrers.length;
      }

      repos.push({
        repo,
        uniques,
        views,
        sources,
        stars:          info.stars          || 0,
        forks:          info.forks          || 0,
        watchers:       info.watchers       || 0,
        open_issues:    info.open_issues    || 0,
        language:       info.language       || null,
        default_branch: info.default_branch || 'main',
      });
    }
  }
  return repos;
}

// ── aggregations ─────────────────────────────────────────────────────────────

function buildDailyViews() {
  const byDate = {};
  if (!fs.existsSync(REPOS_DIR)) return { generated_at: '', days: [] };
  for (const letter of fs.readdirSync(REPOS_DIR)) {
    const letterDir = path.join(REPOS_DIR, letter);
    if (!fs.statSync(letterDir).isDirectory()) continue;
    for (const repo of fs.readdirSync(letterDir)) {
      for (const t of allFiles(path.join(letterDir, repo, 'traffic')).filter(t => t)) {
        for (const v of (t.views || [])) {
          const date = v.timestamp.slice(0, 10);
          if (!byDate[date]) byDate[date] = { count: 0, uniques: 0 };
          byDate[date].count   += v.count;
          byDate[date].uniques += v.uniques;
        }
      }
    }
  }
  return {
    generated_at: new Date().toISOString().slice(0, 10),
    days: Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
  };
}

function buildRanking(repos) {
  // load previous ranking for trend comparison
  const prevFile = path.join(AGGREGATE_DIR, 'ranking.json');
  const prevRanks = {};
  if (fs.existsSync(prevFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(prevFile, 'utf8'));
      for (const r of (prev.repos || [])) prevRanks[r.repo] = r.rank;
    } catch (_) {}
  }

  const sorted = [...repos].sort((a, b) =>
    b.uniques - a.uniques || b.views - a.views ||
    b.sources - a.sources || b.stars - a.stars ||
    a.repo.localeCompare(b.repo)
  );

  let owner = process.env.GITHUB_REPOSITORY_OWNER || '';
  if (!owner) {
    try {
      const { execSync } = require('child_process');
      const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
      const match  = remote.match(/github\.com[/:]([^/]+)\//);
      if (match) owner = match[1];
    } catch (_) {}
  }

  return {
    generated_at: new Date().toISOString().slice(0, 10),
    owner,
    repos: sorted.map((r, i) => {
      const rank    = i + 1;
      const prevRank = prevRanks[r.repo];
      const hasActivity = r.uniques + r.views + r.sources > 0;
      let trend = '';
      if (hasActivity && prevRank != null) {
        if (rank < prevRank) trend = '🟩';
        else if (rank > prevRank) trend = '🟥';
      }
      const warning = r.default_branch !== 'main' ? r.default_branch : '';
      return { rank, repo: r.repo, uniques: r.uniques, views: r.views, sources: r.sources, stars: r.stars, trend, warning };
    }),
  };
}

function buildTopRepos(repos, n = 20) {
  return {
    generated_at: new Date().toISOString().slice(0, 10),
    repos: [...repos]
      .sort((a, b) => b.views - a.views || b.uniques - a.uniques)
      .slice(0, n)
      .map(({ repo, views, uniques }) => ({ repo, count: views, uniques })),
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

const repos = loadRepos();
console.log(`Loaded ${repos.length} repos from ${REPOS_DIR}`);

const daily    = buildDailyViews();
const ranking  = buildRanking(repos);
const topRepos = buildTopRepos(repos);

fs.writeFileSync(path.join(AGGREGATE_DIR, 'daily-views.json'), JSON.stringify(daily,    null, 2));
fs.writeFileSync(path.join(AGGREGATE_DIR, 'ranking.json'),     JSON.stringify(ranking,  null, 2));
fs.writeFileSync(path.join(AGGREGATE_DIR, 'top-repos.json'),   JSON.stringify(topRepos, null, 2));

console.log(`Generated: data/aggregate/daily-views.json  (${daily.days.length} days)`);
console.log(`Generated: data/aggregate/ranking.json      (${ranking.repos.length} repos)`);
console.log(`Generated: data/aggregate/top-repos.json    (${topRepos.repos.length} repos)`);
