import React, { useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { useData } from '../data/DataContext';
import { fileFromDataTransfer, pickFile, supportsFilePicker } from '../data/fileIO';

const SAMPLE_FORMAT = `{
  "sheets":   [{ "id": 1, "position": 1, "sheet": "LeetCode - Top Interview 150", "username": "you" }],
  "topics":   [{ "id": 1, "position": 1, "topic": "Array | String", "sheetId": 1 }],
  "problems": [{ "id": 1, "position": 1, "title": "Merge Sorted Array", "difficulty": 1,
                 "link": "...", "hint": "...", "notes": "...", "solution": "...", "topicId": 1 }]
}`;

const LoadData = () => {
    const { loadFromFile, loadSample } = useData();
    const inputFile = useRef(null);
    const [dragging, setDragging] = useState(false);

    const pickDataFile = async () => {
        if (supportsFilePicker()) {
            try {
                const { file, handle } = await pickFile();
                await loadFromFile(file, handle);
                return;
            } catch (pickError) {
                if (pickError.name === 'AbortError') return;
                console.warn('file picker failed, falling back to input element:', pickError);
            }
        }
        inputFile.current?.click();
    };

    const handleFileInput = async (event) => {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (file) await loadFromFile(file, null);
    };

    const handleDrop = async (event) => {
        event.preventDefault();
        setDragging(false);
        const picked = await fileFromDataTransfer(event.dataTransfer);
        if (picked) await loadFromFile(picked.file, picked.handle || null);
    };

    return (
        <div className="load-data">
            <div
                className={`load-data__drop ${dragging ? 'load-data__drop--active' : ''}`}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
            >
                <h4>Open a data file</h4>
                <p className="text-muted mb-3">
                    No login - this dashboard reads your data from a file.<br />
                    Choose a file, or drag and drop it here.
                </p>
                <div className="d-flex justify-content-center gap-2 mb-3">
                    <Button color="primary" onClick={pickDataFile}>Choose data file</Button>
                    <Button color="link" onClick={loadSample}>Load bundled sample data</Button>
                </div>
                <input style={{ display: 'none' }} ref={inputFile} onChange={handleFileInput} type="file" accept=".txt,.json,application/json,text/plain" />
                <small className="text-muted">
                    Expected format: a JSON export with <code>sheets</code>, <code>topics</code> and <code>problems</code>.
                </small>
            </div>
            <pre className="load-data__format">{SAMPLE_FORMAT}</pre>
        </div>
    );
};

export default LoadData;
