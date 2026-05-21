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

## Styling

The player uses light DOM and is style-neutral by design. Host applications can style
the rendered `qti3-*` classes directly while preserving the item author's QTI shared
vocabulary classes.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3
