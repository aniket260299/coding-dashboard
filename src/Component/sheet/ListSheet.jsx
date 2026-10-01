import { memo, useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../data/DataContext';
import { getNextPosition, matchesQuery, routes } from '../common/Utils';
import PageHeader from '../common/PageHeader';
import ListTable from '../common/ListTable';

const PAGE_SIZE = 100;

const SheetRowActions = memo(function SheetRowActions({ row, editing, onEdit, onDelete, onSave, onCancel }) {
  if (editing) {
    return (
      <div className="action-cell">
        <button type="button" className="action-cell__btn action-cell__btn--open" onClick={() => onSave(row)}>
          Save
        </button>
        <button type="button" className="action-cell__btn action-cell__btn--edit" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <div className="action-cell">
      <Link to={routes.topics(row.id)} className="action-cell__btn action-cell__btn--open">
        Open
      </Link>
      <button type="button" className="action-cell__btn action-cell__btn--edit" onClick={() => onEdit(row)}>
        Edit
      </button>
      <button type="button" className="action-cell__btn action-cell__btn--danger" onClick={() => onDelete(row)}>
        Delete
      </button>
    </div>
  );
});

const ListSheet = () => {
  const { sortedSheets, data, upsertSheet, deleteSheet } = useData();
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ position: '', sheet: '' });
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sheets = sortedSheets ?? data.sheets;

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const base = q ? sheets.filter((s) => matchesQuery(s.sheet, q)) : sheets;
    return draft ? [...base, draft] : base;
  }, [sheets, deferredQuery, draft]);

  const rows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const remove = (row) => {
    if (!row.id) {
      setDraft(null);
      return;
    }
    if (!window.confirm('Delete this sheet along with all of its topics and problems?')) return;
    deleteSheet(row.id);
  };

  const addDraft = () => {
    if (draft) return;
    setDraft({
      id: 0,
      position: getNextPosition(sheets),
      sheet: '',
      username: data.sheets[0]?.username || '',
    });
    setEditingId(0);
    setEditValues({ position: String(getNextPosition(sheets)), sheet: '' });
  };

  const startEdit = (row) => {
    setEditingId(row.id || 0);
    setEditValues({ position: String(row.position ?? ''), sheet: row.sheet ?? '' });
    if (!row.id) setDraft(row);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveRow = (row) => {
    const name = (editValues.sheet || '').trim();
    if (!name) {
      window.alert('Give this sheet a name.');
      return;
    }
    const position = Number(editValues.position) || getNextPosition(sheets);
    if (row.id) {
      upsertSheet({ ...row, position, sheet: name });
    } else {
      upsertSheet({ position, sheet: name, username: row.username || data.sheets[0]?.username || '' });
    }
    setEditingId(null);
    setDraft(null);
  };

  const columns = useMemo(
    () => [
      {
        key: 'position',
        header: '#',
        width: 90,
        render: (row) =>
          editingId === (row.id || 0) ? (
            <input
              className="form-control form-control--sm"
              type="number"
              aria-label="Position"
              value={editValues.position}
              onChange={(e) => setEditValues((v) => ({ ...v, position: e.target.value }))}
            />
          ) : (
            row.position
          ),
      },
      {
        key: 'sheet',
        header: 'Sheet',
        render: (row) =>
          editingId === (row.id || 0) ? (
            <input
              className="form-control form-control--sm"
              type="text"
              aria-label="Sheet name"
              autoFocus
              placeholder="e.g. LeetCode - Top 150"
              value={editValues.sheet}
              onChange={(e) => setEditValues((v) => ({ ...v, sheet: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRow(row);
                if (e.key === 'Escape') cancelEdit();
              }}
            />
          ) : row.id ? (
            <Link className="link-cell" to={routes.topics(row.id)}>
              {row.sheet}
            </Link>
          ) : (
            <span className="link-cell link-cell--plain">{row.sheet || '(unsaved)'}</span>
          ),
      },
      {
        key: 'action',
        header: 'Action',
        width: 230,
        render: (row) => (
          <SheetRowActions
            row={row}
            editing={editingId === (row.id || 0)}
            onEdit={startEdit}
            onDelete={remove}
            onSave={saveRow}
            onCancel={cancelEdit}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingId, editValues],
  );

  return (
    <div className="page">
      <PageHeader
        title="Sheets"
        subtitle={
          sheets.length
            ? `${sheets.length} sheet${sheets.length === 1 ? '' : 's'} · click Edit for inline editing`
            : 'Group your problems into sheets, one step at a time.'
        }
        actions={
          <>
            <input
              className="form-control search-input"
              type="search"
              placeholder="Filter sheets…"
              aria-label="Filter sheets"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
            />
            <button type="button" className="btn btn-primary" onClick={addDraft} disabled={!!draft}>
              + New sheet
            </button>
          </>
        }
      />

      <div className="panel panel--flush">
        <ListTable
          columns={columns}
          rows={rows}
          getRowId={(row) => (row.id ? `sheet-${row.id}` : 'draft')}
          empty={
            <span className="grid-empty">
              No sheets yet — use <b>New sheet</b> to add your first one.
            </span>
          }
        />
        {filtered.length > rows.length && (
          <div className="panel__more">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
              Show more ({filtered.length - rows.length} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListSheet;
