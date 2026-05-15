interface PermissionListProps {
  sessionId?: string
  className?: string
}

// Pi is embedded with Dilag-owned tools, so the old permission approval surface
// is intentionally retired. Keep this component as a harmless shim for any stale
// imports while the chat layout finishes migrating.
export function PermissionList(_props: PermissionListProps) {
  return null
}
