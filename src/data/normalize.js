// Turns whatever is in the loaded data file into the shape the UI expects:
// { sheets: [...], topics: [...], problems: [...] } with numeric ids/positions
// and typed fields. Nothing is dropped - orphaned rows are kept as-is.

export const asNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const asText = (value) => (value == null ? '' : String(value));

export function nextId(list) {
  return list.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function assignIds(list) {
  const used = new Set();
  let max = 0;
  list.forEach((item) => {
    const id = Number(item.id);
    if (Number.isInteger(id) && id > 0 && !used.has(id)) {
      item.id = id;
      used.add(id);
      max = Math.max(max, id);
    } else {
      item.id = null;
    }
  });
  let next = max + 1;
  list.forEach((item) => {
    if (item.id == null) {
      while (used.has(next)) next += 1;
      item.id = next;
      used.add(next);
      next += 1;
    }
  });
}

// Positions are relative to the parent: topics restart at 1 inside every sheet
// and problems restart at 1 inside every topic. They are never unique across
// the whole list, so each group is sorted by its current position (ties keep
// the file order) and renumbered 1..n on its own.
function assignPositions(list, groupKey) {
  const groups = new Map();
  list.forEach((item) => {
    const key = groupKey ? item[groupKey] : null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  groups.forEach((group) => {
    const ordered = group
      .map((item, index) => ({ item, index, position: asNumber(item.position) }))
      .sort((a, b) => a.position - b.position || a.index - b.index);
    ordered.forEach(({ item }, index) => {
      item.position = index + 1;
    });
  });
}

const pick = (source, keys) => {
  const target = {};
  keys.forEach((key) => {
    target[key] = source[key];
  });
  return target;
};

export function normalizeData(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('the file must contain a JSON object like {"sheets":[],"topics":[],"problems":[]}');
  }

  const sheets = (Array.isArray(raw.sheets) ? raw.sheets : [])
    .map((sheet) => pick(sheet || {}, ['id', 'position', 'sheet', 'username']))
    .map((sheet) => ({
      ...sheet,
      sheet: asText(sheet.sheet),
      username: asText(sheet.username),
    }));

  const topics = (Array.isArray(raw.topics) ? raw.topics : [])
    .map((topic) => pick(topic || {}, ['id', 'position', 'topic', 'sheetId']))
    .map((topic) => ({
      ...topic,
      topic: asText(topic.topic),
      sheetId: asNumber(topic.sheetId),
    }));

  const problems = (Array.isArray(raw.problems) ? raw.problems : [])
    .map((problem) => pick(problem || {}, ['id', 'position', 'title', 'difficulty', 'link', 'hint', 'notes', 'solution', 'topicId']))
    .map((problem) => ({
      ...problem,
      title: asText(problem.title),
      difficulty: asNumber(problem.difficulty),
      link: asText(problem.link),
      hint: asText(problem.hint),
      notes: asText(problem.notes),
      solution: asText(problem.solution),
      topicId: asNumber(problem.topicId),
    }));

  if (sheets.length === 0 && topics.length === 0 && problems.length === 0) {
    throw new Error('no sheets, topics or problems were found in the file');
  }

  assignIds(sheets);
  assignIds(topics);
  assignIds(problems);
  assignPositions(sheets);
  assignPositions(topics, 'sheetId');
  assignPositions(problems, 'topicId');

  return { sheets, topics, problems };
}
