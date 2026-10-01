import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { downloadText, pickDestinationAndWrite, writeToHandle } from './fileIO';
import { asNumber, asText, normalizeData } from './normalize';

// In-memory store: everything comes from the loaded file, edits update
// this state, and "Save" writes it back to a data file.

const STORAGE_KEY = 'coding-dashboard-data';
const DEFAULT_FILE_NAME = 'coding_dashboard_export.txt';

const EMPTY_DATA = { sheets: [], topics: [], problems: [] };

const DataContext = createContext(null);

function readStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const data = normalizeData(parsed);
    return {
      data,
      fileName: typeof parsed.fileName === 'string' && parsed.fileName ? parsed.fileName : DEFAULT_FILE_NAME,
    };
  } catch {
    return null;
  }
}

function maxIdOf(list) {
  let max = 0;
  for (let i = 0; i < list.length; i++) {
    const id = list[i].id;
    if (id > max) max = id;
  }
  return max;
}

function withMaxIds(data) {
  return {
    ...data,
    maxSheetId: maxIdOf(data.sheets),
    maxTopicId: maxIdOf(data.topics),
    maxProblemId: maxIdOf(data.problems),
  };
}

function initialState() {
  const stored = readStoredState();
  if (stored) {
    return { loaded: true, dirty: false, ...withMaxIds(stored.data), fileName: stored.fileName };
  }
  return { loaded: false, dirty: false, ...withMaxIds(EMPTY_DATA), fileName: DEFAULT_FILE_NAME };
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
        ...withMaxIds(action.data),
        fileName: action.fileName,
      };
    case 'CLEAR': {
      const fresh = initialState();
      // initialState reads localStorage — force a clean slate instead.
      return { loaded: false, dirty: false, ...withMaxIds(EMPTY_DATA), fileName: fresh.fileName };
    }
    case 'MARK_CLEAN':
      return state.dirty ? { ...state, dirty: false } : state;
    case 'SET_FILENAME':
      return { ...state, fileName: action.fileName };
    case 'UPSERT_SHEET': {
      const { list, maxId } = upsertInto(state.sheets, cleanSheet(action.record), 'maxSheetId', state);
      return { ...state, dirty: true, sheets: list, maxSheetId: maxId };
    }
    case 'DELETE_SHEET': {
      const removedTopicIds = new Set();
      for (const t of state.topics) {
        if (t.sheetId === action.sheetId) removedTopicIds.add(t.id);
      }
      return {
        ...state,
        dirty: true,
        sheets: state.sheets.filter((s) => s.id !== action.sheetId),
        topics: state.topics.filter((t) => t.sheetId !== action.sheetId),
        problems: state.problems.filter((p) => !removedTopicIds.has(p.topicId)),
      };
    }
    case 'UPSERT_TOPIC': {
      const { list, maxId } = upsertInto(state.topics, cleanTopic(action.record), 'maxTopicId', state);
      return { ...state, dirty: true, topics: list, maxTopicId: maxId };
    }
    case 'DELETE_TOPIC':
      return {
        ...state,
        dirty: true,
        topics: state.topics.filter((t) => t.id !== action.topicId),
        problems: state.problems.filter((p) => p.topicId !== action.topicId),
      };
    case 'UPSERT_PROBLEM': {
      const { list, maxId } = upsertInto(state.problems, cleanProblem(action.record), 'maxProblemId', state);
      return { ...state, dirty: true, problems: list, maxProblemId: maxId };
    }
    case 'DELETE_PROBLEM':
      return {
        ...state,
        dirty: true,
        problems: state.problems.filter((p) => p.id !== action.problemId),
      };
    default:
      return state;
  }
}

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [handle, setHandle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // Keep latest state in a ref so save() stays stable and never
  // re-creates on every keystroke / edit.
  const stateRef = useRef(state);
  stateRef.current = state;
  const handleRef = useRef(handle);
  handleRef.current = handle;

  // Debounced persistence: avoid JSON.stringify on every render,
  // only persist 400ms after the last change.
  useEffect(() => {
    if (!state.loaded) return;
    const timer = window.setTimeout(() => {
      try {
        const { sheets, topics, problems, fileName } = stateRef.current;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ sheets, topics, problems, fileName }));
      } catch (storageError) {
        console.warn('could not persist data to localStorage:', storageError);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [state.sheets, state.topics, state.problems, state.fileName, state.loaded]);

  // --- Indexed lookups (O(1) instead of filter+find per render) ---
  const indexes = useMemo(() => {
    const sheetsById = new Map();
    for (const s of state.sheets) sheetsById.set(s.id, s);
    const topicsById = new Map();
    const topicsBySheet = new Map();
    for (const t of state.topics) {
      topicsById.set(t.id, t);
      let group = topicsBySheet.get(t.sheetId);
      if (!group) {
        group = [];
        topicsBySheet.set(t.sheetId, group);
      }
      group.push(t);
    }
    for (const group of topicsBySheet.values()) group.sort((a, b) => a.position - b.position);
    const problemsById = new Map();
    const problemsByTopic = new Map();
    for (const p of state.problems) {
      problemsById.set(p.id, p);
      let group = problemsByTopic.get(p.topicId);
      if (!group) {
        group = [];
        problemsByTopic.set(p.topicId, group);
      }
      group.push(p);
    }
    for (const group of problemsByTopic.values()) group.sort((a, b) => a.position - b.position);
    const sortedSheets = [...state.sheets].sort((a, b) => a.position - b.position);
    return { sheetsById, topicsById, topicsBySheet, problemsById, problemsByTopic, sortedSheets };
  }, [state.sheets, state.topics, state.problems]);

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
        const text = await file.text();
        // Yield once so the loading spinner paints before the blocking parse.
        await new Promise((resolve) => setTimeout(resolve, 0));
        loadFromObject(JSON.parse(text), file.name, fileHandle);
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
      const mod = await import('./sample-data.txt?raw');
      loadFromObject(JSON.parse(mod.default), 'sample-data.txt', null);
    } catch (sampleError) {
      setError(`Could not load the bundled sample data: ${sampleError.message}.`);
    } finally {
      setBusy(false);
    }
  }, [loadFromObject]);

  const clearData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    dispatch({ type: 'CLEAR' });
    setHandle(null);
    setStatus('');
    setError('');
  }, []);

  // --- Saving back to a data file ---

  const save = useCallback(async () => {
    setError('');
    const current = stateRef.current;
    const text = JSON.stringify({ sheets: current.sheets, topics: current.topics, problems: current.problems });
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
      status,
      error,
      ...indexes,
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
      busy,
      status,
      error,
      indexes,
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
