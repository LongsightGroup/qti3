# @longsightgroup/qti3-a11y

Accessibility contracts and proof metadata for qti3 QTI 3 item interactions.

This package describes the keyboard, focus, accessible-name, validation-message, and
assistive-technology expectations used by qti3 tests and release checks.

## Install

```sh
npm install @longsightgroup/qti3-a11y
```

## Use

```ts
import {
  a11yContracts,
  accessibilityProofMatrix,
  manualAssistiveTechnologyScripts,
} from "@longsightgroup/qti3-a11y";

console.log(a11yContracts);
console.log(accessibilityProofMatrix);
console.log(manualAssistiveTechnologyScripts);
```

## Scope

- Interaction-level accessibility contracts.
- Keyboard model expectations for supported interactions.
- Manual assistive-technology scripts for VoiceOver, NVDA, and JAWS.
- Proof metadata used by browser and release checks.

See the main repository README for the support matrix and release notes:
https://github.com/LongsightGroup/qti3
