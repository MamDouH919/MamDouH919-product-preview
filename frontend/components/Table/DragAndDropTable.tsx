import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  CSSProperties,
} from "react";
import {
  DndContext,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Skeleton,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { alpha, styled } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

const DragHandle = (props: any) => (
  <IconButton
    size="small"
    {...props}
    sx={{ cursor: "grab", color: "text.disabled", touchAction: "none" }}
  >
    <DragIndicatorIcon fontSize="small" />
  </IconButton>
);

const PREFIX = "FixedTableCell";

export const classes = {
  cellWidth: `${PREFIX}-cellWidth`,
  cellWidthAuto: `${PREFIX}-cellWidthAuto`,
};

export const StyledTableCell = styled(TableCell)(() => ({
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

const DraggableTableRow = ({ row, columns, disableDragAndDrop }: any) => {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: row.id, disabled: disableDragAndDrop });

  const style: CSSProperties = {
    opacity: isDragging ? 0.5 : undefined,
    position: "relative",
    zIndex: isDragging ? 1 : undefined,
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes}>
      <TableCell {...(disableDragAndDrop ? {} : listeners)}>
        <DragHandle disabled={disableDragAndDrop} />
      </TableCell>
      {columns.map((col: any) => (
        <StyledTableCell key={col.id}>
          <div className="FixedTableCell-cellWidth">
            {col.render ? col.render(row) : row[col.id]}
          </div>
        </StyledTableCell>
      ))}
    </TableRow>
  );
};

const DragAndDropTable = ({
  columns,
  data,
  borderRadius,
  height,
  onReorder,
  loading,
  disableDragAndDrop,
}: {
  columns: any[];
  data: any[];
  setData?: any;
  borderRadius?: number;
  onReorder?: (newData: any[], draggedId: string) => void;
  height?: string;
  loading?: boolean;
  disableDragAndDrop?: boolean;
}) => {
  const { t } = useTranslation();
  const [internalData, setInternalData] = useState(data);

  // Sync internal state when prop data changes (e.g. after fetch)
  useEffect(() => {
    setInternalData(data);
  }, [data]);

  const items = useMemo(
    () => internalData?.map((item) => item.id),
    [internalData],
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback(({ active }: any) => {
    // setActiveId(active.id);
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }: any) => {
      if (over && active.id !== over.id) {
        setInternalData((prev) => {
          const oldIndex = prev.findIndex((item: any) => item.id === active.id);
          const newIndex = prev.findIndex((item: any) => item.id === over.id);
          const reordered = arrayMove(prev, oldIndex, newIndex);
          onReorder?.(reordered, active.id);
          return reordered;
        });
      }
      // setActiveId(null);
    },
    [onReorder],
  );

  // const activeRow = useMemo(
  //   () => data.find((row) => row.id === activeId),
  //   [activeId, data]
  // );

  const empty = !loading && (!internalData || internalData.length === 0);

  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
                fontSize: 13.5,
                borderBottom: "1px solid",
                borderColor: "divider",
              },
              "& .MuiTableCell-root:first-of-type": { ps: 2, width: 48 },
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
                  backgroundColor: (th) =>
                    alpha(th.palette.primary.main, 0.045),
                },
                "&:last-of-type .MuiTableCell-root": { borderBottom: 0 },
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell />
                {columns.map((col) => (
                  <TableCell key={col.id}>{col.header}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, r) => (
                  <TableRow key={`sk${r}`}>
                    <TableCell />
                    {columns.map((col) => (
                      <TableCell key={col.id}>
                        {col.header ? (
                          <Skeleton variant="text" width="60%" />
                        ) : null}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <SortableContext
                  items={items ?? []}
                  strategy={verticalListSortingStrategy}
                >
                  {(internalData ?? []).map((row) => (
                    <DraggableTableRow
                      key={row.id}
                      row={row}
                      columns={columns}
                      disableDragAndDrop={disableDragAndDrop}
                    />
                  ))}
                </SortableContext>
              )}
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
      </Paper>
    </DndContext>
  );
};

export default DragAndDropTable;
