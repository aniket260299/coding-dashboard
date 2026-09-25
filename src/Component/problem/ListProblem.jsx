import React, { useMemo, useRef } from "react";
import { Link, useParams } from 'react-router-dom';
import { AgGridReact } from "ag-grid-react";
import { useData } from "../../data/DataContext";
import { decodeEscapeCharaters, getDifficulty, getNextPosition } from "../common/Utils";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

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
        const confirmDelete = window.confirm('Are you sure you want to delete this item?');
        if (!confirmDelete) return;
        deleteProblem(param.data.id);
    };

    const Action = (param) => {
        const suffix = sheetId + "/" + topicId + "/" + param.data.id + "/" + sheet + "/" + topic;
        return <>
            <Link to={"/problem/open/" + suffix} style={{ textDecoration: 'none', color: 'green' }}> Open </Link>
            <Link to={"/problem/edit/" + suffix} style={{ textDecoration: 'none', color: 'blue', padding: '10%' }}> Edit </Link>
            <Link onClick={() => remove(param)} style={{ textDecoration: 'none', color: 'red' }}> Delete </Link>
        </>
    }

    const Title = (item) => {
        const firstLink = (item.data.link || '').split(/\r?\n/)[0];
        return (
            <a style={{ textDecoration: 'none', color: '#36454F' }}
                href={firstLink} target="_blank" rel="noreferrer">{item.data.title}</a>
        );
    }

    const Difficulty = (item) => {
        const { label, color } = getDifficulty(item.data.difficulty);
        return <p style={{ color: color }}>{label}</p>;
    }

    const gridOptions = {
        columnDefs: [
            { headerName: '#', field: 'position', sort: 'asc' },
            { headerName: 'Title', cellRenderer: Title, flex: 1 },
            { headerName: 'Difficulty', cellRenderer: Difficulty },
            {
                headerName: 'Action',
                cellRenderer: Action,
                editable: false
            }
        ],

        defaultColDef: {
            suppressMovable: true,
            resizable: true,
        }
    }

    return (<>
        <>
            <Link to={"/problem/edit/" + sheetId + "/" + topicId + "/" + (0 - getNextPosition(rowData)) + "/" + sheet + "/" + topic} className="float-end" style={{ textDecoration: 'none', color: 'black', paddingLeft: '10px' }}>Add Record</Link>

            <Link to="/" style={{ textDecoration: 'none', color: 'blue' }}><strong>Sheets</strong></Link>
            <Link to={"/topic/" + sheetId + "/" + sheet} style={{ textDecoration: 'none', color: 'blue' }}><strong>{" / " + decodeEscapeCharaters(sheet)}</strong></Link>
            <strong>{" / " + decodeEscapeCharaters(topic)}</strong>
            <hr size="4" color="grey" />
        </>

        <div className="ag-theme-alpine" style={{ height: 600 }}>
            <AgGridReact
                ref={gridRef}
                rowData={rowData}
                columnDefs={gridOptions.columnDefs}
                defaultColDef={gridOptions.defaultColDef}
                suppressMenuHide={true}
                animateRows={true}
                getRowId={(params) => 'problem-' + params.data.id}
            />
        </div>
    </>);
}

export default ListProblem;
