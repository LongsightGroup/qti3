import {
  assertQtiAttemptStateV1,
  createItemSession,
  type QtiAttemptStateV1,
  type QtiDiagnostic,
  type QtiDocument,
  type QtiInteraction,
  type QtiItemSession,
  type QtiItemSessionOptions,
} from "@longsightgroup/qti3-core";
import { playerErrorDiagnostic } from "./diagnostics.js";

/** Prepare a complete session before replacing the player's current attempt. */
export function preparePlayerSession(
  document: QtiDocument,
  input: { readonly kind: "new" } | { readonly kind: "restore"; readonly state: unknown },
  options: QtiItemSessionOptions = {},
):
  | {
      readonly ok: true;
      readonly session: QtiItemSession;
      readonly presentationInteractions: readonly QtiInteraction[];
    }
  | { readonly ok: false; readonly diagnostics: QtiDiagnostic[]; readonly message: string } {
  try {
    let state: QtiAttemptStateV1 | undefined;
    if (input.kind === "restore") {
      assertQtiAttemptStateV1(input.state);
      state = input.state;
    }
    const session = createItemSession(
      document,
      state,
      input.kind === "restore"
        ? options
        : {
            ...options,
            presentationSeed:
              options.presentationSeed ?? crypto.getRandomValues(new Uint32Array(4)).join("-"),
          },
    );
    const presentation = session.presentation();
    return presentation.ok
      ? { ok: true, session, presentationInteractions: presentation.interactions }
      : {
          ok: false,
          diagnostics: [...presentation.diagnostics],
          message: "Unable to prepare QTI presentation.",
        };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [playerErrorDiagnostic("player.restoreState", error)],
      message: "Unable to restore QTI state.",
    };
  }
}
