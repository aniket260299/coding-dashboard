export function getRevisionNotes() {
  const today = new Date();
  return `Revision Dates: ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}\nLast Revision Notes:`;
}

export function getNextPosition(list) {
  let next = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i].position;
    if (typeof p === 'number' && p > next) next = p;
  }
  return next + 1;
}

/** Case-insensitive substring filter used by list search boxes. */
export function matchesQuery(text, query) {
  if (!query) return true;
  if (!text) return false;
  return text.toLowerCase().includes(query);
}

/** Route helpers — ID-only URLs. Names are looked up from the store. */
export const routes = {
  sheets: () => '/',
  topics: (sheetId) => `/topic/${sheetId}`,
  problems: (sheetId, topicId) => `/problem/${sheetId}/${topicId}`,
  openProblem: (sheetId, topicId, problemId) => `/problem/open/${sheetId}/${topicId}/${problemId}`,
  editProblem: (sheetId, topicId, problemId) => `/problem/edit/${sheetId}/${topicId}/${problemId}`,
  newProblem: (sheetId, topicId) => `/problem/edit/${sheetId}/${topicId}/new`,
};
