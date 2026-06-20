/**
 * Isomorphic custom-element base: real `HTMLElement` in browser, minimal stub in Node tests.
 */
class HTMLElementStub {
  replaceChildren(): void {}
  dispatchEvent(): boolean {
    return true;
  }
}

function resolvePlayerElementHost(): typeof HTMLElement {
  if (typeof document === "undefined") {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Node test hosts omit HTMLElement; stub covers only methods the player uses.
    return HTMLElementStub as unknown as typeof HTMLElement;
  }
  return globalThis.HTMLElement;
}

export const PlayerElementHost = resolvePlayerElementHost();
