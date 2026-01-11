export function getFilename(path: string | undefined): string {
  if (!path) return "";
  const parts = path.split("/");
  return parts[parts.length - 1] || "";
}

export function getDirectory(path: string | undefined): string {
  if (!path) return "";
  const lastSlash = path.lastIndexOf("/");
  return lastSlash > 0 ? path.substring(0, lastSlash + 1) : "";
}

export function shortenPath(path: string | undefined, maxLength = 50): string {
  if (!path) return "";
  if (path.length <= maxLength) return path;

  const filename = getFilename(path);
  const remaining = maxLength - filename.length - 4; // 4 for ".../"

  if (remaining <= 0) return `.../${filename}`;

  const dir = getDirectory(path);
  return `${dir.substring(0, remaining)}.../${filename}`;
}
