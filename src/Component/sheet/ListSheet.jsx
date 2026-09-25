import React, { useMemo, useRef, useState } from "react";
import { Link } from 'react-router-dom';
import { AgGridReact } from "ag-grid-react";
import { useData } from "../../data/DataContext";
import { encodeEscapeCharaters, getNextPosition } from "../common/Utils";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const ListSheet = () => {
    const { data, upsertSheet, deleteSheet } = useData();
    const [drafts, setDrafts] = useState([]);
    const [editing, setEditing] = useState(false);
    const gridRef = useRef();

    const sheets = useMemo(
        () => [...data.sheets].sort((a, b) => a.position - b.position),
        [data.sheets]
    );
    const rowData = useMemo(() => [...sheets, ...drafts], [sheets, drafts]);

    const remove = (param) => {
        const confirmDelete = param.data.id
            ? window.confirm('Delete this sheet along with all of its topics and problems?')
            : window.confirm('Are you sure you want to delete this item?');
        if (!confirmDelete) return;
        if (param.data.id) {
            deleteSheet(param.data.id);
        } else {
            setDrafts(current => current.filter(draft => draft !== param.data));
        }
    };

    const addDummyRecord = () => {
        if (drafts.length > 0) return;
        setDrafts([{
            id: null,
            position: getNextPosition(sheets),
            sheet: '',
            username: data.sheets[0]?.username || ''
        }]);
    };

    const onRowValueChanged = (event) => {
        upsertSheet(event.data);
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
            ? "/topic/" + param.data.id + "/" + encodeEscapeCharaters(param.data.sheet)
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
            { field: 'sheet', flex: 1 },
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
            {editing && <Link onClick={stopEditing} className="float-end" style={{ textDecoration: 'none', color: 'blue', paddingLeft: '10px' }}>Stop Editing</Link>}
            <strong>Sheets</strong>
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
                getRowId={(params) => params.data.id ? 'sheet-' + params.data.id : 'draft-' + params.data.position}
                editType={'fullRow'}
                onRowValueChanged={onRowValueChanged}
                onCellEditingStarted={() => setEditing(true)}
            />
        </div>
    </>);
}

export default ListSheet;
