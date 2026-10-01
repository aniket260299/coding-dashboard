import { memo, useDeferredValue, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData } from '../../data/DataContext';
import { matchesQuery, routes } from '../common/Utils';
import DifficultyBadge from '../common/DifficultyBadge';
import PageHeader from '../common/PageHeader';
import ListTable from '../common/ListTable';

const PAGE_SIZE = 100;

const ProblemTitle = memo(function ProblemTitle({ row }) {
  const firstLink = (row.link || '').split(/\r?\n/)[0]?.trim();
  if (!firstLink) {
    return (
      <span className="link-cell link-cell--plain" title={row.title}>
        {row.title}
      </span>
    );
  }
  return (
    <a className="link-cell" href={firstLink} target="_blank" rel="noreferrer" title={row.title}>
      {row.title}
    </a>
  );
});

const ProblemActions = memo(function ProblemActions({ row, sheetId, topicId, onDelete }) {
  return (
    <div className="action-cell">
      <Link to={routes.openProblem(sheetId, topicId, row.id)} className="action-cell__btn action-cell__btn--open">
        Open
      </Link>
      <Link to={routes.editProblem(sheetId, topicId, row.id)} className="action-cell__btn action-cell__btn--edit">
        Edit
      </Link>
      <button type="button" className="action-cell__btn action-cell__btn--danger" onClick={() => onDelete(row)}>
        Delete
      </button>
    </div>
  );
});

const ListProblem = () => {
  const { problemsByTopic, sheetsById, topicsById, deleteProblem } = useData();
  const { sheetId, topicId } = useParams();
  const numericSheetId = Number(sheetId);
  const numericTopicId = Number(topicId);

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const allRows = problemsByTopic?.get(numericTopicId) ?? [];

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((p) => matchesQuery(p.title, q));
  }, [allRows, deferredQuery]);

  const rows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const remove = (row) => {
    if (!window.confirm('Delete this problem? This cannot be undone.')) return;
    deleteProblem(row.id);
  };

  const sheet = sheetsById?.get(numericSheetId);
  const topic = topicsById?.get(numericTopicId);

  const columns = useMemo(
    () => [
      { key: 'position', header: '#', width: 90, render: (row) => row.position },
      { key: 'title', header: 'Title', render: (row) => <ProblemTitle row={row} /> },
      {
        key: 'difficulty',
        header: 'Difficulty',
        width: 140,
        cellClassName: 'cell-centered',
        render: (row) => <DifficultyBadge level={row.difficulty} />,
      },
      {
        key: 'action',
        header: 'Action',
        width: 230,
        render: (row) => (
          <ProblemActions row={row} sheetId={numericSheetId} topicId={numericTopicId} onDelete={remove} />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [numericSheetId, numericTopicId],
  );

  return (
    <div className="page">
      <PageHeader
        parents={[
          { label: 'Sheets', to: routes.sheets() },
          { label: sheet ? sheet.sheet : `Sheet ${numericSheetId}`, to: routes.topics(numericSheetId) },
        ]}
        title={topic ? topic.topic : `Topic ${numericTopicId}`}
        subtitle={
          allRows.length
            ? `${filtered.length} problem${filtered.length === 1 ? '' : 's'} · click a title to open it in a new tab`
            : 'Track your practice problems here.'
        }
        actions={
          <>
            <input
              className="form-control search-input"
              type="search"
              placeholder="Filter problems…"
              aria-label="Filter problems"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
            />
            <Link className="btn btn-primary" to={routes.newProblem(numericSheetId, numericTopicId)}>
              + New problem
            </Link>
          </>
        }
      />

      <div className="panel panel--flush">
        <ListTable
          columns={columns}
          rows={rows}
          getRowId={(row) => `problem-${row.id}`}
          empty={
            <span className="grid-empty">
              No problems in this topic yet — use <b>New problem</b> to add one.
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

export default ListProblem;
