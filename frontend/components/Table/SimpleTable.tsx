import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import EmptyTablePlaceHolderMessage from "./EmptyTablePlaceHolderMessage";
import TableLoading from "./TableLoading";

const StyledTableCell = styled(TableCell)(() => ({
  whiteSpace: "normal",
  maxWidth: "200px",
}));

const SimpleTable = ({
  columns,
  data,
  borderRadius,
  height,
  loading,
}: {
  columns: { id: string; header: string; render?: (row: any) => React.ReactNode }[];
  data: any[];
  borderRadius?: number;
  height?: string;
  loading?: boolean;
}) => {
  if (loading) return <TableLoading />;
  if (!data || data.length === 0) return <EmptyTablePlaceHolderMessage />;

  return (
    <Paper
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        overflow: "hidden",
        borderRadius: borderRadius ?? 0,
        height: height ?? "100%",
      }}
    >
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.id} sx={{ backgroundColor: "background.paper" }}>
                  {col.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={row.id ?? row._id ?? i}>
                {columns.map((col) => (
                  <StyledTableCell key={col.id}>
                    {col.render ? col.render(row) : row[col.id]}
                  </StyledTableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
};

export default SimpleTable;
