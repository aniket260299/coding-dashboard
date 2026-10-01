// Turns whatever is in the loaded data file into the shape the UI expects:
// { sheets: [...], topics: [...], problems: [...] } with numeric ids/positions
// and typed fields. Nothing is dropped - orphaned rows are kept as-is.

export const asNumber = (value, fallback = 0) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const asText = (value) => (value == null ? '' : String(value));

export function nextId(list, maxId) {
  if (maxId != null) return maxId + 1;
  let max = 0;
  for (let i = 0; i < list.length; i++) {
    const id = list[i].id;
    if (typeof id === 'number' && id > max) max = id;
    else {
      const n = Number(id) || 0;
      if (n > max) max = n;
    }
  }
  return max + 1;
}

function assignIds(list) {
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
      next += 1;
    }
  }
}

// Positions are relative to the parent: topics restart at 1 inside every sheet
// and problems restart at 1 inside every topic. They are never unique across
// the whole list, so each group is sorted by its current position (ties keep
// the file order) and renumbered 1..n on its own.
function assignPositions(list, groupKey) {
  if (!groupKey) {
    // Sheets: single group, no Map needed. Stable sort by position.
    const order = new Array(list.length);
    for (let i = 0; i < list.length; i++) order[i] = i;
    order.sort((a, b) => {
      const pa = asNumber(list[a].position);
      const pb = asNumber(list[b].position);
      return pa - pb || a - b;
    });
    for (let rank = 0; rank < order.length; rank++) {
      list[order[rank]].position = rank + 1;
    }
    return;
  }
  const groups = new Map();
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const key = item[groupKey];
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(i);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => asNumber(list[a].position) - asNumber(list[b].position) || a - b);
    for (let rank = 0; rank < group.length; rank++) {
      list[group[rank]].position = rank + 1;
    }
  }
}

export function normalizeData(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('the file must contain a JSON object like {"sheets":[],"topics":[],"problems":[]}');
  }

  const rawSheets = Array.isArray(raw.sheets) ? raw.sheets : [];
  const rawTopics = Array.isArray(raw.topics) ? raw.topics : [];
  const rawProblems = Array.isArray(raw.problems) ? raw.problems : [];

  if (rawSheets.length === 0 && rawTopics.length === 0 && rawProblems.length === 0) {
    throw new Error('no sheets, topics or problems were found in the file');
  }

  // Single pass per list: no intermediate pick/spread objects.
  const sheets = new Array(rawSheets.length);
  for (let i = 0; i < rawSheets.length; i++) {
    const s = rawSheets[i] || {};
    sheets[i] = {
      id: s.id,
      position: s.position,
      sheet: asText(s.sheet),
      username: asText(s.username),
    };
  }

  const topics = new Array(rawTopics.length);
  for (let i = 0; i < rawTopics.length; i++) {
    const t = rawTopics[i] || {};
    topics[i] = {
      id: t.id,
      position: t.position,
      topic: asText(t.topic),
      sheetId: asNumber(t.sheetId),
    };
  }

  const problems = new Array(rawProblems.length);
  for (let i = 0; i < rawProblems.length; i++) {
    const p = rawProblems[i] || {};
    problems[i] = {
      id: p.id,
      position: p.position,
      title: asText(p.title),
      difficulty: asNumber(p.difficulty),
      link: asText(p.link),
      hint: asText(p.hint),
      notes: asText(p.notes),
      solution: asText(p.solution),
      topicId: asNumber(p.topicId),
    };
  }

  assignIds(sheets);
  assignIds(topics);
  assignIds(problems);
  assignPositions(sheets);
  assignPositions(topics, 'sheetId');
  assignPositions(problems, 'topicId');

  return { sheets, topics, problems };
}
