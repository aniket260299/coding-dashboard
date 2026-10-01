import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { DEFAULT_FILE_NAME, downloadText, pickDestinationAndWrite, writeToHandle } from './fileIO';
import { assertV2Format, asNumber, asText, buildIndexes, normalizeData } from './normalize';
import { toV2 } from './serialize';
import { clearSession, loadSession, saveSession } from './storage';

// In-memory store: everything comes from the loaded v2 file, edits update
// this state, and "Save" writes it back as a nested v2 JSON file. The last
// session is mirrored into IndexedDB (see storage.js) so a refresh keeps it.

const EMPTY_LISTS = { sheets: [], topics: [], problems: [] };
const EMPTY_INDEXES = buildIndexes([], [], []);

const DataContext = createContext(null);

/** Cheap extension/MIME check - every load path funnels through loadFromFile. */
const isJsonFile = (file) =>
  typeof file?.name === 'string' && (/\.json$/i.test(file.name) || file.type === 'application/json');

function initialState() {
  return {
    loaded: false,
    dirty: false,
    ...EMPTY_LISTS,
    indexes: EMPTY_INDEXES,
    maxSheetId: 0,
    maxTopicId: 0,
    maxProblemId: 0,
    fileName: DEFAULT_FILE_NAME,
  };
}

const cleanSheet = (sheet) => ({
  id: Number(sheet.id) || 0,
  position: asNumber(sheet.position),
  sheet: asText(sheet.sheet),
  username: asText(sheet.username),
});

const cleanTopic = (topic) => ({
  id: Number(topic.id) || 0,
  position: asNumber(topic.position),
  topic: asText(topic.topic),
  sheetId: asNumber(topic.sheetId),
});

const cleanProblem = (problem) => ({
  id: Number(problem.id) || 0,
  position: asNumber(problem.position),
  title: asText(problem.title),
  difficulty: asNumber(problem.difficulty),
  link: asText(problem.link),
  hint: asText(problem.hint),
  notes: asText(problem.notes),
  solution: asText(problem.solution),
  topicId: asNumber(problem.topicId),
});

