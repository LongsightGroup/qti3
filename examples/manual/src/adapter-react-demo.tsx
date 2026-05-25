import { canonicalFixtures } from "@longsightgroup/qti3-fixtures";
import {
  QtiAssessmentItemPlayer,
  type QtiAssessmentItemPlayerHandle,
} from "@longsightgroup/qti3-player-react";
import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const choiceFixture = canonicalFixtures.find((fixture) => fixture.id === "choice-reference");

function AdapterReactDemo() {
  const playerRef = useRef<QtiAssessmentItemPlayerHandle>(null);
  const [xml, setXml] = useState<string | undefined>(choiceFixture?.xml);
  const [lastEvent, setLastEvent] = useState("Waiting for qti-ready or qti-statechange…");

  return (
    <main>
      <p>
        Minimal proof that <code>@longsightgroup/qti3-player-react</code> mounts the web component,
        loads declarative <code>xml</code>, and forwards events.{" "}
        <a href="/index.html">Back to the full manual harness</a>.
      </p>
      <div className="toolbar">
        <button type="button" onClick={() => setXml(choiceFixture?.xml)}>
          Load choice fixture
        </button>
        <button type="button" onClick={() => setXml(undefined)}>
          Clear xml
        </button>
        <button
          type="button"
          onClick={() => {
            const state = playerRef.current?.serialize();
            setLastEvent(
              state ? `serialize(): ${JSON.stringify(state, null, 2)}` : "No item loaded.",
            );
          }}
        >
          Serialize via ref
        </button>
      </div>
      <QtiAssessmentItemPlayer
        ref={playerRef}
        xml={xml}
        languageOfInterface="en"
        loadOptions={{
          status: "interacting",
          sessionControl: { validateResponses: false, showFeedback: false },
        }}
        onReady={({ item }) => setLastEvent(`qti-ready: ${item.identifier}`)}
        onStateChange={({ state }) =>
          setLastEvent(`qti-statechange: ${state.itemIdentifier} (${state.status})`)
        }
        onLoadError={(error) => setLastEvent(`onLoadError: ${error.message}`)}
      />
      <pre aria-live="polite">{lastEvent}</pre>
    </main>
  );
}

const root = document.querySelector("#root");
if (!root) throw new Error("Missing #root mount point.");
if (!choiceFixture) throw new Error("Missing choice-reference fixture.");

createRoot(root).render(
  <StrictMode>
    <AdapterReactDemo />
  </StrictMode>,
);
