/** Saves a Blob (or text) as a file through a temporary link. */
export function downloadFile(data: Blob | string, filename: string, type = "text/csv;charset=utf-8") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** "orders-2026-10-20.csv" */
export const datedFilename = (prefix: string, ext = "csv") =>
  `${prefix}-${new Date().toISOString().slice(0, 10)}.${ext}`;
