export function isImageFilename(name: string | null | undefined): boolean {
  if (!name) return false;
  const l = name.toLowerCase();
  return l.endsWith(".jpg") || l.endsWith(".jpeg") || l.endsWith(".png") || l.endsWith(".webp");
}

export function isPdfFilename(name: string | null | undefined): boolean {
  return !!name && name.toLowerCase().endsWith(".pdf");
}

export function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith("image/");
}

export function isPdfMime(mime: string | null | undefined): boolean {
  return mime === "application/pdf";
}

export const FILE_NOT_FOUND_MESSAGE = "File not found or not uploaded.";
