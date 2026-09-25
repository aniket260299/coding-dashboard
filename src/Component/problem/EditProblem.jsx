import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Form, FormGroup, Input, Label, Button } from 'reactstrap';
import { useData } from '../../data/DataContext';
import { decodeEscapeCharaters, getNextPosition, getRevisionNotes } from '../common/Utils';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-java';
import 'ace-builds/src-noconflict/theme-chrome';

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

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm({ ...form, [name]: value });
    }

    const validateForm = () => {
        if (isNaN(form.difficulty) || form.difficulty < 1 || form.difficulty > 3) {
            alert('Please enter difficulty in integer between [1-3]');
            setForm({ ...form, difficulty: '' });
            return false;
        }
        return true;
    }

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!validateForm()) return;
        upsertProblem({
            ...form,
            position: Number(form.position),
            difficulty: Number(form.difficulty),
            topicId: Number(topicId)
        });
        navigate("/problem/" + sheetId + "/" + topicId + "/" + sheet + "/" + topic);
    }

    return (
        <div>
            <Form onSubmit={handleSubmit}>
                <FormGroup>
                    <Button className="float-end" type="submit">Save</Button>
                </FormGroup>
                <Link to="/" style={{ textDecoration: 'none', color: 'blue' }}><strong>Sheets</strong></Link>
                <Link to={"/topic/" + sheetId + "/" + sheet} style={{ textDecoration: 'none', color: 'blue' }}><strong>{" / " + decodeEscapeCharaters(sheet)}</strong></Link>
                <Link to={"/problem/" + sheetId + "/" + topicId + "/" + sheet + "/" + topic} style={{ textDecoration: 'none', color: 'blue' }}><strong>{" / " + decodeEscapeCharaters(topic)}</strong></Link> /
                <strong>{problemId > 0 ? ' Edit Problem' : ' Add Problem'}</strong>
                <hr size="4" color="grey" />
                <div style={{ width: '50%', float: 'right' }}>
                    <FormGroup>
                        <Label for="solution">Solution</Label>
                        <AceEditor
                            mode="java"
                            theme="chrome"
                            id="solution"
                            value={form.solution || ''}
                            onChange={data => handleChange({ target: { value: data, name: 'solution' } })}
                            name="solution"
                            autoComplete="solution"
                            editorProps={{ $blockScrolling: true }}
                            width="100%"
                            height="560px"
                        />
                    </FormGroup>
                </div>

                <div style={{ width: '50%', float: 'left', paddingRight: '20px' }}>
                    <FormGroup>
                        <Label for="title">Title</Label>
                        <Input type="text" placeholder="Please enter question's title" name="title" id="title" value={form.title || ''}
                            onChange={handleChange} autoComplete="title" />
                    </FormGroup>
                    <FormGroup>
                        <Label for="link">Link</Label>
                        <Input type="textarea" placeholder="Please enter link. Multiple links can be added in new line." name="link" id="link" value={form.link || ''}
                            onChange={handleChange} autoComplete="link" />
                    </FormGroup>
                    <FormGroup>
                        <Label for="hint">Hint</Label>
                        <Input type="textarea" placeholder="Please enter hints." name="hint" id="hint" value={form.hint || ''}
                            onChange={handleChange} autoComplete="hint" />
                    </FormGroup>
                    <FormGroup>
                        <Label for="difficulty">Difficulty</Label>
                        <Input type="text" placeholder="Please enter difficulty in integer between [1-3]" name="difficulty" id="difficulty" value={form.difficulty || ''}
                            onChange={handleChange} autoComplete="difficulty" />
                    </FormGroup>
                    <FormGroup>
                        <Label for="notes">Notes</Label>
                        <Input type="textarea" placeholder="Please enter notes." name="notes" id="notes" value={form.notes || ''}
                            onChange={handleChange} autoComplete="notes" />
                    </FormGroup>
                    <FormGroup>
                        <Label for="position">Position</Label>
                        <Input type="text" placeholder="Please enter position" name="position" id="position" value={form.position ?? ''}
                            onChange={handleChange} autoComplete="position" />
                    </FormGroup>
                </div>
            </Form>
        </div>
    );
};

export default EditProblem;
