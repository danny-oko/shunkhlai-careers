/**
 * Whether the editor's next save removes the cover — worked out from two
 * separate reasons, because they have to be undone separately.
 *
 * - `ticked`: the "remove the current picture" checkbox. The editor said so,
 *   and only the checkbox (or picking a new file) takes it back.
 * - `byField`: the URL field opened holding the current URL cover and the
 *   editor emptied it. That follows the field: paste an address back and it
 *   is no longer a removal. A single flag set on "emptied" and never cleared
 *   used to turn a cut-and-paste into a deleted cover.
 *
 * Pure, so the rules are tested without rendering the editor.
 */
export type RemoveState = { ticked: boolean; byField: boolean };

export const KEEP: RemoveState = { ticked: false, byField: false };

export function isRemoving(state: RemoveState): boolean {
  return state.ticked || state.byField;
}

/** The URL field changed. Only a field that held a URL cover can mean "remove". */
export function afterUrlEdit(
  state: RemoveState,
  value: string,
  storedIsUrl: boolean,
): RemoveState {
  return { ...state, byField: storedIsUrl && !value.trim() };
}

/**
 * The checkbox changed. Unticking it is an explicit "keep", so it also
 * clears a removal the emptied field implied — otherwise the box would
 * refuse to untick.
 */
export function afterTick(state: RemoveState, checked: boolean): RemoveState {
  return checked ? { ...state, ticked: true } : KEEP;
}
