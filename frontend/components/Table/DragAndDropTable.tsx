import { useState, useMemo, useCallback, useEffect, CSSProperties } from "react";
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
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { styled } from "@mui/material/styles";
import EmptyTablePlaceHolderMessage from "./EmptyTablePlaceHolderMessage";
import TableLoading from "./TableLoading";

const DragHandle = (props: any) => (
  <IconButton {...props}>
    <DragIndicatorIcon />
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
    opacity: isDragging ? 0.4 : undefined,
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

const DragAndDropTable = ({ columns, data, borderRadius, height, onReorder, loading, disableDragAndDrop }: {
  columns: any[],
  data: any[],
  setData?: any,
  borderRadius?: number
  onReorder?: (newData: any[], draggedId: string) => void
  height?: string
  loading?: boolean
  disableDragAndDrop?: boolean
}) => {
  const [internalData, setInternalData] = useState(data);

  // Sync internal state when prop data changes (e.g. after fetch)
  useEffect(() => {
    setInternalData(data);
  }, [data]);

  const items = useMemo(() => internalData?.map((item) => item.id), [internalData]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor)
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
    [onReorder]
  );

  // const activeRow = useMemo(
  //   () => data.find((row) => row.id === activeId),
  //   [activeId, data]
  // );

  if (loading) return <TableLoading />;
  if (!internalData || internalData.length === 0)
    return (
      <EmptyTablePlaceHolderMessage
      />
    );
  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
        <Box
          sx={{
            flex: 1,
            overflow: "auto",
          }}
        >
          <Table stickyHeader size="small">
            <TableHead
              sx={{
                backgroundColor: (theme) => theme.palette.background.paper,
              }}
            >
              <TableRow
                sx={{
                  backgroundColor: (theme) => theme.palette.background.paper,
                }}
              >
                <TableCell
                  sx={{ backgroundColor: "background.paper" }}
                />
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    sx={{ backgroundColor: "background.paper" }}
                  >
                    {col.header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <SortableContext items={items} strategy={verticalListSortingStrategy}>
                {internalData.map((row) => (
                  <DraggableTableRow key={row.id} row={row} columns={columns}  />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </Box>
      </Paper>
    </DndContext>
  );
};

export default DragAndDropTable;
