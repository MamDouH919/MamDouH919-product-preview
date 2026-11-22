import { Box } from "@mui/material";
import Image from "next/image";

/** A small rounded image for table rows; an empty tinted tile when there is no image. */
const Thumb = ({ src, alt, width = 48, height = 48 }: { src?: string | null; alt?: string; width?: number; height?: number }) => (
  <Box
    sx={{
      width,
      height,
      flexShrink: 0,
      borderRadius: 2,
      overflow: "hidden",
      bgcolor: "action.hover",
      border: 1,
      borderColor: "divider",
    }}
  >
    {src && (
      <Image src={src} alt={alt ?? ""} width={width} height={height} style={{ width, height, objectFit: "cover" }} loading="eager" />
    )}
  </Box>
);

export default Thumb;
