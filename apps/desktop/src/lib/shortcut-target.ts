/**
 * True when a keyboard/mouse event target sits inside an editable widget
 * (input, textarea, contenteditable, …). Global shortcut handlers should
 * ignore those events — the user is typing, not invoking canvas actions.
 */
export function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"]',
    ),
  )
}
