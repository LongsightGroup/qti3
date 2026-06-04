export function installAdapterContractHarness({
  PlayerElement,
  createComponent,
  createRef,
  renderComponent,
  rootElement,
}) {
  const originalLoadXml = PlayerElement.prototype.loadXml;
  const originalClearItem = PlayerElement.prototype.clearItem;
  let eventLog = [];
  let loadXmlCalls = [];
  let pendingLoadResolves = [];
  let clearItemCalls = 0;
  let serializeCalls = 0;
  let ref = createRef();

  function resetMocks() {
    PlayerElement.prototype.loadXml = originalLoadXml;
    PlayerElement.prototype.clearItem = originalClearItem;
    loadXmlCalls = [];
    pendingLoadResolves = [];
    clearItemCalls = 0;
    serializeCalls = 0;
  }

  function componentProps(input = {}) {
    const { diagnosticsLabel, loadErrorLabel, readyLabel, ...props } = input;
    return {
      ...props,
      onDiagnostics: (detail) =>
        eventLog.push({ type: "diagnostics", label: diagnosticsLabel ?? "", detail }),
      onLoadError: (error) =>
        eventLog.push({
          type: "loadError",
          label: loadErrorLabel ?? "",
          message: error.message,
          name: error.name,
        }),
      onReady: (detail) => eventLog.push({ type: "ready", label: readyLabel ?? "", detail }),
    };
  }

  function render(input = {}) {
    eventLog = [];
    ref = createRef();
    renderComponent(createComponent(componentProps(input), ref));
  }

  function rerender(input = {}) {
    renderComponent(createComponent(componentProps(input), ref));
  }

  function element() {
    return rootElement.querySelector("qti-assessment-item-player");
  }

  function elementSnapshot() {
    const player = element();
    return {
      ariaLabel: player?.getAttribute("aria-label") ?? null,
      childElementCount: player?.childElementCount ?? 0,
      className: player?.getAttribute("class") ?? null,
      count: rootElement.querySelectorAll("qti-assessment-item-player").length,
      dataItemId: player?.getAttribute("data-item-id") ?? null,
      instanceOfPlayer: player instanceof PlayerElement,
      messageCatalog: player?.messageCatalog,
      serializedItemIdentifier: player?.serialize?.()?.itemIdentifier,
      textContent: player?.textContent ?? "",
    };
  }

  function eventLogSnapshot() {
    return JSON.parse(JSON.stringify(eventLog));
  }

  function installLoadXmlMock(mode) {
    loadXmlCalls = [];
    pendingLoadResolves = [];
    PlayerElement.prototype.loadXml = function loadXmlMock(xml, options) {
      loadXmlCalls.push({ xml, options: loadOptionsSnapshot(options) });
      if (mode === "diagnostics") {
        this.dispatchEvent(
          new CustomEvent("qti-diagnostics", {
            detail: { diagnostics: [{ code: "x" }] },
          }),
        );
        return Promise.resolve();
      }
      if (mode === "reject") {
        return Promise.reject(new Error("load failed"));
      }
      if (mode === "pending") {
        return new Promise((resolve) => pendingLoadResolves.push(resolve));
      }
      return Promise.resolve();
    };
  }

  function restoreLoadXml() {
    PlayerElement.prototype.loadXml = originalLoadXml;
  }

  function resolvePendingLoad(index = 0) {
    pendingLoadResolves[index]?.();
  }

  function loadXmlCallSnapshot() {
    return JSON.parse(JSON.stringify(loadXmlCalls));
  }

  function installClearItemSpy() {
    clearItemCalls = 0;
    PlayerElement.prototype.clearItem = function clearItemSpy() {
      clearItemCalls += 1;
      return originalClearItem.call(this);
    };
  }

  function clearItemCallCount() {
    return clearItemCalls;
  }

  function dispatchReady(identifier) {
    element()?.dispatchEvent(new CustomEvent("qti-ready", { detail: { item: { identifier } } }));
  }

  function mockCurrentElementSerialize(value) {
    const player = ref.current?.element;
    if (!player) throw new Error("Missing current player element.");
    serializeCalls = 0;
    player.serialize = () => {
      serializeCalls += 1;
      return value;
    };
  }

  function handleSnapshot() {
    return {
      hasElement: ref.current?.element instanceof PlayerElement,
      serialized: ref.current?.serialize(),
      serializeCalls,
    };
  }

  async function flush() {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await Promise.resolve();
  }

  window.qti3AdapterHarness = {
    clearItemCallCount,
    dispatchReady,
    elementSnapshot,
    eventLogSnapshot,
    flush,
    handleSnapshot,
    installClearItemSpy,
    installLoadXmlMock,
    loadXmlCallSnapshot,
    mockCurrentElementSerialize,
    render,
    rerender,
    resetMocks,
    resolvePendingLoad,
    restoreLoadXml,
  };
}

function loadOptionsSnapshot(options) {
  if (!options) return undefined;
  return {
    sessionControl: options.sessionControl
      ? {
          showFeedback: options.sessionControl.showFeedback,
          validateResponses: options.sessionControl.validateResponses,
        }
      : undefined,
    state: options.state
      ? {
          itemIdentifier: options.state.itemIdentifier,
          schema: options.state.schema,
        }
      : undefined,
    status: options.status,
  };
}
