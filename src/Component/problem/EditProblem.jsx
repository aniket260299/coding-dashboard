import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Form } from 'reactstrap';
import { useData } from '../../data/DataContext';
import { decodeEscapeCharaters, getNextPosition, getRevisionNotes } from '../common/Utils';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-java';
import 'ace-builds/src-noconflict/theme-monokai';
import PageHeader from '../common/PageHeader';

const EditProblem = () => {
    const { data, upsertProblem } = useData();
    const { sheetId, topicId, problemId, sheet, topic } = useParams();
    const navigate = useNavigate();

    const topicProblems = data.problems.filter(item => item.topicId === Number(topicId));
    const existing = problemId > 0
        ? data.problems.find(item => item.id === Number(problemId))
        : undefined;

    const [form, setForm] = useState(() => existing || {
        position: problemId <= 0 ? getNextPosition(topicProblems) : 0 - Number(problemId),
        title: '',
        difficulty: '',
        link: '',
        hint: '',
        notes: getRevisionNotes(),
        solution: '',
        topicId: Number(topicId)
    });
    const [errors, setErrors] = useState({});

    const listUrl = "/problem/" + sheetId + "/" + topicId + "/" + sheet + "/" + topic;

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm({ ...form, [name]: value });
        setErrors(current => {
            if (!current[name]) return current;
            const next = { ...current };
            delete next[name];
            return next;
        });
    }

    const validateForm = () => {
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
    }

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!validateForm()) return;
        upsertProblem({
            ...form,
            title: form.title.trim(),
            position: Number(form.position),
            difficulty: Number(form.difficulty),
            topicId: Number(topicId)
        });
        navigate(listUrl);
    }

    const fieldError = (name) => errors[name]
        ? <span className="field-error" role="alert">
            <span aria-hidden="true">⚠</span>{errors[name]}
        </span>
        : null;

    return (
        <Form onSubmit={handleSubmit} className="page">
            <PageHeader
                parents={[
                    { label: 'Sheets', to: '/' },
                    { label: decodeEscapeCharaters(sheet), to: "/topic/" + sheetId + "/" + sheet },
                    { label: decodeEscapeCharaters(topic), to: listUrl }
                ]}
                title={problemId > 0 ? 'Edit problem' : 'New problem'}
                subtitle={problemId > 0
                    ? 'Update the details, notes or solution - changes are written back on Save.'
                    : 'Fill in what you know, you can always refine it later.'}
                actions={<>
                    <Link className="btn btn-ghost" to={listUrl}>Cancel</Link>
                    <button className="btn btn-primary" type="submit">
                        {problemId > 0 ? 'Save changes' : 'Create problem'}
                    </button>
                </>}
            />

            <div className="edit-layout">
                <div className="edit-layout__col">
                    <section className="panel">
                        <div className="panel__head"><h2 className="panel__title">Details</h2></div>
                        <div className="panel__body field-grid">
                            <div className="field field--full">
                                <label className="form-label" htmlFor="title">Title</label>
                                <input type="text" className="form-control"
                                    placeholder="e.g. Merge Sorted Array" name="title" id="title"
                                    value={form.title || ''} onChange={handleChange} autoComplete="title" />
                                {fieldError('title')}
                            </div>

                            <div className="field">
                                <label className="form-label" htmlFor="difficulty">Difficulty</label>
                                <select className="form-select" name="difficulty" id="difficulty"
                                    value={form.difficulty ?? ''} onChange={handleChange}>
                                    <option value="" disabled>Choose difficulty…</option>
                                    <option value="1">Easy</option>
                                    <option value="2">Medium</option>
                                    <option value="3">Hard</option>
                                </select>
                                {fieldError('difficulty')}
                            </div>

                            <div className="field">
                                <label className="form-label" htmlFor="position">Position</label>
                                <input type="number" className="form-control" placeholder="Order in the list"
                                    name="position" id="position" value={form.position ?? ''}
                                    onChange={handleChange} autoComplete="position" />
                            </div>

                            <div className="field field--full">
                                <label className="form-label" htmlFor="link">Links</label>
                                <textarea className="form-control" rows={3}
                                    placeholder={"One URL per line.\nhttps://leetcode.com/problems/..."}
                                    name="link" id="link" value={form.link || ''}
                                    onChange={handleChange} autoComplete="link" />
                            </div>

                            <div className="field field--full">
                                <label className="form-label" htmlFor="hint">Hint</label>
                                <textarea className="form-control" rows={3}
                                    placeholder="A nudge to try before looking at the solution."
                                    name="hint" id="hint" value={form.hint || ''}
                                    onChange={handleChange} autoComplete="hint" />
                            </div>
                        </div>
                    </section>

                    <section className="panel">
                        <div className="panel__head"><h2 className="panel__title">Notes</h2></div>
                        <div className="panel__body">
                            <label className="form-label" htmlFor="notes">Revision notes</label>
                            <textarea className="form-control" rows={7}
                                placeholder="What to remember next time you revisit this problem."
                                name="notes" id="notes" value={form.notes || ''}
                                onChange={handleChange} autoComplete="notes" />
                        </div>
                    </section>
                </div>

                <div className="edit-layout__code">
                    <section className="panel panel--flush code-panel">
                        <div className="panel__head">
                            <h2 className="panel__title">Solution</h2>
                            <span className="pill">Java</span>
                        </div>
                        <AceEditor
                            mode="java"
                            theme="monokai"
                            id="solution"
                            value={form.solution || ''}
                            onChange={data => handleChange({ target: { value: data, name: 'solution' } })}
                            name="solution"
                            autoComplete="solution"
                            editorProps={{ $blockScrolling: true }}
                            width="100%"
                            height="clamp(420px, 66vh, 720px)"
                            fontSize={13.5}
                            showPrintMargin={false}
                            setOptions={{ showFoldWidgets: false }}
                        />
                    </section>
                </div>
            </div>
        </Form>
    );
};

export default EditProblem;
