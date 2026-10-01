// File-system helpers: picking a data file, saving changes back to it, and a
// download fallback for browsers without the File System Access API.

const DATA_TYPES = [
  {
    description: 'Coding dashboard data (JSON)',
    accept: { 'application/json': ['.json'] },
  },
];

export const DEFAULT_FILE_NAME = 'coding_dashboard_export.json';

export function supportsFilePicker() {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

/** Opens the native file picker and returns { file, handle }. Throws AbortError on cancel. */
export async function pickFile() {
  const [handle] = await window.showOpenFilePicker({ multiple: false, types: DATA_TYPES });
  const file = await handle.getFile();
  return { file, handle };
}

/** Resolves a drag-and-drop payload to { file, handle? }. Returns null when empty. */
export async function fileFromDataTransfer(dataTransfer) {
  const item = dataTransfer?.items?.[0];
  if (item && typeof item.getAsFileSystemHandle === 'function') {
    try {
      const handle = await item.getAsFileSystemHandle();
      if (handle && handle.kind === 'file') {
        return { file: await handle.getFile(), handle };
      }
    } catch {
      // Fall through to the plain File API.
    }
  }
  const file = dataTransfer?.files?.[0];
  return file ? { file } : null;
}

async function ensurePermission(handle, mode) {
  const options = { mode };
  if ((await handle.queryPermission(options)) === 'granted') return true;
  return (await handle.requestPermission(options)) === 'granted';
}

/** Writes text back to a previously picked file handle (asks permission if needed). */
export async function writeToHandle(handle, text) {
  if (!(await ensurePermission(handle, 'readwrite'))) {
    throw new Error('write permission was denied');
  }
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

/** Lets the user choose the destination file, writes to it, returns the new handle. */
export async function pickDestinationAndWrite(text, suggestedName) {
  const handle = await window.showSaveFilePicker({
    suggestedName: suggestedName || DEFAULT_FILE_NAME,
    types: DATA_TYPES,
  });
  await writeToHandle(handle, text);
  return handle;
}

/** Fallback: triggers a browser download of the updated data file. */
export function downloadText(text, fileName) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName || DEFAULT_FILE_NAME;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
