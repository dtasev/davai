/**
 * True when the event target is a form field or contenteditable element,
 * i.e. the user is typing and single-letter app shortcuts must not fire.
 *
 * Non-HTMLElement targets (e.g. `Window` when the listener is on `window`
 * and the event did not originate from an element) return false.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

/**
 * Shared guard for modifier-driven app shortcuts (`g`, `t`, ...).
 *
 * `shiftKey` is intentionally not checked: shortcuts stay active with Shift.
 */
export function shouldIgnoreAppShortcut(event: KeyboardEvent): boolean {
  return (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    isTypingTarget(event.target)
  )
}
