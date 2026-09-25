import React from 'react';
import { Link, useParams } from 'react-router-dom';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-java';
import 'ace-builds/src-noconflict/theme-chrome';
import { Table } from 'reactstrap';
import { useData } from '../../data/DataContext';
import { decodeEscapeCharaters, getDifficulty } from '../common/Utils';

function OpenProblem() {
    const { data } = useData();
    const { sheetId, topicId, problemId, sheet, topic } = useParams();

    const problem = data.problems.find(item => item.id === Number(problemId));

    if (!problem) {
        return <p className="text-muted">Problem not found. It may have been deleted - go back to the list.</p>;
    }

    const color = getDifficulty(problem.difficulty).color;

    return (<>
        <Link to="/" style={{ textDecoration: 'none', color: 'blue' }}><strong>Sheets</strong></Link>
        <Link to={"/topic/" + sheetId + "/" + sheet} style={{ textDecoration: 'none', color: 'blue' }}><strong>{" / " + decodeEscapeCharaters(sheet)}</strong></Link>
        <Link to={"/problem/" + sheetId + "/" + topicId + "/" + sheet + "/" + topic} style={{ textDecoration: 'none', color: 'blue' }}><strong>{" / " + decodeEscapeCharaters(topic)}</strong></Link> /
        <strong style={{ color: color }}>{" " + problem.title}</strong>
        <hr size="4" color="grey" />
        <div style={{ width: '50%', float: 'right' }}>
            <AceEditor
                mode="java"
                theme="chrome"
                value={problem.solution}
                readOnly={true}
                width="100%"
                height="600px"
            />
        </div>

        <div style={{ width: '50%', float: 'left', paddingRight: '20px' }}>
            <Table height='600px' bordered>
                <tbody>
                    <tr>
                        <th>Hint:</th>
                        <td>
                            {(problem.hint || '').split(/\r?\n/).map((hint, index) =>
                                <React.Fragment key={index}>
                                    {hint}
                                    <br></br>
                                </React.Fragment>
                            )}</td>
                    </tr>

                    <tr>
                        <th>Notes:</th>
                        <td>
                            {(problem.notes || '').split(/\r?\n/).map((note, index) =>
                                <React.Fragment key={index}>
                                    {note}
                                    <br></br>
                                </React.Fragment>
                            )}</td>
                    </tr>

                    <tr>
                        <th>Links:</th>
                        <td>
                            {(problem.link || '').split(/\r?\n/).filter(link => link.trim() !== '').map((link, index) =>
                                <React.Fragment key={index}>
                                    <a style={{ textDecoration: 'none', color: '#808000' }}
                                        href={link} target="_blank" rel="noreferrer">{'Link' + (index + 1) + ' '}</a>
                                </React.Fragment>
                            )}
                        </td>
                    </tr>
                </tbody>
            </Table>
        </div>
    </>);
}

export default OpenProblem;
