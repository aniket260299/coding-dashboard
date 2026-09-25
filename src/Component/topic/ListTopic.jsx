import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AgGridReact } from "ag-grid-react";
import { useData } from "../../data/DataContext";
import { decodeEscapeCharaters, encodeEscapeCharaters, getNextPosition, gridHeightForRows } from "../common/Utils";
import PageHeader from "../common/PageHeader";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const NO_ROWS = '<span class="grid-empty">No topics in this sheet yet — use <b>New topic</b> to add one.</span>';

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
            : window.confirm('Remove this unsaved row?');
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
            { headerName: 'Topic', field: 'topic', flex: 1, minWidth: 220 },
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
                parents={[{ label: 'Sheets', to: '/' }]}
                title={decodeEscapeCharaters(sheet)}
                subtitle={topics.length
                    ? `${topics.length} topic${topics.length === 1 ? '' : 's'} in this sheet · double-click a cell to edit`
                    : 'No topics in this sheet yet.'}
                actions={<>
                    {editing && <button type="button" className="btn btn-ghost" onClick={stopEditing}>
                        Stop editing
                    </button>}
                    <button type="button" className="btn btn-primary" onClick={addDummyRecord}
                        disabled={drafts.length > 0}>
                        + New topic
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
                        getRowId={(params) => params.data.id ? 'topic-' + params.data.id : 'draft-' + params.data.position}
                        editType={'fullRow'}
                        onRowValueChanged={onRowValueChanged}
                        onCellEditingStarted={() => setEditing(true)}
                    />
                </div>
            </div>
        </div>
    );
}

export default ListTopic;
