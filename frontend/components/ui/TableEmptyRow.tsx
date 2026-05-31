type TableEmptyRowProps = {
  colSpan: number;
  message: string;
};

export default function TableEmptyRow({ colSpan, message }: TableEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="table-empty-cell" role="status">
        {message}
      </td>
    </tr>
  );
}
