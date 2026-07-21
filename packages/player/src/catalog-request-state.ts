/** Returns whether catalog request controls and programmatic requests are disabled. */
export function isCatalogRequestDisabled(status: string, completed: boolean): boolean {
  return completed || status === "suspended";
}
