import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
} from "@mui/material";
import { useState } from "react";
import { alpha, styled } from "@mui/material/styles";
import EmptyTablePlaceHolderMessage from "./EmptyTablePlaceHolderMessage";
import TableLoading from "./TableLoading";


// export const StyledTableCell = styled(TableCell)(() => ({
//   [`&.FixedTableCell`]: {
//     whiteSpace: "normal",
//     maxWidth: "200px",
//     inlineSize: "max-content",
//     padding: "0px",
//   },
//   [`& .${classes.cellWidth}`]: {
//     whiteSpace: "normal",
//     maxWidth: "200px",
//     inlineSize: "max-content",
//     padding: "0px",
//   },
//   [`& .${classes.cellWidthAuto}`]: {
//     whiteSpace: "normal",
//     inlineSize: "max-content",
//   },
// }));

const PREFIX = "FixedTableCell";
export const classes = {
  cellWidth: `${PREFIX}-cellWidth`,
  cellWidthAuto: `${PREFIX}-cellWidthAuto`,
};

const StyledTableCell = styled(TableCell)(() => ({
  whiteSpace: "normal",
  maxWidth: "200px",
  [`&.FixedTableCell`]: {
    whiteSpace: "normal",
    maxWidth: "200px",
    inlineSize: "max-content",
    padding: "0px",
  },
  [`& .${classes.cellWidth}`]: {
    whiteSpace: "normal",
    maxWidth: "200px",
    inlineSize: "max-content",
    padding: "0px",
  },
  [`& .${classes.cellWidthAuto}`]: {
    whiteSpace: "normal",
    inlineSize: "max-content",
  },
}));

const DEFAULT_ROWS_PER_PAGE_OPTIONS = [25, 50, 100];

// Server-side pagination: the page owns the state and fetches each page itself.
// `page` is 0-based, like MUI's TablePagination.
export type SimpleTablePagination = {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  rowsPerPageOptions?: number[];
};

const SimpleTable = ({
  columns,
  data,
  borderRadius,
  height,
  loading,
  pagination,
  clientPagination,
}: {
  columns: { id: string; header: string; render?: (row: any) => React.ReactNode }[];
  data: any[];
  borderRadius?: number;
  height?: string;
  loading?: boolean;
  /** Server-side pagination. `data` is already the current page. */
  pagination?: SimpleTablePagination;
  /** Client-side pagination: `data` is the full list and the table slices it. */
  clientPagination?: boolean | { rowsPerPageOptions?: number[] };
}) => {
  const clientOptions =
    (typeof clientPagination === "object" && clientPagination.rowsPerPageOptions) ||
    DEFAULT_ROWS_PER_PAGE_OPTIONS;
  const [clientPage, setClientPage] = useState(0);
  const [clientRowsPerPage, setClientRowsPerPage] = useState(clientOptions[0]);

  const rows = data ?? [];
  const lastClientPage = Math.max(0, Math.ceil(rows.length / clientRowsPerPage) - 1);
  // The list can shrink under us (a delete, a new filter); don't strand the user on an empty page.
  const currentClientPage = Math.min(clientPage, lastClientPage);

  if (loading) return <TableLoading />;
  if (rows.length === 0) return <EmptyTablePlaceHolderMessage />;

  const useClient = !pagination && !!clientPagination;
  const visibleRows = useClient
    ? rows.slice(currentClientPage * clientRowsPerPage, (currentClientPage + 1) * clientRowsPerPage)
    : rows;

  // A short list doesn't need a pager.
  const footer: React.ComponentProps<typeof TablePagination> | null = pagination
    ? {
        count: pagination.count,
        page: pagination.page,
        rowsPerPage: pagination.rowsPerPage,
        onPageChange: (_, p) => pagination.onPageChange(p),
        onRowsPerPageChange: (e) => pagination.onRowsPerPageChange(parseInt(e.target.value, 10)),
        rowsPerPageOptions: pagination.rowsPerPageOptions ?? DEFAULT_ROWS_PER_PAGE_OPTIONS,
      }
    : useClient && rows.length > Math.min(...clientOptions)
      ? {
          count: rows.length,
          page: currentClientPage,
          rowsPerPage: clientRowsPerPage,
          onPageChange: (_, p) => setClientPage(p),
          onRowsPerPageChange: (e) => {
            setClientRowsPerPage(parseInt(e.target.value, 10));
            setClientPage(0);
          },
          rowsPerPageOptions: clientOptions,
        }
      : null;

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        overflow: "hidden",
        borderRadius: borderRadius ?? 3,
        height: height ?? "100%",
        borderColor: "divider",
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
      }}
    >
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <Table
          stickyHeader
          sx={{
            borderCollapse: "separate",
            borderSpacing: 0,
            "& .MuiTableCell-root": {
              px: 2.5,
              py: 1.75,
              borderBottom: "1px solid",
              borderColor: "divider",
            },
            "& .MuiTableHead-root .MuiTableCell-root": {
              backgroundColor: (t) => alpha(t.palette.text.primary, 0.035),
              backdropFilter: "blur(6px)",
              color: "text.secondary",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            },
            "& .MuiTableBody-root .MuiTableRow-root": {
              transition: "background-color 0.15s ease",
              "&:hover": {
                backgroundColor: (t) => alpha(t.palette.primary.main, 0.05),
              },
              "&:last-of-type .MuiTableCell-root": { borderBottom: 0 },
            },
          }}
        >
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.id}>{col.header}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row, i) => (
              <TableRow key={row.id ?? row._id ?? i}>
                {columns.map((col) => (
                  <StyledTableCell key={col.id}>
                    <div className={classes.cellWidth}>
                      {col.render ? col.render(row) : row[col.id]}
                    </div>
                  </StyledTableCell>

                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {footer && (
        <TablePagination
          component="div"
          {...footer}
          sx={{
            flexShrink: 0,
            borderTop: "1px solid",
            borderColor: "divider",
            "& .MuiTablePagination-toolbar": { minHeight: 52 },
            "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": {
              color: "text.secondary",
              fontSize: 13,
              m: 0,
            },
          }}
        />
      )}
    </Paper>
  );
};

export default SimpleTable;
