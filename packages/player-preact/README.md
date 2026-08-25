# @longsightgroup/qti3-player-preact

Preact TSX adapter for the qti3 assessment item player web component.

The underlying browser primitive remains `<qti-assessment-item-player>` from
`@longsightgroup/qti3-player`. This package only handles Preact lifecycle wiring, typed callbacks,
declarative XML loading, and an imperative ref handle.

## Install

```sh
npm install @longsightgroup/qti3-player-preact @longsightgroup/qti3-player preact
```

## Use

```tsx
import { useRef } from "preact/hooks";
import type { PlayerMessageCatalog } from "@longsightgroup/qti3-player";
import {
  QtiAssessmentItemPlayer,
  type QtiAssessmentItemPlayerHandle,
} from "@longsightgroup/qti3-player-preact";

export function Preview({
  candidateSafeXml,
  messageCatalog,
}: {
  candidateSafeXml: string;
  messageCatalog?: PlayerMessageCatalog;
}) {
  const playerRef = useRef<QtiAssessmentItemPlayerHandle>(null);

  return (
    <QtiAssessmentItemPlayer
      ref={playerRef}
      xml={candidateSafeXml}
      languageOfInterface="sv-SE"
      messageCatalog={messageCatalog}
      loadOptions={{
        status: "interacting",
        sessionControl: { validateResponses: false, showFeedback: false },
      }}
      onStateChange={({ state }) => console.log(state)}
      onLoadError={(error) => console.error(error)}
    />
  );
}
```

## Declarative loading

- Pass `xml` to load an item after mount. Omit `xml` or set `xml={undefined}` to clear the player.
  Clearing does not emit player events; update host state from the prop transition.
- `xml=""` is not the same as `xml={undefined}`: an empty string attempts a load and shows a parse
  error when the XML is invalid.
- Pass `messageCatalog` for localized player chrome (`languageOfInterface` alone does not load locale files).
- The adapter reloads when `xml`, restored `loadOptions.state`, `status`, session-control flags,
  session-option members, `fetchXml`, `resolveAsset`, or `resolveStylesheet` change.
- Equivalent `loadOptions.state` objects with different references do **not** trigger a reload when
  their serialized content matches. Key order follows object construction order; mutating a state
  object in place without changing the reload key does not trigger a reload.
- Keep `messageCatalog`, `fetchXml`, `resolveAsset`, `resolveStylesheet`, and `loadOptions` object
  literals stable across renders (`useMemo` / hooks memoization). New references on every render
  cause unnecessary resyncs or reloads.
- URL loading stays imperative: `ref.current?.loadUrl(url, loadOptions)`.

## Security Boundary

For high-stakes delivery, pass XML that has already been prepared by the host with
`buildQtiDeliverySafeXml()` from `@longsightgroup/qti3-core`, and gate delivery on that result's
`ok` flag. This adapter does not redact XML, decide deliverability, or perform authoritative
server-side scoring.

The ref exposes `scoreAttempt()` because the web component exposes it. Browser scoring is local
preview/convenience scoring only; high-stakes scoring should use `scoreQtiItemServerSide()` on the
server with authoritative XML.
