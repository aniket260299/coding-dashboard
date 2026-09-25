import React, { useMemo, useRef, useState } from "react";
import { Link } from 'react-router-dom';
import { AgGridReact } from "ag-grid-react";
import { useData } from "../../data/DataContext";
import { encodeEscapeCharaters, getNextPosition, gridHeightForRows } from "../common/Utils";
import PageHeader from "../common/PageHeader";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const NO_ROWS = '<span class="grid-empty">No sheets yet — use <b>New sheet</b> to add your first one.</span>';

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
            : window.confirm('Remove this unsaved row?');
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
        return <div className="action-cell">
            <Link to={openURL} className="action-cell__btn action-cell__btn--open">Open</Link>
            <button type="button" className="action-cell__btn action-cell__btn--edit"
                onClick={() => startEditButton(param)}>Edit</button>
            <button type="button" className="action-cell__btn action-cell__btn--danger"
                onClick={() => remove(param)}>Delete</button>
        </div>;
    }

    const gridOptions = {
        columnDefs: [
            { headerName: '#', field: 'position', sort: 'asc', width: 90 },
            { headerName: 'Sheet', field: 'sheet', flex: 1, minWidth: 220 },
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
            editable: true,
        }
    }

    return (
        <div className="page">
            <PageHeader
                title="Sheets"
                subtitle={sheets.length
                    ? `${sheets.length} sheet${sheets.length === 1 ? '' : 's'} · double-click a cell to edit it inline`
                    : 'Group your problems into sheets, one step at a time.'}
                actions={<>
                    {editing && <button type="button" className="btn btn-ghost" onClick={stopEditing}>
                        Stop editing
                    </button>}
                    <button type="button" className="btn btn-primary" onClick={addDummyRecord}
                        disabled={drafts.length > 0}>
                        + New sheet
                    </button>
                </>}
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
                        getRowId={(params) => params.data.id ? 'sheet-' + params.data.id : 'draft-' + params.data.position}
                        editType={'fullRow'}
                        onRowValueChanged={onRowValueChanged}
                        onCellEditingStarted={() => setEditing(true)}
                    />
                </div>
            </div>
        </div>
    );
}

export default ListSheet;
