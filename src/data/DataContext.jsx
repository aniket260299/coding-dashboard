import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { downloadText, pickDestinationAndWrite, writeToHandle } from './fileIO';
import { asNumber, asText, nextId, normalizeData } from './normalize';
import sampleDataText from './sample-data.txt?raw';

// Holds the whole dataset in memory: everything comes from the loaded file,
// edits update this state, and "Save" writes it back to a data file.

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

function initialState() {
  const stored = readStoredState();
  if (stored) {
    return { loaded: true, dirty: false, ...stored };
  }
  return { loaded: false, dirty: false, data: EMPTY_DATA, fileName: DEFAULT_FILE_NAME };
}

const cleanSheet = (sheet) => ({
  ...sheet,
  id: Number(sheet.id) || null,
  position: asNumber(sheet.position),
  sheet: asText(sheet.sheet),
  username: asText(sheet.username),
});

const cleanTopic = (topic) => ({
  ...topic,
  id: Number(topic.id) || null,
  position: asNumber(topic.position),
  topic: asText(topic.topic),
  sheetId: asNumber(topic.sheetId),
});

const cleanProblem = (problem) => ({
  ...problem,
  id: Number(problem.id) || null,
  position: asNumber(problem.position),
  title: asText(problem.title),
  difficulty: asNumber(problem.difficulty),
  link: asText(problem.link),
  hint: asText(problem.hint),
  notes: asText(problem.notes),
  solution: asText(problem.solution),
  topicId: asNumber(problem.topicId),
});

const upsertInto = (list, record) => {
  const index = record.id ? list.findIndex((item) => item.id === record.id) : -1;
  if (index >= 0) {
    list[index] = record;
    return list;
  }
  record.id = record.id || nextId(list);
  list.push(record);
  return list;
};

export function DataProvider({ children }) {
  const [state, setState] = useState(initialState);
  const [handle, setHandle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!state.loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state.data, fileName: state.fileName }));
    } catch (storageError) {
      console.warn('could not persist data to localStorage:', storageError);
    }
  }, [state]);

  const update = useCallback((mutator) => {
    setState((previous) => ({ ...previous, dirty: true, data: mutator(previous.data) }));
  }, []);

  // --- CRUD -----------------------------------------------------------------

  const upsertSheet = useCallback(
    (sheet) =>
      update((data) => ({ ...data, sheets: upsertInto([...data.sheets], cleanSheet(sheet)) })),
    [update],
  );

  const deleteSheet = useCallback(
    (sheetId) =>
      update((data) => {
        const removedTopicIds = new Set(
          data.topics.filter((topic) => topic.sheetId === sheetId).map((topic) => topic.id),
        );
        return {
          ...data,
          sheets: data.sheets.filter((sheet) => sheet.id !== sheetId),
          topics: data.topics.filter((topic) => topic.sheetId !== sheetId),
          problems: data.problems.filter((problem) => !removedTopicIds.has(problem.topicId)),
        };
      }),
    [update],
  );

  const upsertTopic = useCallback(
    (topic) =>
      update((data) => ({ ...data, topics: upsertInto([...data.topics], cleanTopic(topic)) })),
    [update],
  );

  const deleteTopic = useCallback(
    (topicId) =>
      update((data) => ({
        ...data,
        topics: data.topics.filter((topic) => topic.id !== topicId),
        problems: data.problems.filter((problem) => problem.topicId !== topicId),
      })),
    [update],
  );

  const upsertProblem = useCallback(
    (problem) =>
      update((data) => ({ ...data, problems: upsertInto([...data.problems], cleanProblem(problem)) })),
    [update],
  );

  const deleteProblem = useCallback(
    (problemId) =>
      update((data) => ({
        ...data,
        problems: data.problems.filter((problem) => problem.id !== problemId),
      })),
    [update],
  );

  // --- Loading a data file --------------------------------------------------

  const loadFromObject = useCallback((raw, fileName, fileHandle) => {
    const data = normalizeData(raw);
    setState({ loaded: true, dirty: false, data, fileName: fileName || DEFAULT_FILE_NAME });
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
        loadFromObject(JSON.parse(text), file.name, fileHandle);
      } catch (loadError) {
        const message = loadError instanceof SyntaxError
          ? 'the file is not valid JSON'
          : loadError.message;
        setError(`Could not load "${file.name}": ${message}.`);
      } finally {
        setBusy(false);
      }
    },
    [loadFromObject],
  );

  const loadSample = useCallback(() => {
    setBusy(true);
    setError('');
    try {
      loadFromObject(JSON.parse(sampleDataText), 'sample-data.txt', null);
    } catch (sampleError) {
      setError(`Could not load the bundled sample data: ${sampleError.message}.`);
    } finally {
      setBusy(false);
    }
  }, [loadFromObject]);

  const clearData = useCallback(() => {
    setState(initialState());
    setHandle(null);
    setStatus('');
    setError('');
  }, []);

  // --- Saving back to a data file -------------------------------------------

  const save = useCallback(async () => {
    setError('');
    const text = JSON.stringify(state.data);
    try {
      if (handle) {
        await writeToHandle(handle, text);
        setState((previous) => ({ ...previous, dirty: false }));
        setStatus(`Saved "${handle.name || state.fileName}".`);
        return;
      }
      if (typeof window.showSaveFilePicker === 'function') {
        const newHandle = await pickDestinationAndWrite(text, state.fileName);
        setHandle(newHandle);
        setState((previous) => ({ ...previous, dirty: false, fileName: newHandle.name || previous.fileName }));
        setStatus(`Saved "${newHandle.name}".`);
        return;
      }
      downloadText(text, state.fileName);
      setState((previous) => ({ ...previous, dirty: false }));
      setStatus(`Downloaded "${state.fileName}" - replace your original data file with it.`);
    } catch (saveError) {
      if (saveError.name === 'AbortError') return;
      downloadText(text, state.fileName);
      setState((previous) => ({ ...previous, dirty: false }));
      setError(`Could not write the file in place (${saveError.message}); it was downloaded instead.`);
    }
  }, [handle, state]);

  const dismissMessages = useCallback(() => {
    setStatus('');
    setError('');
  }, []);

  const value = useMemo(
    () => ({
      data: state.data,
      loaded: state.loaded,
      dirty: state.dirty,
      fileName: state.fileName,
      busy,
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
    }),
    [
      state,
      busy,
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
