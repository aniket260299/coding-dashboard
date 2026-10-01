// Serializes the flat in-memory state back into the nested v2 file format:
// { version: 2, sheets: [{ ...sheet, topics: [{ ...topic, problems: [...] }] }] }
//
// Groups come straight from the O(1) indexes, so this is one linear walk -
// sheetId/topicId never reach the file.

export function toV2({ sheets, topics, problems, indexes }) {
  const topicsBySheet = indexes?.topicsBySheet ?? new Map();
  const problemsByTopic = indexes?.problemsByTopic ?? new Map();

  return {
    version: 2,
    sheets: sheets.map((sheet) => ({
      id: sheet.id,
      position: sheet.position,
      sheet: sheet.sheet,
      username: sheet.username,
      topics: (topicsBySheet.get(sheet.id) ?? []).map((topic) => ({
        id: topic.id,
        position: topic.position,
        topic: topic.topic,
        problems: (problemsByTopic.get(topic.id) ?? []).map((problem) => ({
          id: problem.id,
          position: problem.position,
          title: problem.title,
          difficulty: problem.difficulty,
          link: problem.link,
          hint: problem.hint,
          notes: problem.notes,
          solution: problem.solution,
        })),
      })),
    })),
  };
}
