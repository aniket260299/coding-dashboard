import { memo, useDeferredValue, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData } from '../../data/DataContext';
import { matchesQuery, routes } from '../common/Utils';
import DifficultyBadge from '../common/DifficultyBadge';
import PageHeader from '../common/PageHeader';
import ListTable from '../common/ListTable';

const PAGE_SIZE = 100;

const ProblemTitle = memo(function ProblemTitle({ row, sheetId, topicId }) {
  const firstLink = (row.link || '').split(/\r?\n/)[0]?.trim();
  const title = <span className="link-cell__text">{row.title}</span>;
  return (
    <span className="link-cell" title={row.title}>
      <Link to={routes.openProblem(sheetId, topicId, row.id)}>{title}</Link>
      {firstLink && (
        <a
          className="link-cell__ext"
          href={firstLink}
          target="_blank"
          rel="noreferrer"
          title="Open problem link in a new tab"
          aria-label={`Open ${row.title} link in a new tab`}
          onClick={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      )}
    </span>
  );
});

const ProblemActions = memo(function ProblemActions({ row, sheetId, topicId, onDelete }) {
  return (
    <div className="action-cell">
      <Link
        to={routes.editProblem(sheetId, topicId, row.id)}
        className="action-cell__btn action-cell__btn--icon action-cell__btn--edit"
        data-tooltip="Edit"
        aria-label={`Edit ${row.title}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </Link>
      <button
        type="button"
        className="action-cell__btn action-cell__btn--icon action-cell__btn--danger"
        data-tooltip="Delete"
        aria-label={`Delete ${row.title}`}
        onClick={() => onDelete(row)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
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
      {
        key: 'title',
        header: 'Title',
        render: (row) => <ProblemTitle row={row} sheetId={numericSheetId} topicId={numericTopicId} />,
      },
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
        width: 110,
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
            ? `${filtered.length} problem${filtered.length === 1 ? '' : 's'} · click a title to open it`
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
