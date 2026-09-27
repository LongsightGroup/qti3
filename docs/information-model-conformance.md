# Information-model conformance evidence

The reference for ASI semantics is the [QTI 3.0.1 information model, final release,
September 2024](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/imsqti_asi_v3p0p1_infomodel_v1p0.html).
Use the corresponding XML binding, pinned schemas, applicable errata, and certification
profile alongside it. Implementation guidance and examples do not override normative rules.
Record conflicts explicitly rather than silently choosing the most convenient interpretation.

## What this gate establishes

`pnpm verify` runs `check:information-model` after building the packages. The check executes
the tests referenced by reviewed requirements and reads their actual Vitest assertion results.
It fails for missing citations, duplicate requirement IDs or evidence markers, absent evidence,
wrong case counts, and failed or skipped evidence. Merely naming a file or citing a section
cannot satisfy a claim. These are regression-evidence checks, not proof of specification completeness.

The inventory contains 1,921 headings, including appendices and unnumbered front/back matter.
A heading is neither a single normative requirement nor necessarily normative. The inventory
provides review navigation. Each reviewed requirement states its own rule, relevant sections,
elements, boundary, disposition, limitations, and named executable evidence. Implemented,
explicitly rejected, and open requirements remain distinct. A parent element's support status
never supplies evidence for its attributes, defaults, or child content.

The initial ledger covers selected delivery, rubric, order, restoration, and migration contracts
from recent correctness work. Even a section with a reviewed requirement may contain many
unaudited requirements. The report does not assign a conformance percentage or claim that
unreviewed sections are unsupported. It also retains an open audit of the full fixed-test
acceptance profile. Broader coverage of browser behavior, packaging, accessibility, expression
semantics, and interaction combinations still requires review.

## Inspect and reproduce

After `pnpm build`, run:

```sh
pnpm check:information-model /tmp/qti3-information-model-review.json
```

The JSON records the pinned document, reviewed claims, open requirements, unaudited headings,
related support-matrix entries, and the actual assertion results. It is generated evidence;
do not commit it as a manually maintained second support matrix. The existing support matrix
remains the product capability catalog. The ledger records narrower claims at explicit boundaries.

The extractor was adapted from the information-model crosswalk team's TOC extraction work.
It now pins the exact 3.0.1 document URL and SHA-256, retains the appendix headings, and refuses
unexpected source bytes. Download the versioned HTML outside the repository, then reproduce it:

```sh
node scripts/extract-qti-information-model.mjs /tmp/imsqti_asi_v3p0p1_infomodel_v1p0.html --check
```

Omit `--check` to regenerate. A new specification revision requires review of the digest,
headings, existing section references, and affected requirements. Generated inventory formatting
is owned by this extractor. No network access is needed by the regular evidence gate.

## Add a reviewed requirement

1. Read the exact normative clauses and identify the responsible boundary: parse, validate,
   process, restore, migrate, or deliver. Split independent obligations into separate claims.
2. Record the rule and its limits in `information-model-requirements.ts`. Cite precise section
   IDs; do not use a whole class as a substitute for an attribute rule when a specific clause exists.
3. Implement the behavior or an explicit unsupported diagnostic. Preservation by an importer
   does not establish execution support. Rejection evidence establishes the delivery limit,
   not implementation of the rejected feature.
4. Add independent positive and negative cases under a unique `[ASI-…]` marker. Bind the exact
   file, marker, and reviewed case count. Node evidence must remain DOM-free. Browser behavior
   requires Playwright evidence; do not relabel a core test as rendering evidence.
5. Follow [spec regression testing](spec-regression-testing.md), including mutation verification.
   Add valid XML fixtures to the independent schema gate. The test-delivery fixtures are used
   directly by the runtime regressions and by `pnpm check:test-xsd`.
6. Run `pnpm verify`, the applicable schema checks, and browser tests when behavior affects DOM.
   Review changes to the requirement and its evidence together. Removing a requirement or
   changing it to open is a support-claim change requiring explicit review, not a way to green CI.

## Audit priorities

Start each audit from accepted input and trace its meaning through the public boundary. Inspect
both XML elements and attributes. For every accepted feature, identify its consumer or an
explicit rejection before delivery. Check namespace ownership and extension policy separately.

Continue the fixed-test audit across nested sections, reference attributes, weights, variable
mappings, and navigation/submission modes. Then extend the ledger to response domains and
processing operators, followed by cross-feature session sequences and browser visibility.
Generate bounded combinations of relevant attributes and actions; avoid a Cartesian product
that only increases test count without new assertions. Use independent algorithms and fixed
expected scores, then mutation-test the assertions that guard high-impact behavior.

Run the existing official fixture and validator workflows for their stated scopes. Passing
those checks is valuable external evidence, but it does not replace this requirement review or
establish certification by itself.
