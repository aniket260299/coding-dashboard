// Checks the invariant the UI relies on: positions must be numbered 1..n
// *inside* each parent (topics per sheet, problems per topic), never globally.
// Also verifies the v2 format gate: nested files load, flat legacy files are
// rejected, and normalizeData is idempotent on its own output.
//
//   node scripts/check-positions.mjs [path-to-data-file]

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertV2Format, normalizeData } from '../src/data/normalize.js';
import { toV2 } from '../src/data/serialize.js';

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

// --- synthetic nested cases -------------------------------------------------

const expectGroups = (label, data, key, expected) => {
  const actual = positionsOf(normalizeData(data).topics, key);
  const rendered = actual.map(([group, values]) => `${group}:[${values.join(',')}]`).join(' ');
  const wanted = expected.map(([group, values]) => `${group}:[${values.join(',')}]`).join(' ');
  if (rendered !== wanted) fail(`${label}\n      got      ${rendered}\n      expected ${wanted}`);
};

// numbering that leaks across sheets (3,4 under sheet 2 instead of restarting)
expectGroups(
  'nested topics numbered across sheets are renumbered per sheet',
  {
    version: 2,
    sheets: [
      {
        id: 1,
        position: 1,
        topics: [
          { id: 1, position: 1, topic: 'a' },
          { id: 2, position: 2, topic: 'b' },
        ],
      },
      {
        id: 2,
        position: 2,
        topics: [
          { id: 3, position: 3, topic: 'c' },
          { id: 4, position: 4, topic: 'd' },
        ],
      },
    ],
  },
  'sheetId',
  [
    ['1', [1, 2]],
    ['2', [1, 2]],
  ],
);

// positions missing entirely
expectGroups(
  'nested topics without positions get 1..n per sheet',
  {
    version: 2,
    sheets: [
      { id: 1, position: 1, topics: [{ id: 1, topic: 'a' }, { id: 2, topic: 'b' }] },
      { id: 2, position: 2, topics: [{ id: 3, topic: 'c' }] },
    ],
  },
  'sheetId',
  [
    ['1', [1, 2]],
    ['2', [1]],
  ],
);

// duplicate positions inside one sheet must not push rows out of the group
expectGroups(
  'nested topics with duplicate positions are renumbered in file order',
  {
    version: 2,
    sheets: [
      {
        id: 1,
        position: 1,
        topics: [
          { id: 1, position: 1, topic: 'a' },
          { id: 2, position: 1, topic: 'b' },
          { id: 3, position: 1, topic: 'c' },
        ],
      },
    ],
  },
  'sheetId',
  [['1', [1, 2, 3]]],
);

const problemGroups = (data) =>
  positionsOf(normalizeData(data).problems, 'topicId')
    .map(([group, values]) => `${group}:[${values.join(',')}]`)
    .join(' ');

const nestedProblems = {
  version: 2,
  sheets: [
    {
      id: 1,
      position: 1,
      topics: [
        {
          id: 1,
          position: 1,
          problems: [{ position: 3 }, { position: 4 }],
        },
        { id: 2, position: 2, problems: [{ position: 1 }] },
      ],
    },
  ],
};
const renderedProblems = problemGroups(nestedProblems);
if (renderedProblems !== '1:[1,2] 2:[1]') {
  fail(
    `problems numbered across topics are renumbered per topic\n      got      ${renderedProblems}\n      expected 1:[1,2] 2:[1]`,
  );
}

// --- format gate ------------------------------------------------------------

try {
  assertV2Format({ version: 2, sheets: [{ id: 1, topics: [] }] });
} catch (error) {
  fail(`a nested v2 document was rejected: ${error.message}`);
}

try {
  assertV2Format({
    sheets: [{ id: 1, position: 1 }],
    topics: [{ id: 1, sheetId: 1 }],
    problems: [],
  });
  fail('the old flat format was accepted - it must be rejected');
} catch (error) {
  if (!/old flat format/.test(error.message)) {
    fail(`flat format rejected with the wrong message: ${error.message}`);
  }
}

try {
  assertV2Format({ version: 3, sheets: [] });
  fail('an unknown version was accepted - it must be rejected');
} catch (error) {
  if (!/unsupported data version/.test(error.message)) {
    fail(`unknown version rejected with the wrong message: ${error.message}`);
  }
}

// --- the real data files ----------------------------------------------------

const SAMPLE = fileURLToPath(new URL('../src/data/sample-data.json', import.meta.url));
const requested = process.argv.slice(2);
const files = (requested.length ? requested : [SAMPLE]).filter((candidate) => fs.existsSync(candidate));

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
  try {
    assertV2Format(raw);
  } catch (error) {
    fail(`[${file}] format rejected: ${error.message}`);
    continue;
  }
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

  // The save path must round-trip: serialized v2 re-normalizes to the same data.
  const roundTripped = normalizeData(structuredClone(toV2(normalized)));
  if (JSON.stringify(roundTripped) !== JSON.stringify(normalized)) {
    fail(`[${file}] toV2 -> normalizeData does not round-trip`);
  }

  if (failures.length === failuresBefore) {
    console.log(
      `OK ${file}: ${normalized.sheets.length} sheets, ${normalized.topics.length} topics, ${normalized.problems.length} problems - positions are 1..n per sheet / per topic, round-trip stable`,
    );
  }
}

if (failures.length) {
  console.error(`FAIL ${failures.length} check(s)`);
  for (const message of failures) console.error('  - ' + message);
  process.exit(1);
}
