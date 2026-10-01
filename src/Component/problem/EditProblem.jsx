import { Suspense, lazy, memo, useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../data/DataContext';
import { getNextPosition, getRevisionNotes, routes } from '../common/Utils';
import PageHeader from '../common/PageHeader';

const CodeEditor = lazy(() => import('../common/CodeEditor'));

const FieldError = memo(function FieldError({ message }) {
  if (!message) return null;
  return (
    <span className="field-error" role="alert">
      <span aria-hidden="true">⚠</span>
      {message}
    </span>
  );
});

const EditProblem = () => {
  const { problemsById, problemsByTopic, sheetsById, topicsById, upsertProblem } = useData();
  const { sheetId, topicId, problemId } = useParams();
  const navigate = useNavigate();

  const numericSheetId = Number(sheetId);
  const numericTopicId = Number(topicId);
  // New-style: "new". Legacy-style: negative position trick or 0.
  const isNew = problemId === 'new' || Number(problemId) <= 0;
  const numericProblemId = isNew ? 0 : Number(problemId);

  const topicProblems = problemsByTopic?.get(numericTopicId) ?? [];
  const existing = isNew ? undefined : problemsById?.get(numericProblemId);

  const [form, setForm] = useState(
    () =>
      existing || {
        position: getNextPosition(topicProblems),
        title: '',
        difficulty: '',
        link: '',
        hint: '',
        notes: getRevisionNotes(),
        solution: '',
        topicId: numericTopicId,
      },
  );
  const [errors, setErrors] = useState({});

  const listUrl = routes.problems(numericSheetId, numericTopicId);
  const sheet = sheetsById?.get(numericSheetId);
  const topic = topicsById?.get(numericTopicId);

  const crumbs = useMemo(
    () => [
      { label: 'Sheets', to: routes.sheets() },
      { label: sheet ? sheet.sheet : `Sheet ${numericSheetId}`, to: routes.topics(numericSheetId) },
      { label: topic ? topic.topic : `Topic ${numericTopicId}`, to: listUrl },
    ],
    [sheet, topic, numericSheetId, numericTopicId, listUrl],
  );

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setForm((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  const handleSolutionChange = useCallback(
    (value) => {
      setForm((prev) => (prev.solution === value ? prev : { ...prev, solution: value }));
    },
    [],
  );

  const validateForm = useCallback(() => {
    const next = {};
    if (!(form.title || '').trim()) {
      next.title = 'Give this problem a title so you can find it later.';
    }
    const difficulty = Number(form.difficulty);
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 3) {
      next.difficulty = 'Pick a difficulty: Easy, Medium or Hard.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form.title, form.difficulty]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validateForm()) return;
    upsertProblem({
      ...form,
      id: isNew ? 0 : numericProblemId,
      title: form.title.trim(),
      position: Number(form.position) || getNextPosition(topicProblems),
      difficulty: Number(form.difficulty),
      topicId: numericTopicId,
    });
    navigate(listUrl);
  };

  return (
    <form onSubmit={handleSubmit} className="page">
      <PageHeader
        parents={crumbs}
        title={isNew ? 'New problem' : 'Edit problem'}
        subtitle={
          isNew
            ? 'Fill in what you know, you can always refine it later.'
            : 'Update the details, notes or solution - changes are written back on Save.'
        }
        actions={
          <>
            <Link className="btn btn-ghost" to={listUrl}>
              Cancel
            </Link>
            <button className="btn btn-primary" type="submit">
              {isNew ? 'Create problem' : 'Save changes'}
            </button>
          </>
        }
      />

      <div className="edit-layout">
        <div className="edit-layout__col">
          <section className="panel">
            <div className="panel__head">
              <h2 className="panel__title">Details</h2>
            </div>
            <div className="panel__body field-grid">
              <div className="field field--full">
                <label className="form-label" htmlFor="title">
                  Title
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Merge Sorted Array"
                  name="title"
                  id="title"
                  value={form.title || ''}
                  onChange={handleChange}
                  autoComplete="off"
                />
                <FieldError message={errors.title} />
              </div>

              <div className="field">
                <label className="form-label" htmlFor="difficulty">
                  Difficulty
                </label>
                <select
                  className="form-select"
                  name="difficulty"
                  id="difficulty"
                  value={form.difficulty ?? ''}
                  onChange={handleChange}
                >
                  <option value="" disabled>
                    Choose difficulty…
                  </option>
                  <option value="1">Easy</option>
                  <option value="2">Medium</option>
                  <option value="3">Hard</option>
                </select>
                <FieldError message={errors.difficulty} />
              </div>

              <div className="field">
                <label className="form-label" htmlFor="position">
                  Position
                </label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Order in the list"
                  name="position"
                  id="position"
                  value={form.position ?? ''}
                  onChange={handleChange}
                  autoComplete="off"
                />
              </div>

              <div className="field field--full">
                <label className="form-label" htmlFor="link">
                  Links
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder={'One URL per line.\nhttps://leetcode.com/problems/...'}
                  name="link"
                  id="link"
                  value={form.link || ''}
                  onChange={handleChange}
                  autoComplete="off"
                />
              </div>

              <div className="field field--full">
                <label className="form-label" htmlFor="hint">
                  Hint
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="A nudge to try before looking at the solution."
                  name="hint"
                  id="hint"
                  value={form.hint || ''}
                  onChange={handleChange}
                  autoComplete="off"
                />
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2 className="panel__title">Notes</h2>
            </div>
            <div className="panel__body">
              <label className="form-label" htmlFor="notes">
                Revision notes
              </label>
              <textarea
                className="form-control"
                rows={7}
                placeholder="What to remember next time you revisit this problem."
                name="notes"
                id="notes"
                value={form.notes || ''}
                onChange={handleChange}
                autoComplete="off"
              />
            </div>
          </section>
        </div>

        <div className="edit-layout__code">
          <section className="panel panel--flush code-panel">
            <div className="panel__head">
              <h2 className="panel__title">Solution</h2>
              <span className="pill">Java</span>
            </div>
            <Suspense fallback={<pre className="cm-fallback">{form.solution || ''}</pre>}>
              <CodeEditor value={form.solution || ''} onChange={handleSolutionChange} label="Solution" />
            </Suspense>
          </section>
        </div>
      </div>
    </form>
  );
};

export default EditProblem;
