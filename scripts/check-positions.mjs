// Checks the invariant the UI relies on: positions must be numbered 1..n
// *inside* each parent (topics per sheet, problems per topic), never globally.
//
//   node scripts/check-positions.mjs [path-to-data-file]

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeData } from '../src/data/normalize.js';

const failures = [];
const fail = (message) => failures.push(message);

const groupBy = (rows, key) => {
  const groups = new Map();
  for (const row of rows) {
    const group = String(row[key]);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(row);
  }
  return groups;
};

const positionsOf = (rows, key) =>
  [...groupBy(rows, key).entries()].map(([group, items]) => [
    group,
    items.map((item) => item.position).sort((a, b) => a - b),
  ]);

// --- synthetic cases --------------------------------------------------------

const expectGroups = (label, data, key, expected) => {
  const actual = positionsOf(normalizeData(data).topics, key);
  const rendered = actual.map(([group, values]) => `${group}:[${values.join(',')}]`).join(' ');
  const wanted = expected.map(([group, values]) => `${group}:[${values.join(',')}]`).join(' ');
  if (rendered !== wanted) fail(`${label}\n      got      ${rendered}\n      expected ${wanted}`);
};

// legacy data numbered across sheets instead of inside them
expectGroups(
  'topics keep the global numbering 1,2 / 3,4',
  {
    sheets: [{ id: 1, position: 1 }, { id: 2, position: 2 }],
    topics: [
      { id: 1, position: 1, topic: 'a', sheetId: 1 },
      { id: 2, position: 2, topic: 'b', sheetId: 1 },
      { id: 3, position: 3, topic: 'c', sheetId: 2 },
      { id: 4, position: 4, topic: 'd', sheetId: 2 },
    ],
    problems: [],
  },
  'sheetId',
  [
    ['1', [1, 2]],
    ['2', [1, 2]],
  ],
);

// positions missing entirely
expectGroups(
  'topics without positions get 1..n per sheet',
  {
    sheets: [{ id: 1, position: 1 }, { id: 2, position: 2 }],
    topics: [
      { id: 1, topic: 'a', sheetId: 1 },
      { id: 2, topic: 'b', sheetId: 1 },
      { id: 3, topic: 'c', sheetId: 2 },
    ],
    problems: [],
  },
  'sheetId',
  [
    ['1', [1, 2]],
    ['2', [1]],
  ],
);

// duplicate positions inside one sheet must not push rows out of the group
expectGroups(
  'topics with duplicate positions are renumbered in file order',
  {
    sheets: [{ id: 1, position: 1 }],
    topics: [
      { id: 1, position: 1, topic: 'a', sheetId: 1 },
      { id: 2, position: 1, topic: 'b', sheetId: 1 },
      { id: 3, position: 1, topic: 'c', sheetId: 1 },
    ],
    problems: [],
  },
  'sheetId',
  [['1', [1, 2, 3]]],
);

const problemGroups = (data) =>
  positionsOf(normalizeData(data).problems, 'topicId').map(
    ([group, values]) => `${group}:[${values.join(',')}]`,
  ).join(' ');

const legacyProblems = {
  sheets: [{ id: 1, position: 1 }],
  topics: [
    { id: 1, position: 1, topic: 'a', sheetId: 1 },
    { id: 2, position: 2, topic: 'b', sheetId: 1 },
  ],
  problems: [
    { id: 1, position: 1, topicId: 1 },
    { id: 2, position: 2, topicId: 1 },
    { id: 3, position: 3, topicId: 2 },
    { id: 4, position: 4, topicId: 2 },
  ],
};
const renderedProblems = problemGroups(legacyProblems);
if (renderedProblems !== '1:[1,2] 2:[1,2]') {
  fail(`problems keep the global numbering 1,2 / 3,4\n      got      ${renderedProblems}\n      expected 1:[1,2] 2:[1,2]`);
}

// --- the real data files ----------------------------------------------------

const BACKEND_EXPORT = fileURLToPath(
  new URL('../../coding-dashboard-backend/src/main/resources/coding_dashboard_export.txt', import.meta.url),
);
const SAMPLE = fileURLToPath(new URL('../src/data/sample-data.txt', import.meta.url));
const requested = process.argv.slice(2);
const files = (requested.length ? requested : [SAMPLE, BACKEND_EXPORT])
  .filter((candidate) => fs.existsSync(candidate));

if (!files.length) {
  console.error('FAIL no data file to check');
  process.exit(1);
}

const orderedIds = (rows, key) =>
  [...groupBy(rows, key).values()]
    .map((items) =>
      items
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((item) => item.id)
        .join('>'),
    )
    .join(' | ');

for (const file of files) {
  const failuresBefore = failures.length;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const normalized = normalizeData(structuredClone(raw));

  for (const [sheet, values] of positionsOf(normalized.topics, 'sheetId')) {
    if (!values.every((value, index) => value === index + 1)) {
      fail(`[${file}] topics of sheet ${sheet} are not 1..n: [${values.join(', ')}]`);
    }
  }
  for (const [topic, values] of positionsOf(normalized.problems, 'topicId')) {
    if (!values.every((value, index) => value === index + 1)) {
      fail(`[${file}] problems of topic ${topic} are not 1..n: [${values.join(', ')}]`);
    }
  }

  // Order inside every group must survive the renumbering.
  const reloaded = normalizeData(structuredClone(normalized));
  if (orderedIds(normalized.topics, 'sheetId') !== orderedIds(reloaded.topics, 'sheetId')) {
    fail(`[${file}] topic order inside a sheet changed during normalization`);
  }
  if (JSON.stringify(reloaded) !== JSON.stringify(normalized)) {
    fail(`[${file}] normalizeData is not idempotent`);
  }

  if (failures.length === failuresBefore) {
    console.log(
      `OK ${file}: ${normalized.sheets.length} sheets, ${normalized.topics.length} topics, ${normalized.problems.length} problems - positions are 1..n per sheet / per topic`,
    );
  }
}

if (failures.length) {
  console.error(`FAIL ${failures.length} check(s)`);
  for (const message of failures) console.error('  - ' + message);
  process.exit(1);
}
