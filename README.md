# coding-dashboard

A single, self-contained version of the coding dashboard: **React UI only** — no
Java backend, no database, and **no login**. The app reads its data from a JSON
data file that you load from the UI, renders it, lets you edit it, and saves the
changes back to a data file.

It replaces the previous pair of projects:

- `coding-dashboard-ui` (React SPA + login)
- `coding-dashboard-backend` (Spring Boot + JWT + H2)

## Run

```bash
npm install
npm start        # dev server on http://localhost:3000
```

Production build:

```bash
npm run build    # outputs dist/
npm run preview  # serves dist/ on http://localhost:3000
```

## How it works

1. **Load instead of login.** On first visit you get a file screen. Pick (or
   drag-and-drop) a data file — the same JSON shape the old backend exported:
   `{"sheets": [...], "topics": [...], "problems": [...]}`. The sample export
   `coding_dashboard_backend/src/main/resources/coding_dashboard_export.txt`
   works as-is, and a copy is bundled so you can click *Load bundled sample
   data* to try it immediately.
2. **Render.** Sheets → topics → problems with native tables, deferred
   search, progressive rendering, difficulty badges and a lazily loaded
   CodeMirror 6 Java editor for solutions. The header *Load file* button
   swaps the dataset at any time.
3. **Edit.** Add / edit / delete sheets, topics and problems. Deleting a sheet
   or topic also removes its children. Edits live in memory (mirrored to
   `localStorage`, so a refresh keeps your work).
4. **Save back.** The header *Save* button writes the updated data back to a
   data file:
   - In browsers with the File System Access API (Chrome/Edge), it writes back
     to the file you loaded (permission is requested on first save).
   - Otherwise it opens a save dialog / downloads `coding_dashboard_export.txt`
     — replace your original file with it.

## Data format

```json
{
  "sheets":   [{ "id": 1, "position": 1, "sheet": "LeetCode - Top Interview 150", "username": "you" }],
  "topics":   [{ "id": 1, "position": 1, "topic": "Array | String", "sheetId": 1 }],
  "problems": [{ "id": 1, "position": 1, "title": "Merge Sorted Array", "difficulty": 1,
                 "link": "...", "hint": "...", "notes": "...", "solution": "...", "topicId": 1 }]
}
```

- `difficulty`: `1` Easy, `2` Medium, `3` Hard
- Missing ids/positions are filled in automatically when a file is loaded
- Unknown extra fields are dropped; orphaned topics/problems are kept

## Structure

```
src/
  data/
    DataContext.jsx   reducer store with indexed lookups, debounced persistence
    fileIO.js         file picker / drag-drop / write-back / download helpers
    normalize.js      validates + normalises the loaded JSON (single-pass)
    sample-data.txt   bundled sample export (lazy-loaded, not in initial bundle)
  Component/
    LoadData.jsx      first-run "open a data file" screen
    Header.jsx        file name, Save, Load file, status messages
    sheet/  topic/  problem/   list, view and edit pages (native table + CodeMirror)
    common/
      ListTable.jsx   lightweight native table (replaces AG Grid)
      CodeEditor.jsx  lazy CodeMirror 6 wrapper (read-only + edit modes)
      PageHeader.jsx  memoised breadcrumbs + title + actions
      DifficultyBadge.jsx  memoised difficulty pill
      useFilePicker.js  shared file-picker hook
      Utils.js        position helpers, deferred search, ID-only routes
```
