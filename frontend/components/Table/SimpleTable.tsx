import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  Skeleton,
  TableRow,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { alpha, styled } from "@mui/material/styles";
import Pager, { PagerProps } from "./Pager";

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
  onRowClick,
}: {
  columns: {
    id: string;
    header: string;
    render?: (row: any) => React.ReactNode;
  }[];
  data: any[];
  borderRadius?: number;
  height?: string;
  loading?: boolean;
  /** Server-side pagination. `data` is already the current page. */
  pagination?: SimpleTablePagination;
  /** Client-side pagination: `data` is the full list and the table slices it. */
  clientPagination?: boolean | { rowsPerPageOptions?: number[] };
  /** Makes rows clickable (pointer cursor + keyboard focus). */
  onRowClick?: (row: any) => void;
}) => {
  const { t } = useTranslation();
  const clientOptions =
    (typeof clientPagination === "object" &&
      clientPagination.rowsPerPageOptions) ||
    DEFAULT_ROWS_PER_PAGE_OPTIONS;
  const [clientPage, setClientPage] = useState(0);
  const [clientRowsPerPage, setClientRowsPerPage] = useState(clientOptions[0]);

  const rows = data ?? [];
  const lastClientPage = Math.max(
    0,
    Math.ceil(rows.length / clientRowsPerPage) - 1,
  );
  // The list can shrink under us (a delete, a new filter); don't strand the user on an empty page.
  const currentClientPage = Math.min(clientPage, lastClientPage);

  const useClient = !pagination && !!clientPagination;
  const visibleRows = useClient
    ? rows.slice(
        currentClientPage * clientRowsPerPage,
        (currentClientPage + 1) * clientRowsPerPage,
      )
    : rows;

  // A short list doesn't need a pager.
  const footer: PagerProps | null = pagination
    ? {
        ...pagination,
        rowsPerPageOptions:
          pagination.rowsPerPageOptions ?? DEFAULT_ROWS_PER_PAGE_OPTIONS,
      }
    : useClient && rows.length > Math.min(...clientOptions)
      ? {
          count: rows.length,
          page: currentClientPage,
          rowsPerPage: clientRowsPerPage,
          onPageChange: setClientPage,
          onRowsPerPageChange: (n) => {
            setClientRowsPerPage(n);
            setClientPage(0);
          },
          rowsPerPageOptions: clientOptions,
        }
      : null;

  const empty = !loading && rows.length === 0;

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
        boxShadow: "0 1px 3px rgba(16, 24, 40, 0.06)",
      }}
    >
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <Table
          stickyHeader
          sx={{
            borderCollapse: "separate",
            borderSpacing: 0,
            "& .MuiTableCell-root": {
              px: 2,
              py: 1.5,
              borderBottom: "1px solid",
              borderColor: "divider",
              fontSize: 13.5,
            },
            "& .MuiTableCell-root:first-of-type": { ps: 3 },
            "& .MuiTableCell-root:last-of-type": { pe: 3 },
            "& .MuiTableHead-root .MuiTableCell-root": {
              backgroundColor: "background.paper",
              color: "text.secondary",
              fontSize: 12.5,
              fontWeight: 600,
              whiteSpace: "nowrap",
              py: 1.25,
              borderBottom: "2px solid",
              borderColor: "divider",
            },
            "& .MuiTableBody-root .MuiTableRow-root": {
              transition: "background-color 0.12s ease",
              "&:hover": {
                backgroundColor: (t) => alpha(t.palette.primary.main, 0.045),
              },
              "&:last-of-type .MuiTableCell-root": { borderBottom: 0 },
              ...(onRowClick && {
                cursor: "pointer",
                "&:focus-visible": {
                  outline: (t) => `2px solid ${t.palette.primary.main}`,
                  outlineOffset: -2,
                },
              }),
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
            {loading
              ? Array.from({ length: 8 }).map((_, r) => (
                  <TableRow key={`sk${r}`}>
                    {columns.map((col) => (
                      <TableCell key={col.id}>
                        {col.header ? (
                          <Skeleton
                            variant="text"
                            width={`${55 + ((r * 7 + col.id.length * 11) % 40)}%`}
                          />
                        ) : null}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : visibleRows.map((row, i) => (
                  <TableRow
                    key={row.id ?? row._id ?? i}
                    hover={false}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={
                      onRowClick
                        ? (e) => {
                            // Buttons and links inside a row keep their own behaviour.
                            if (
                              (e.target as HTMLElement).closest(
                                "button, a, input, [role=button]",
                              )
                            )
                              return;
                            onRowClick(row);
                          }
                        : undefined
                    }
                    onKeyDown={
                      onRowClick
                        ? (e) => e.key === "Enter" && onRowClick(row)
                        : undefined
                    }
                  >
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
        {empty && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 260,
              height: "calc(100% - 48px)",
              color: "text.disabled",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            {t("noResult")}
          </Box>
        )}
      </Box>
      {footer && !loading && <Pager {...footer} />}
    </Paper>
  );
};

export default SimpleTable;
