import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data/DataContext';
import { useFilePicker } from './common/useFilePicker';

const Header = memo(function Header() {
  const { loaded, fileName, dirty, status, error, save, dismissMessages } = useData();
  const { inputRef, pickDataFile, handleFileInput } = useFilePicker();

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Link to="/" className="brand" aria-label="Coding Dashboard - home">
          <span className="brand__mark" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </span>
          <span className="brand__text">Coding Dashboard</span>
        </Link>

        <div className="topbar__actions">
          {loaded && (
            <span
              className={`file-chip ${dirty ? 'file-chip--dirty' : ''}`}
              title={dirty ? 'You have unsaved changes' : 'All changes saved'}
            >
              <span className="file-chip__dot" aria-hidden="true" />
              <span className="file-chip__name">{fileName}</span>
              {dirty && <span>· unsaved</span>}
            </span>
          )}
          {loaded && (
            <button type="button" className="btn btn-primary btn-sm" onClick={save}>
              Save
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={pickDataFile}>
            Load file
          </button>
        </div>
      </div>

      {(status || error) && (
        <div className={`toast-bar ${error ? 'toast-bar--error' : ''}`} role="status">
          <div className="toast-bar__inner">
            <span>{error || status}</span>
            <button
              type="button"
              className="toast-bar__close"
              aria-label="Dismiss message"
              onClick={dismissMessages}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <input
        style={{ display: 'none' }}
        ref={inputRef}
        onChange={handleFileInput}
        type="file"
        accept=".json,application/json"
      />
    </header>
  );
});

export default Header;
