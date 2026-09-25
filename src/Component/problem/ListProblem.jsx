import React, { useMemo, useRef } from "react";
import { Link, useParams } from 'react-router-dom';
import { AgGridReact } from "ag-grid-react";
import { useData } from "../../data/DataContext";
import { decodeEscapeCharaters, getNextPosition, gridHeightForRows } from "../common/Utils";
import DifficultyBadge from "../common/DifficultyBadge";
import PageHeader from "../common/PageHeader";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const NO_ROWS = '<span class="grid-empty">No problems in this topic yet — use <b>New problem</b> to add one.</span>';

const ListProblem = () => {
    const { data, deleteProblem } = useData();
    const { sheetId, topicId, sheet, topic } = useParams();
    const gridRef = useRef();

    const rowData = useMemo(() => {
        const id = Number(topicId);
        return data.problems
            .filter(problem => problem.topicId === id)
            .sort((a, b) => a.position - b.position);
    }, [data.problems, topicId]);

    const remove = (param) => {
        const confirmDelete = window.confirm('Delete this problem? This cannot be undone.');
        if (!confirmDelete) return;
        deleteProblem(param.data.id);
    };

    const Action = (param) => {
        const suffix = sheetId + "/" + topicId + "/" + param.data.id + "/" + sheet + "/" + topic;
        return <div className="action-cell">
            <Link to={"/problem/open/" + suffix} className="action-cell__btn action-cell__btn--open">Open</Link>
            <Link to={"/problem/edit/" + suffix} className="action-cell__btn action-cell__btn--edit">Edit</Link>
            <button type="button" className="action-cell__btn action-cell__btn--danger"
                onClick={() => remove(param)}>Delete</button>
        </div>;
    }

    const Title = (item) => {
        const firstLink = (item.data.link || '').split(/\r?\n/)[0];
        if (!firstLink) return <span className="link-cell link-cell--plain" title={item.data.title}>{item.data.title}</span>;
        return (
            <a className="link-cell" href={firstLink} target="_blank" rel="noreferrer"
                title={item.data.title}>
                {item.data.title}
            </a>
        );
    }

    const Difficulty = (item) => <DifficultyBadge level={item.data.difficulty} />;

    const gridOptions = {
        columnDefs: [
            { headerName: '#', field: 'position', sort: 'asc', width: 90 },
            { headerName: 'Title', cellRenderer: Title, flex: 1, minWidth: 240 },
            { headerName: 'Difficulty', cellRenderer: Difficulty, cellClass: 'cell-centered', width: 140, editable: false },
            {
                headerName: 'Action',
                cellRenderer: Action,
                editable: false,
                width: 230,
                minWidth: 230,
                maxWidth: 230
            }
        ],

        defaultColDef: {
            suppressMovable: true,
            resizable: true,
        }
    }

    return (
        <div className="page">
            <PageHeader
                parents={[
                    { label: 'Sheets', to: '/' },
                    { label: decodeEscapeCharaters(sheet), to: "/topic/" + sheetId + "/" + sheet }
                ]}
                title={decodeEscapeCharaters(topic)}
                subtitle={rowData.length
                    ? `${rowData.length} problem${rowData.length === 1 ? '' : 's'} · click a title to open it in a new tab`
                    : 'Track your practice problems here.'}
                actions={<Link className="btn btn-primary"
                    to={"/problem/edit/" + sheetId + "/" + topicId + "/" + (0 - getNextPosition(rowData)) + "/" + sheet + "/" + topic}>
                    + New problem
                </Link>}
            />

            <div className="panel panel--flush">
                <div className="ag-theme-alpine grid-host"
                    style={{ height: gridHeightForRows(rowData.length) }}>
                    <AgGridReact
                        ref={gridRef}
                        rowData={rowData}
                        columnDefs={gridOptions.columnDefs}
                        defaultColDef={gridOptions.defaultColDef}
                        suppressMenuHide={true}
                        animateRows={true}
                        overlayNoRowsTemplate={NO_ROWS}
                        getRowId={(params) => 'problem-' + params.data.id}
                    />
                </div>
            </div>
        </div>
    );
}

export default ListProblem;
