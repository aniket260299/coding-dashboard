import { Suspense, lazy, memo, useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData } from '../../data/DataContext';
import { routes } from '../common/Utils';
import DifficultyBadge from '../common/DifficultyBadge';
import PageHeader from '../common/PageHeader';

const CodeEditor = lazy(() => import('../common/CodeEditor'));

const LinksList = memo(function LinksList({ links }) {
  if (!links.length) return <p className="empty-inline">No links saved for this problem yet.</p>;
  return (
    <ul className="links-list">
      {links.map((link, index) => (
        <li key={`${index}-${link}`}>
          <a href={link} target="_blank" rel="noreferrer">
            <span className="links-list__body">
              <span className="links-list__label">Link {index + 1}</span>
              <span className="links-list__url">{link}</span>
            </span>
            <span className="links-list__arrow" aria-hidden="true">
              ↗
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
});

function OpenProblem() {
  const { problemsById, sheetsById, topicsById } = useData();
  const { sheetId, topicId, problemId } = useParams();
  const [copied, setCopied] = useState(false);

  const numericSheetId = Number(sheetId);
  const numericTopicId = Number(topicId);
  const numericProblemId = Number(problemId);

  const problem = problemsById?.get(numericProblemId);
  const sheet = sheetsById?.get(numericSheetId);
  const topic = topicsById?.get(numericTopicId);

  const links = useMemo(() => {
    if (!problem?.link) return [];
    return problem.link
      .split(/\r?\n/)
      .map((link) => link.trim())
      .filter(Boolean);
  }, [problem]);

  const copySolution = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(problem.solution || '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (copyError) {
      console.warn('clipboard unavailable:', copyError);
    }
  }, [problem]);

  if (!problem) {
    return (
      <div className="page">
        <PageHeader parents={[{ label: 'Sheets', to: routes.sheets() }]} title="Problem not found" />
        <div className="panel">
          <div className="panel__body">
            <p className="empty-inline">It may have been deleted - go back to the list to pick another one.</p>
            <Link className="btn btn-ghost" to={routes.problems(numericSheetId, numericTopicId)}>
              Back to problems
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sheetLabel = sheet ? sheet.sheet : `Sheet ${numericSheetId}`;
  const topicLabel = topic ? topic.topic : `Topic ${numericTopicId}`;

  return (
    <div className="page">
      <PageHeader
        parents={[
          { label: 'Sheets', to: routes.sheets() },
          { label: sheetLabel, to: routes.topics(numericSheetId) },
          { label: topicLabel, to: routes.problems(numericSheetId, numericTopicId) },
        ]}
        title={problem.title || 'Untitled problem'}
        badge={<DifficultyBadge level={problem.difficulty} />}
        subtitle={
          links.length
            ? `${links.length} reference link${links.length === 1 ? '' : 's'} · solution in read-only mode`
            : 'Solution in read-only mode'
        }
        actions={
          <>
            {links[0] && (
              <a className="btn btn-ghost" href={links[0]} target="_blank" rel="noreferrer">
                Open link ↗
              </a>
            )}
            <Link className="btn btn-primary" to={routes.editProblem(numericSheetId, numericTopicId, problem.id)}>
              Edit
            </Link>
          </>
        }
      />

      <div className="problem-layout">
        <div className="problem-layout__main">
          <section className="panel">
            <div className="panel__head">
              <h2 className="panel__title">Hint</h2>
            </div>
            <div className="panel__body">
              {(problem.hint || '').trim() ? (
                <p className="prose">{problem.hint}</p>
              ) : (
                <p className="empty-inline">No hint saved for this problem yet.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2 className="panel__title">Notes</h2>
            </div>
            <div className="panel__body">
              {(problem.notes || '').trim() ? (
                <p className="prose">{problem.notes}</p>
              ) : (
                <p className="empty-inline">No notes saved for this problem yet.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2 className="panel__title">Links</h2>
              <span className="pill">{links.length}</span>
            </div>
            <div className="panel__body">
              <LinksList links={links} />
            </div>
          </section>
        </div>

        <aside className="problem-layout__side">
          <section className="panel panel--flush code-panel">
            <div className="panel__head">
              <h2 className="panel__title">Solution</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={copySolution}>
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <Suspense fallback={<pre className="cm-fallback">{problem.solution || ''}</pre>}>
              <CodeEditor value={problem.solution || ''} readOnly label="Solution (read-only)" />
            </Suspense>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default OpenProblem;
