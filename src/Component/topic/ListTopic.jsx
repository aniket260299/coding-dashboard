import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AgGridReact } from "ag-grid-react";
import { useData } from "../../data/DataContext";
import { decodeEscapeCharaters, encodeEscapeCharaters, getNextPosition } from "../common/Utils";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const ListTopic = () => {
    const { data, upsertTopic, deleteTopic } = useData();
    const [drafts, setDrafts] = useState([]);
    const [editing, setEditing] = useState(false);
    const { sheetId, sheet } = useParams();
    const gridRef = useRef();
    const navigate = useNavigate();

    useEffect(() => {
        if (!sheetId) navigate("/");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const topics = useMemo(() => {
        const id = Number(sheetId);
        return data.topics
            .filter(topic => topic.sheetId === id)
            .sort((a, b) => a.position - b.position);
    }, [data.topics, sheetId]);

    const rowData = useMemo(() => [...topics, ...drafts], [topics, drafts]);

    const remove = (param) => {
        const confirmDelete = param.data.id
            ? window.confirm('Delete this topic along with all of its problems?')
            : window.confirm('Are you sure you want to delete this item?');
        if (!confirmDelete) return;
        if (param.data.id) {
            deleteTopic(param.data.id);
        } else {
            setDrafts(current => current.filter(draft => draft !== param.data));
        }
    };

    const addDummyRecord = () => {
        if (drafts.length > 0) return;
        setDrafts([{
            id: null,
            position: getNextPosition(topics),
            topic: '',
            sheetId: Number(sheetId)
        }]);
    };

    const onRowValueChanged = (event) => {
        upsertTopic({ ...event.data, sheetId: Number(sheetId) });
        setDrafts([]);
        setEditing(false);
    };

    const startEditButton = (data) => {
        gridRef.current.api.setFocusedCell(data.node.rowIndex, 'position');
        gridRef.current.api.startEditingCell({
            rowIndex: data.node.rowIndex,
            colKey: 'position',
        });
    };

    const stopEditing = () => {
        gridRef.current.api.stopEditing();
        setEditing(false);
    };

    const Action = (param) => {
        const openURL = param?.data?.id
            ? "/problem/" + sheetId + "/" + param.data.id + "/" + sheet + "/" + encodeEscapeCharaters(param.data.topic)
            : "/";
        return <>
            <Link to={openURL} style={{ textDecoration: 'none', color: 'green' }}> Open </Link>
            <Link onClick={() => startEditButton(param)} style={{ textDecoration: 'none', color: 'blue', padding: '10%' }}> Edit </Link>
            <Link onClick={() => remove(param)} style={{ textDecoration: 'none', color: 'red' }}> Delete </Link>
        </>
    }

    const gridOptions = {
        columnDefs: [
            { headerName: '#', field: 'position', sort: 'asc' },
            { field: 'topic', flex: 1 },
            {
                headerName: 'Action',
                cellRenderer: Action,
                editable: false
            }
        ],

        defaultColDef: {
            suppressMovable: true,
            resizable: true,
            editable: true,
        }
    }

    return (<>
        <>
            <Link onClick={addDummyRecord} className="float-end" style={{ textDecoration: 'none', color: 'black', paddingLeft: '10px' }}>Add Record</Link>
            {editing &&
                <Link onClick={stopEditing} className="float-end" style={{ textDecoration: 'none', color: 'blue' }}>Stop Editing</Link>}
            <Link to="/" style={{ textDecoration: 'none', color: 'blue' }}><strong>Sheets</strong></Link>
            <strong>{" / " + decodeEscapeCharaters(sheet)}</strong>
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
                getRowId={(params) => params.data.id ? 'topic-' + params.data.id : 'draft-' + params.data.position}
                editType={'fullRow'}
                onRowValueChanged={onRowValueChanged}
                onCellEditingStarted={() => setEditing(true)}
            />
        </div>
    </>);
}

export default ListTopic;
