import { memo, useState } from 'react';
import { useData } from '../data/DataContext';
import { fileFromDataTransfer } from '../data/fileIO';
import { useFilePicker } from './common/useFilePicker';

const SAMPLE_FORMAT = `{
  "version": 2,
  "sheets": [
    { "id": 1, "position": 1, "sheet": "LeetCode - Top Interview 150", "username": "you",
      "topics": [
        { "id": 1, "position": 1, "topic": "Array | String",
          "problems": [
            { "id": 1, "position": 1, "title": "Merge Sorted Array", "difficulty": 1,
              "link": "...", "hint": "...", "notes": "...", "solution": "..." }
          ] }
      ] }
  ]
}`;

const LoadData = memo(function LoadData() {
  const { loadFromFile, loadSample } = useData();
  const { inputRef, pickDataFile, handleFileInput } = useFilePicker();
  const [dragging, setDragging] = useState(false);

  const handleDrop = async (event) => {
    event.preventDefault();
    setDragging(false);
    const picked = await fileFromDataTransfer(event.dataTransfer);
    if (picked) await loadFromFile(picked.file, picked.handle || null);
  };

  return (
    <div className="empty-state">
      <div className="empty-state__card">
        <div
          className={`empty-state__drop ${dragging ? 'empty-state__drop--active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="empty-state__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h1>Open a data file</h1>
          <p>
            No login - this dashboard reads everything from a <b>.json</b> file you choose. Pick a
            file, or drag and drop it right here.
          </p>
          <div className="empty-state__actions">
            <button type="button" className="btn btn-primary" onClick={pickDataFile}>
              Choose JSON file
            </button>
            <button type="button" className="btn btn-ghost" onClick={loadSample}>
              Load bundled sample data
            </button>
          </div>
          <input
            style={{ display: 'none' }}
            ref={inputRef}
            onChange={handleFileInput}
            type="file"
            accept=".json,application/json"
          />

          <details className="format-details">
            <summary>▸ Expected JSON format (v2, nested)</summary>
            <pre>{SAMPLE_FORMAT}</pre>
          </details>
        </div>
      </div>
    </div>
  );
});

export default LoadData;
