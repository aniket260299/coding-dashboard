// Turns a v2 data document into the shape the UI expects:
// { sheets: [...], topics: [...], problems: [...] } with numeric ids/positions
// and typed fields.
//
// The file format is NESTED - sheets carry their topics, topics carry their
// problems - so grouping, parent links and orphan-proofing come for free. The
// in-memory shape stays FLAT (topics carry sheetId, problems carry topicId)
// so every list, index and route can look rows up directly.
//
// normalizeData() MUTATES its argument. Input is always a freshly parsed or
// freshly cloned object (file text, storage payload, structuredClone in tests),
// and re-allocating a copy of every row is the single biggest load-time cost
// for large datasets - so rows are cleaned in place instead.
//
// The old flat format (top-level topics/problems with sheetId/topicId) is
// still understood here because the app feeds its own persisted state back
// through normalizeData; files are screened by assertV2Format() first.

export const asNumber = (value, fallback = 0) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const asText = (value) => (value == null ? '' : String(value));

// Fields each row type may keep; everything else (including the nested
// "topics"/"problems" child keys, once their rows are flattened) is dropped.
const SHEET_KEYS = new Set(['id', 'position', 'sheet', 'username']);
const TOPIC_KEYS = new Set(['id', 'position', 'topic', 'sheetId']);
const PROBLEM_KEYS = new Set([
  'id',
  'position',
  'title',
  'difficulty',
  'link',
  'hint',
  'notes',
  'solution',
  'topicId',
]);

const isRow = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

function dropUnknown(row, allowed) {
  const keys = Object.keys(row);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!allowed.has(key)) delete row[key];
  }
}

// Validates a file *before* it is parsed into state. New files must be the
// nested v2 document; the old backend export is rejected with a hint instead
// of being silently reinterpreted.
export function assertV2Format(raw) {
  if (!isRow(raw)) {
    throw new Error('the file must contain a JSON object like {"version":2,"sheets":[...]}');
  }
  if (raw.version != null && asNumber(raw.version, NaN) !== 2) {
    throw new Error(`unsupported data version "${raw.version}" - this dashboard reads version 2 files`);
  }
  if (Array.isArray(raw.topics) || Array.isArray(raw.problems)) {
    throw new Error(
      'this is the old flat format - the dashboard now expects the nested format: sheets -> topics -> problems (open the file and move topics under their sheet, problems under their topic)',
    );
  }
  if (!Array.isArray(raw.sheets)) {
    throw new Error('the file needs a "sheets" array ({"version":2,"sheets":[...]})');
  }
}

export function assignIds(list) {
  const used = new Set();
  let max = 0;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const id = Number(item.id);
    if (Number.isInteger(id) && id > 0 && !used.has(id)) {
      item.id = id;
      used.add(id);
      if (id > max) max = id;
    } else {
      item.id = 0;
    }
  }
  let next = max + 1;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item.id === 0) {
      while (used.has(next)) next += 1;
      item.id = next;
      used.add(next);
      if (next > max) max = next;
      next += 1;
    }
  }
  return max;
}

// Positions are relative to the parent: topics restart at 1 inside every sheet
// and problems restart at 1 inside every topic. Rows are sorted by their
// current position (ties keep the file order) and each group is renumbered
// 1..n on its own.
function renumberGroup(list, start, end) {
  const order = new Array(end - start);
  for (let i = start; i < end; i++) order[i - start] = i;
  order.sort((a, b) => list[a].position - list[b].position || a - b);
  for (let rank = 0; rank < order.length; rank++) {
    list[order[rank]].position = rank + 1;
  }
}

// Flat input (persisted app state): group by parent key, renumber per group.
function renumberByParent(list, groupKey) {
  const groups = new Map();
  for (let i = 0; i < list.length; i++) {
    const key = list[i][groupKey];
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(i);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => list[a].position - list[b].position || a - b);
    for (let rank = 0; rank < group.length; rank++) {
      list[group[rank]].position = rank + 1;
    }
  }
}

/** O(1) lookups the UI relies on: by id, grouped by parent, sheets by position. */
export function buildIndexes(sheets, topics, problems) {
  const sheetsById = new Map();
  for (let i = 0; i < sheets.length; i++) sheetsById.set(sheets[i].id, sheets[i]);

  const topicsById = new Map();
  const topicsBySheet = new Map();
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    topicsById.set(topic.id, topic);
    let group = topicsBySheet.get(topic.sheetId);
    if (!group) {
      group = [];
      topicsBySheet.set(topic.sheetId, group);
    }
    group.push(topic);
  }
  for (const group of topicsBySheet.values()) group.sort((a, b) => a.position - b.position);

  const problemsById = new Map();
  const problemsByTopic = new Map();
  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    problemsById.set(problem.id, problem);
    let group = problemsByTopic.get(problem.topicId);
    if (!group) {
      group = [];
      problemsByTopic.set(problem.topicId, group);
    }
    group.push(problem);
  }
  for (const group of problemsByTopic.values()) group.sort((a, b) => a.position - b.position);

  const sortedSheets = sheets.slice().sort((a, b) => a.position - b.position);
  return { sheetsById, topicsById, topicsBySheet, problemsById, problemsByTopic, sortedSheets };
}

