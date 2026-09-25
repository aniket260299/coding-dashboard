import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-java';
import 'ace-builds/src-noconflict/theme-monokai';
import { useData } from '../../data/DataContext';
import { decodeEscapeCharaters } from '../common/Utils';
import DifficultyBadge from '../common/DifficultyBadge';
import PageHeader from '../common/PageHeader';

function OpenProblem() {
    const { data } = useData();
    const { sheetId, topicId, problemId, sheet, topic } = useParams();
    const [copied, setCopied] = useState(false);

    const problem = data.problems.find(item => item.id === Number(problemId));

    if (!problem) {
        return (
            <div className="page">
                <PageHeader parents={[{ label: 'Sheets', to: '/' }]} title="Problem not found" />
                <div className="panel">
                    <div className="panel__body">
                        <p className="empty-inline">
                            It may have been deleted - go back to the list to pick another one.
                        </p>
                        <Link className="btn btn-ghost"
                            to={"/problem/" + sheetId + "/" + topicId + "/" + sheet + "/" + topic}>
                            Back to problems
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const links = (problem.link || '')
        .split(/\r?\n/)
        .map(link => link.trim())
        .filter(Boolean);

    const copySolution = async () => {
        try {
            await navigator.clipboard.writeText(problem.solution || '');
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch (copyError) {
            console.warn('clipboard unavailable:', copyError);
        }
    };

    return (
        <div className="page">
            <PageHeader
                parents={[
                    { label: 'Sheets', to: '/' },
                    { label: decodeEscapeCharaters(sheet), to: "/topic/" + sheetId + "/" + sheet },
                    { label: decodeEscapeCharaters(topic), to: "/problem/" + sheetId + "/" + topicId + "/" + sheet + "/" + topic }
                ]}
                title={problem.title || 'Untitled problem'}
                badge={<DifficultyBadge level={problem.difficulty} />}
                subtitle={links.length
                    ? `${links.length} reference link${links.length === 1 ? '' : 's'} · solution in read-only mode`
                    : 'Solution in read-only mode'}
                actions={<>
                    {links[0] && <a className="btn btn-ghost" href={links[0]} target="_blank" rel="noreferrer">
                        Open link ↗
                    </a>}
                    <Link className="btn btn-primary"
                        to={"/problem/edit/" + sheetId + "/" + topicId + "/" + problemId + "/" + sheet + "/" + topic}>
                        Edit
                    </Link>
                </>}
            />

            <div className="problem-layout">
                <div className="problem-layout__main">
                    <section className="panel">
                        <div className="panel__head"><h2 className="panel__title">Hint</h2></div>
                        <div className="panel__body">
                            {(problem.hint || '').trim()
                                ? <p className="prose">{problem.hint}</p>
                                : <p className="empty-inline">No hint saved for this problem yet.</p>}
                        </div>
                    </section>

                    <section className="panel">
                        <div className="panel__head"><h2 className="panel__title">Notes</h2></div>
                        <div className="panel__body">
                            {(problem.notes || '').trim()
                                ? <p className="prose">{problem.notes}</p>
                                : <p className="empty-inline">No notes saved for this problem yet.</p>}
                        </div>
                    </section>

                    <section className="panel">
                        <div className="panel__head">
                            <h2 className="panel__title">Links</h2>
                            <span className="pill">{links.length}</span>
                        </div>
                        <div className="panel__body">
                            {links.length
                                ? <ul className="links-list">
                                    {links.map((link, index) => (
                                        <li key={index}>
                                            <a href={link} target="_blank" rel="noreferrer">
                                                <span className="links-list__body">
                                                    <span className="links-list__label">Link {index + 1}</span>
                                                    <span className="links-list__url">{link}</span>
                                                </span>
                                                <span className="links-list__arrow" aria-hidden="true">↗</span>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                                : <p className="empty-inline">No links saved for this problem yet.</p>}
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
                        <AceEditor
                            mode="java"
                            theme="monokai"
                            value={problem.solution}
                            readOnly={true}
                            width="100%"
                            height="clamp(360px, 60vh, 640px)"
                            fontSize={13.5}
                            showPrintMargin={false}
                            setOptions={{
                                highlightActiveLine: false,
                                showFoldWidgets: false
                            }}
                        />
                    </section>
                </aside>
            </div>
        </div>
    );
}

export default OpenProblem;
