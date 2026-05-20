import { Box, CircularProgress } from "@mui/material";

const TableLoading = ({
    minHeight = "300px"
}: {
    minHeight?: string
}) => {
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                width: "100%",
                minHeight: minHeight,
                backgroundColor: "background.paper",
            }}
        >
            <CircularProgress size={32} />
        </Box>
    );
};

export default TableLoading