export function normalizeData(raw) {
  if (!isRow(raw)) {
    throw new Error('the file must contain a JSON object like {"version":2,"sheets":[...]}');
  }

  const rawSheets = Array.isArray(raw.sheets) ? raw.sheets : [];

  // --- Phase 1: sheets -------------------------------------------------------
  const sheets = new Array(rawSheets.length);
  const sheetChildren = new Array(rawSheets.length);
  for (let i = 0; i < rawSheets.length; i++) {
    const source = isRow(rawSheets[i]) ? rawSheets[i] : {};
    // Capture children before cleaning - "topics" is not a legal row field.
    sheetChildren[i] = Array.isArray(source.topics) ? source.topics : null;
    dropUnknown(source, SHEET_KEYS);
    source.position = asNumber(source.position);
    source.sheet = asText(source.sheet);
    source.username = asText(source.username);
    sheets[i] = source;
  }
  const maxSheetId = assignIds(sheets);
  renumberGroup(sheets, 0, sheets.length); // sheets: one group, 1..n

  // --- Phase 2: topics -------------------------------------------------------
  // Nested input: every sheet contributes a contiguous group of topics, so the
  // per-sheet renumber happens right there - no grouping Map needed.
  const hasNestedTopics = sheetChildren.some((children) => children !== null);
  const topics = [];
  const topicChildren = new Map(); // topic row -> its raw problems (nested input)
  let maxTopicId;

  if (hasNestedTopics) {
    for (let i = 0; i < sheets.length; i++) {
      const children = sheetChildren[i];
      if (!children) continue;
      const start = topics.length;
      const sheetId = sheets[i].id;
      for (let j = 0; j < children.length; j++) {
        const source = isRow(children[j]) ? children[j] : {};
        const problems = Array.isArray(source.problems) ? source.problems : null;
        dropUnknown(source, TOPIC_KEYS); // strips "problems" too
        source.position = asNumber(source.position);
        source.topic = asText(source.topic);
        source.sheetId = sheetId;
        topics.push(source);
        if (problems) topicChildren.set(source, problems);
      }
      renumberGroup(topics, start, topics.length);
    }
    maxTopicId = assignIds(topics);
  } else {
    // Flat input (persisted state): sheetId already on every row.
    const rawTopics = Array.isArray(raw.topics) ? raw.topics : [];
    for (let i = 0; i < rawTopics.length; i++) {
      const source = isRow(rawTopics[i]) ? rawTopics[i] : {};
      dropUnknown(source, TOPIC_KEYS);
      source.position = asNumber(source.position);
      source.topic = asText(source.topic);
      source.sheetId = asNumber(source.sheetId);
      topics.push(source);
    }
    maxTopicId = assignIds(topics);
    renumberByParent(topics, 'sheetId');
  }

  // --- Phase 3: problems -----------------------------------------------------
  const problems = [];
  if (hasNestedTopics) {
    for (let i = 0; i < topics.length; i++) {
      const children = topicChildren.get(topics[i]);
      if (!children) continue;
      const start = problems.length;
      const topicId = topics[i].id;
      for (let j = 0; j < children.length; j++) {
        const source = isRow(children[j]) ? children[j] : {};
        dropUnknown(source, PROBLEM_KEYS);
        source.position = asNumber(source.position);
        source.title = asText(source.title);
        source.difficulty = asNumber(source.difficulty);
        source.link = asText(source.link);
        source.hint = asText(source.hint);
        source.notes = asText(source.notes);
        source.solution = asText(source.solution);
        source.topicId = topicId;
        problems.push(source);
      }
      renumberGroup(problems, start, problems.length);
    }
  } else {
    const rawProblems = Array.isArray(raw.problems) ? raw.problems : [];
    for (let i = 0; i < rawProblems.length; i++) {
      const source = isRow(rawProblems[i]) ? rawProblems[i] : {};
      dropUnknown(source, PROBLEM_KEYS);
      source.position = asNumber(source.position);
      source.title = asText(source.title);
      source.difficulty = asNumber(source.difficulty);
      source.link = asText(source.link);
      source.hint = asText(source.hint);
      source.notes = asText(source.notes);
      source.solution = asText(source.solution);
      source.topicId = asNumber(source.topicId);
      problems.push(source);
    }
    renumberByParent(problems, 'topicId');
  }
  const maxProblemId = assignIds(problems);

  if (!sheets.length && !topics.length && !problems.length) {
    throw new Error('no sheets, topics or problems were found in the file');
  }

  return {
    sheets,
    topics,
    problems,
    indexes: buildIndexes(sheets, topics, problems),
    maxIds: { maxSheetId, maxTopicId, maxProblemId },
  };
}