function upsertInto(list, record, maxKey, state) {
  const next = [...list];
  if (record.id) {
    const index = next.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      next[index] = record;
      return { list: next, maxId: state[maxKey] };
    }
  }
  const maxId = state[maxKey] || 0;
  const id = record.id && record.id > maxId ? record.id : maxId + 1;
  record.id = id;
  next.push(record);
  return { list: next, maxId: Math.max(maxId, id) };
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return {
        loaded: true,
        dirty: false,
        sheets: action.data.sheets,
        topics: action.data.topics,
        problems: action.data.problems,
        indexes: action.data.indexes,
        maxSheetId: action.data.maxIds.maxSheetId,
        maxTopicId: action.data.maxIds.maxTopicId,
        maxProblemId: action.data.maxIds.maxProblemId,
        fileName: action.fileName,
      };
    case 'CLEAR':
      // Storage is cleared by clearData(); force a clean slate.
      return initialState();
    case 'MARK_CLEAN':
      return state.dirty ? { ...state, dirty: false } : state;
    case 'SET_FILENAME':
      return { ...state, fileName: action.fileName };
    case 'UPSERT_SHEET': {
      const { list, maxId } = upsertInto(state.sheets, cleanSheet(action.record), 'maxSheetId', state);
      return {
        ...state,
        dirty: true,
        sheets: list,
        maxSheetId: maxId,
        indexes: buildIndexes(list, state.topics, state.problems),
      };
    }
    case 'DELETE_SHEET': {
      const removedTopicIds = new Set();
      for (const t of state.topics) {
        if (t.sheetId === action.sheetId) removedTopicIds.add(t.id);
      }
      const sheets = state.sheets.filter((s) => s.id !== action.sheetId);
      const topics = state.topics.filter((t) => t.sheetId !== action.sheetId);
      const problems = state.problems.filter((p) => !removedTopicIds.has(p.topicId));
      return {
        ...state,
        dirty: true,
        sheets,
        topics,
        problems,
        indexes: buildIndexes(sheets, topics, problems),
      };
    }
    case 'UPSERT_TOPIC': {
      const { list, maxId } = upsertInto(state.topics, cleanTopic(action.record), 'maxTopicId', state);
      return {
        ...state,
        dirty: true,
        topics: list,
        maxTopicId: maxId,
        indexes: buildIndexes(state.sheets, list, state.problems),
      };
    }
    case 'DELETE_TOPIC': {
      const topics = state.topics.filter((t) => t.id !== action.topicId);
      const problems = state.problems.filter((p) => p.topicId !== action.topicId);
      return {
        ...state,
        dirty: true,
        topics,
        problems,
        indexes: buildIndexes(state.sheets, topics, problems),
      };
    }
    case 'UPSERT_PROBLEM': {
      const { list, maxId } = upsertInto(state.problems, cleanProblem(action.record), 'maxProblemId', state);
      return {
        ...state,
        dirty: true,
        problems: list,
        maxProblemId: maxId,
        indexes: buildIndexes(state.sheets, state.topics, list),
      };
    }
    case 'DELETE_PROBLEM': {
      const problems = state.problems.filter((p) => p.id !== action.problemId);
      return {
        ...state,
        dirty: true,
        problems,
        indexes: buildIndexes(state.sheets, state.topics, problems),
      };
    }
    default:
      return state;
  }
}

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [handle, setHandle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // Keep latest state in a ref so save() stays stable and never
  // re-creates on every keystroke / edit.
  const stateRef = useRef(state);
  stateRef.current = state;
  const handleRef = useRef(handle);
  handleRef.current = handle;

  // Restore the previous session once, before the UI becomes interactive.
  // IndexedDB reads are async, so the first paint waits behind `hydrating`
  // (App shows the loading spinner) instead of a synchronous localStorage hit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadSession();
        if (cancelled || !stored) return;
        const data = normalizeData(stored); // flat persisted shape, zero-copy
        dispatch({
          type: 'LOAD',
          data,
          fileName: typeof stored.fileName === 'string' && stored.fileName ? stored.fileName : DEFAULT_FILE_NAME,
        });
      } catch (restoreError) {
        console.warn('could not restore the previous session:', restoreError);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced persistence: one IndexedDB write 400ms after the last change,
  // never on every render/keystroke.
  useEffect(() => {
    if (!state.loaded || hydrating) return;
    const timer = window.setTimeout(() => {
      const { sheets, topics, problems, fileName } = stateRef.current;
      saveSession({ sheets, topics, problems, fileName });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [state.sheets, state.topics, state.problems, state.fileName, state.loaded, hydrating]);

  const data = useMemo(
    () => ({ sheets: state.sheets, topics: state.topics, problems: state.problems }),
    [state.sheets, state.topics, state.problems],
  );

  // --- CRUD (stable callbacks, reducer keeps logic out of render) ---

  const upsertSheet = useCallback((sheet) => dispatch({ type: 'UPSERT_SHEET', record: sheet }), []);
  const deleteSheet = useCallback((sheetId) => dispatch({ type: 'DELETE_SHEET', sheetId }), []);
  const upsertTopic = useCallback((topic) => dispatch({ type: 'UPSERT_TOPIC', record: topic }), []);
  const deleteTopic = useCallback((topicId) => dispatch({ type: 'DELETE_TOPIC', topicId }), []);
  const upsertProblem = useCallback((problem) => dispatch({ type: 'UPSERT_PROBLEM', record: problem }), []);
  const deleteProblem = useCallback((problemId) => dispatch({ type: 'DELETE_PROBLEM', problemId }), []);

  // --- Loading a data file (parse off the critical path where possible) ---

  const loadFromObject = useCallback((raw, fileName, fileHandle) => {
    const data = normalizeData(raw);
    dispatch({ type: 'LOAD', data, fileName: fileName || DEFAULT_FILE_NAME });
    setHandle(fileHandle || null);
    setStatus(`Loaded "${fileName || DEFAULT_FILE_NAME}"`);
    setError('');
  }, []);

  const loadFromFile = useCallback(
    async (file, fileHandle) => {
      setBusy(true);
      setError('');
      try {
        if (!isJsonFile(file)) throw new Error('only .json files are accepted');
        const text = await file.text();
        // Yield once so the loading spinner paints before the blocking parse.
        await new Promise((resolve) => setTimeout(resolve, 0));
        const raw = JSON.parse(text);
        assertV2Format(raw);
        loadFromObject(raw, file.name, fileHandle);
      } catch (loadError) {
        const message =
          loadError instanceof SyntaxError ? 'the file is not valid JSON' : loadError.message;
        setError(`Could not load "${file.name}": ${message}.`);
      } finally {
        setBusy(false);
      }
    },
    [loadFromObject],
  );

  const loadSample = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      // Dynamic import keeps the 200KB sample out of the initial bundle —
      // it is fetched only when the user clicks "Load sample".
      const mod = await import('./sample-data.json?raw');
      loadFromObject(JSON.parse(mod.default), 'sample-data.json', null);
    } catch (sampleError) {
      setError(`Could not load the bundled sample data: ${sampleError.message}.`);
    } finally {
      setBusy(false);
    }
  }, [loadFromObject]);

  const clearData = useCallback(() => {
    clearSession();
    dispatch({ type: 'CLEAR' });
    setHandle(null);
    setStatus('');
    setError('');
  }, []);

  // --- Saving back to a data file ---

  const save = useCallback(async () => {
    setError('');
    const current = stateRef.current;
    const text = JSON.stringify(toV2(current));
    const fileName = current.fileName;
    const currentHandle = handleRef.current;
    try {
      if (currentHandle) {
        await writeToHandle(currentHandle, text);
        dispatch({ type: 'MARK_CLEAN' });
        setStatus(`Saved "${currentHandle.name || fileName}".`);
        return;
      }
      if (typeof window.showSaveFilePicker === 'function') {
        const newHandle = await pickDestinationAndWrite(text, fileName);
        setHandle(newHandle);
        dispatch({ type: 'SET_FILENAME', fileName: newHandle.name || fileName });
        dispatch({ type: 'MARK_CLEAN' });
        setStatus(`Saved "${newHandle.name}".`);
        return;
      }
      downloadText(text, fileName);
      dispatch({ type: 'MARK_CLEAN' });
      setStatus(`Downloaded "${fileName}" - replace your original data file with it.`);
    } catch (saveError) {
      if (saveError.name === 'AbortError') return;
      downloadText(text, fileName);
      dispatch({ type: 'MARK_CLEAN' });
      setError(`Could not write the file in place (${saveError.message}); it was downloaded instead.`);
    }
  }, []);

  const dismissMessages = useCallback(() => {
    setStatus('');
    setError('');
  }, []);

  const value = useMemo(
    () => ({
      data,
      loaded: state.loaded,
      dirty: state.dirty,
      fileName: state.fileName,
      busy,
      hydrating,
      status,
      error,
      ...state.indexes,
      loadFromFile,
      loadSample,
      clearData,
      save,
      upsertSheet,
      deleteSheet,
      upsertTopic,
      deleteTopic,
      upsertProblem,
      deleteProblem,
      dismissMessages,
    }),
    [
      data,
      state.loaded,
      state.dirty,
      state.fileName,
      state.indexes,
      busy,
      hydrating,
      status,
      error,
      loadFromFile,
      loadSample,
      clearData,
      save,
      upsertSheet,
      deleteSheet,
      upsertTopic,
      deleteTopic,
      upsertProblem,
      deleteProblem,
      dismissMessages,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used inside a DataProvider');
  }
  return context;
}
