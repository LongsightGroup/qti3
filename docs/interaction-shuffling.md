# Interaction shuffling

The player implements `shuffle` on choice, order, inline choice, associate, match,
and gap match interactions. Missing `shuffle`, `false`, and `0` preserve authored
order. `true` and `1` request shuffling. Invalid values produce source-located
`interaction.booleanAttribute` diagnostics.

## Presentation and accessibility contract

| Interaction   | Permutation scope                             | Keyboard and accessibility contract                                                                                                           |
| ------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Choice        | Simple choices                                | DOM order and visible labels follow presentation order; native radio/checkbox selection retains identifiers.                                  |
| Order         | Initial list or shared-vocabulary source bank | Handles, movement buttons, announcements and position labels describe the displayed order. Learner movement can move initially fixed choices. |
| Inline choice | Authored options                              | The empty-selection prompt stays first. Arrow/Home/End navigation follows the displayed options; selection restores trigger focus.            |
| Associate     | One logical set, shared by both banks         | Both banks use the same order. Keyboard pairing and response identifiers are unchanged.                                                       |
| Match         | Independent source and target sets            | Banks and table rows/columns use their respective permutations. Headers remain associated with cells.                                         |
| Gap match     | Gap-text/image source bank                    | Passage gaps retain authored order. Keyboard placement retains source/target identifiers.                                                     |

`fixed="true"` preserves an eligible choice's initial index while movable choices
are shuffled around it. It does not lock learner reordering. The QTI attribute is
`fixed`, not `qti-fixed`. Template-hidden choices are removed before a shuffled
set is ordered; fixed positions refer to the remaining eligible set.

Graphic interaction coordinates and passage gaps are never shuffled. The QTI
3.0.1 schema does not define `fixed` on gap-text or gap-img. The writer no longer
offers that option, and writer validation rejects JavaScript inputs that still
supply it. Core reports `interaction.presentation.unsupportedAttribute` for
unsupported placement. Legacy gap-choice `fixed` blocks migration with a
`qti2_gap_fixed_unsupported` diagnostic rather than losing author intent.

## Lifecycle and persistence

The player prepares presentation after template processing and before rendering.
Rendering, locale changes, responses and scoring do not generate another order.
An effective response default or saved order response takes precedence over the
initial permutation. Preparing a presentation does not create a response, begin
an attempt, increment its count or emit a response-change event.

Fresh player loads and resets use a fresh browser-generated seed. Hosts can set
`sessionOptions.presentationSeed` to reproduce presentation, including on reset.
This seed is independent of the existing processing `randomSeed`. Each choice
group uses its own random stream. Fisher–Yates permutes movable identifiers;
correct responses are never consulted. A permutation may equal authored order
or the correct answer by chance.

Attempt state has an optional `presentation` field:

```json
{
  "schema": "qti3.presentation.v1",
  "orders": {
    "0:order:RESPONSE:choices": ["C", "B", "D", "A"]
  }
}
```

Keys identify interaction index, type, response identifier and choice group.
Resolved permutations are stored instead of seeds. Serialization copies order
arrays; restoring does not depend on the original seed or RNG consumption.
Items without shuffled groups do not need this field.

Restoring a shuffled item requires its saved presentation. Missing, duplicate,
unknown, moved-fixed or otherwise incompatible identifiers produce typed
presentation diagnostics. The player leaves the previous session intact when
`restore()` fails; failed loads do not render an unshuffled fallback. Old saved
states without the required order cannot reproduce a shuffled presentation and
must be treated as incompatible, not silently randomized.

## Headless and custom hosts

Scoring remains independent of presentation. A host that needs ordered rendering
uses the session's typed presentation result:

```ts
const session = createItemSession(document, undefined, {
  presentationSeed: "attempt-123",
});
const presentation = session.presentation();
if (presentation.ok) {
  // Render presentation.interactions; persist session.serialize().
} else {
  // Surface presentation.diagnostics and do not render a fallback.
}
```

Without a presentation seed, headless scoring still works; `presentation()`
reports a failure if shuffled groups require initialization. `presentationResponse`
reads an existing response or effective default without recording an answer.
Restored sessions use saved orders regardless of a new presentation seed.

## Evidence

Synthetic MIT-licensed `packages/fixtures/xml/shuffle/*.xml` fixtures cover all six interactions.
`packages/core/src/presentation.test.ts` checks parsing, permutations, fixed
positions, template visibility, state integrity and processing isolation.
`tests/browser/player-shuffle.spec.ts` checks concrete DOM orders, keyboard
responses, scoring, restore, layouts and axe results. These files are linked
from interaction support metadata. No runtime dependencies were added.

References: [QTI 3 implementation guide](https://www.imsglobal.org/spec/qti/v3p0/impl)
and [QTI 3.0.1 ASI schema](https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_asiv3p0p1_v1p0.xsd).
