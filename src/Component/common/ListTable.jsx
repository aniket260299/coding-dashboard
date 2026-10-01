import { memo } from 'react';

/**
 * Lightweight table to replace AG Grid.
 * Renders a native <table> — no virtual DOM grid, no 800KB runtime.
 * Parents pass pre-sorted/filtered `rows`; this component only renders.
 */
const ListTable = memo(function ListTable({ columns, rows, getRowId, empty }) {
  if (!rows.length) {
    return <div className="table-empty">{empty}</div>;
  }
  return (
    <div className="table-scroll">
      <table className="table-host">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={col.headerClassName || ''}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)}>
              {columns.map((col) => (
                <td key={col.key} className={col.cellClassName || ''}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default ListTable;
