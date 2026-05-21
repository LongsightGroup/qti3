# @longsightgroup/qti3-player

Style-neutral web component player for QTI 3 assessment items.

This package renders one QTI item at a time, captures responses, validates responses,
scores attempts through `@longsightgroup/qti3-core`, and emits host-readable state events.

## Install

```sh
npm install @longsightgroup/qti3-player
```

## Use

```ts
import { defineQtiAssessmentItemPlayer } from "@longsightgroup/qti3-player";

defineQtiAssessmentItemPlayer();
```

```html
<qti-assessment-item-player id="player"></qti-assessment-item-player>
```

```ts
const player = document.querySelector("qti-assessment-item-player");

await player?.loadXml(xml, {
  status: "interacting",
  sessionControl: {
    validateResponses: true,
    showFeedback: true,
  },
});

player?.addEventListener("qti-statechange", (event) => {
  console.log(event.detail.state);
});
```

## Player Chrome Messages

The player keeps authored QTI content language separate from player chrome such as
remove buttons. Chrome language defaults to the player `languageOfInterface` property,
the `language-of-interface` attribute, browser language, document language, then
English. Hosts can override it when delivery settings require a fixed interface language.

Built-in catalogs are currently available for English, Spanish (`es-MX`, `es-ES`),
Swedish (`sv-SE`), German (`de-DE`), Portuguese (`pt-BR`, `pt-PT`), and French
(`fr-FR`, `fr-CA`).

```ts
player.languageOfInterface = "es-MX";
player.messages = {
  remove: () => "Eliminar",
  removePair: ({ label }) => `Eliminar ${label}`,
};
```

## Portable Custom Interactions

For `qti-portable-custom-interaction`, the player renders a
`qti3-portable-custom-host` element, passes small module/configuration metadata through
`dataset` attributes, and emits `qti-portable-custom-mount` with the full parsed
definition. Host code can attach a PCI runtime and send response/state updates back with
`qti3-portable-custom-response`.
Production sandboxing, CSP, origin policy, and audit logging belong to the host delivery
system.

## Styling

The player uses light DOM and is style-neutral by design. Host applications can style
the rendered `qti3-*` classes directly while preserving the item author's QTI shared
vocabulary classes.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3
