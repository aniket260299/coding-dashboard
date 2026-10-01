import { useCallback, useRef } from 'react';
import { useData } from '../../data/DataContext';
import { pickFile, supportsFilePicker } from '../../data/fileIO';

/**
 * Shared file-picker logic (was duplicated in Header + LoadData).
 * Returns stable callbacks + a hidden input ref for the fallback path.
 */
export function useFilePicker() {
  const { loadFromFile } = useData();
  const inputRef = useRef(null);

  const pickDataFile = useCallback(async () => {
    if (supportsFilePicker()) {
      try {
        const { file, handle } = await pickFile();
        await loadFromFile(file, handle);
        return;
      } catch (pickError) {
        if (pickError?.name === 'AbortError') return;
        console.warn('file picker failed, falling back to input element:', pickError);
      }
    }
    inputRef.current?.click();
  }, [loadFromFile]);

  const handleFileInput = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) await loadFromFile(file, null);
    },
    [loadFromFile],
  );

  return { inputRef, pickDataFile, handleFileInput };
}
