import { memo, useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../data/DataContext';
import { getNextPosition, matchesQuery, routes } from '../common/Utils';
import PageHeader from '../common/PageHeader';
import ListTable from '../common/ListTable';

const PAGE_SIZE = 100;

const TopicRowActions = memo(function TopicRowActions({ row, editing, onEdit, onDelete, onSave, onCancel, sheetId }) {
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
      {row.id ? (
        <Link to={routes.problems(sheetId, row.id)} className="action-cell__btn action-cell__btn--open">
          Open
        </Link>
      ) : (
        <span className="action-cell__btn action-cell__btn--open" aria-disabled="true">
          Open
        </span>
      )}
      <button type="button" className="action-cell__btn action-cell__btn--edit" onClick={() => onEdit(row)}>
        Edit
      </button>
      <button type="button" className="action-cell__btn action-cell__btn--danger" onClick={() => onDelete(row)}>
        Delete
      </button>
    </div>
  );
});

const ListTopic = () => {
  const { topicsBySheet, sheetsById, upsertTopic, deleteTopic } = useData();
  const { sheetId } = useParams();
  const navigate = useNavigate();
  const numericSheetId = Number(sheetId);

  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ position: '', topic: '' });
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (!Number.isFinite(numericSheetId)) {
    navigate('/', { replace: true });
  }

  const sheet = sheetsById?.get(numericSheetId);
  const topics = topicsBySheet?.get(numericSheetId) ?? [];

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const base = q ? topics.filter((t) => matchesQuery(t.topic, q)) : topics;
    return draft ? [...base, draft] : base;
  }, [topics, deferredQuery, draft]);

  const rows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const remove = (row) => {
    if (!row.id) {
      setDraft(null);
      setEditingId(null);
      return;
    }
    if (!window.confirm('Delete this topic along with all of its problems?')) return;
    deleteTopic(row.id);
  };

  const addDraft = () => {
    if (draft) return;
    const position = getNextPosition(topics);
    const record = { id: 0, position, topic: '', sheetId: numericSheetId };
    setDraft(record);
    setEditingId(0);
    setEditValues({ position: String(position), topic: '' });
  };

  const startEdit = (row) => {
    setEditingId(row.id || 0);
    setEditValues({ position: String(row.position ?? ''), topic: row.topic ?? '' });
    if (!row.id) setDraft(row);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveRow = (row) => {
    const name = (editValues.topic || '').trim();
    if (!name) {
      window.alert('Give this topic a name.');
      return;
    }
    const position = Number(editValues.position) || getNextPosition(topics);
    if (row.id) {
      upsertTopic({ ...row, position, topic: name, sheetId: numericSheetId });
    } else {
      upsertTopic({ position, topic: name, sheetId: numericSheetId });
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
        key: 'topic',
        header: 'Topic',
        render: (row) =>
          editingId === (row.id || 0) ? (
            <input
              className="form-control form-control--sm"
              type="text"
              aria-label="Topic name"
              autoFocus
              placeholder="e.g. Sliding Window"
              value={editValues.topic}
              onChange={(e) => setEditValues((v) => ({ ...v, topic: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRow(row);
                if (e.key === 'Escape') cancelEdit();
              }}
            />
          ) : row.id ? (
            <Link className="link-cell" to={routes.problems(numericSheetId, row.id)}>
              {row.topic}
            </Link>
          ) : (
            <span className="link-cell link-cell--plain">{row.topic || '(unsaved)'}</span>
          ),
      },
      {
        key: 'action',
        header: 'Action',
        width: 230,
        render: (row) => (
          <TopicRowActions
            row={row}
            sheetId={numericSheetId}
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
    [editingId, editValues, numericSheetId],
  );

  return (
    <div className="page">
      <PageHeader
        parents={[{ label: 'Sheets', to: routes.sheets() }]}
        title={sheet ? sheet.sheet : `Sheet ${numericSheetId}`}
        subtitle={
          topics.length
            ? `${topics.length} topic${topics.length === 1 ? '' : 's'} in this sheet · click Edit for inline editing`
            : 'No topics in this sheet yet.'
        }
        actions={
          <>
            <input
              className="form-control search-input"
              type="search"
              placeholder="Filter topics…"
              aria-label="Filter topics"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
            />
            <button type="button" className="btn btn-primary" onClick={addDraft} disabled={!!draft}>
              + New topic
            </button>
          </>
        }
      />

      <div className="panel panel--flush">
        <ListTable
          columns={columns}
          rows={rows}
          getRowId={(row) => (row.id ? `topic-${row.id}` : 'draft')}
          empty={
            <span className="grid-empty">
              No topics in this sheet yet — use <b>New topic</b> to add one.
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

export default ListTopic;
