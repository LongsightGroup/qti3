import { describe, expect, it } from "vitest";
import { resolvePlayerMessages } from "./player-locale.js";

describe("resolvePlayerMessages", () => {
  it("resolves built-in locale catalogs with language-region fallback", () => {
    const examples = [
      {
        locale: "es-MX",
        remove: "Quitar",
        pairLabel: "Item XML con Response capture",
        removePair: "Quitar Item XML con Response capture",
        inlineChoicePrompt: "Elija...",
        moveChoice: "Mover Load and parse the assessment item abajo",
        clearDrawing: "Borrar dibujo",
        noPointSelected: "Ningun punto seleccionado",
        noRegionSelected: "Ninguna region seleccionada",
        oneAssociation: "1 asociacion realizada.",
        extendedTextCounter: "7 caracteres, 1 palabra",
        hotspotSelectionSummary: "Seleccionado A",
      },
      {
        locale: "es-ES",
        remove: "Quitar",
        pairLabel: "Item XML con Response capture",
        removePair: "Quitar Item XML con Response capture",
        inlineChoicePrompt: "Elija...",
        moveChoice: "Mover Load and parse the assessment item abajo",
        clearDrawing: "Borrar dibujo",
        noPointSelected: "Ningun punto seleccionado",
        noRegionSelected: "Ninguna region seleccionada",
        oneAssociation: "1 asociacion realizada.",
        extendedTextCounter: "7 caracteres, 1 palabra",
        hotspotSelectionSummary: "Seleccionado A",
      },
      {
        locale: "sv-SE",
        remove: "Ta bort",
        pairLabel: "Item XML med Response capture",
        removePair: "Ta bort Item XML med Response capture",
        inlineChoicePrompt: "Valj...",
        moveChoice: "Flytta Load and parse the assessment item ned",
        clearDrawing: "Rensa ritning",
        noPointSelected: "Ingen punkt vald",
        noRegionSelected: "Ingen region vald",
        oneAssociation: "1 association gjord.",
        extendedTextCounter: "7 tecken, 1 ord",
        hotspotSelectionSummary: "Valt A",
        objectPositionedAt: "Objekt placerat vid 254 210",
        orderedItemMoved: "Load and parse the assessment item flyttades ned.",
      },
      {
        locale: "de-DE",
        remove: "Entfernen",
        pairLabel: "Item XML mit Response capture",
        removePair: "Item XML mit Response capture entfernen",
        inlineChoicePrompt: "Waehlen...",
        moveChoice: "Load and parse the assessment item nach unten bewegen",
        clearDrawing: "Zeichnung loeschen",
        noPointSelected: "Kein Punkt ausgewaehlt",
        noRegionSelected: "Keine Region ausgewaehlt",
        oneAssociation: "1 Zuordnung erstellt.",
        extendedTextCounter: "7 Zeichen, 1 Wort",
        hotspotSelectionSummary: "Ausgewaehlt A",
      },
      {
        locale: "pt-BR",
        remove: "Remover",
        pairLabel: "Item XML com Response capture",
        removePair: "Remover Item XML com Response capture",
        inlineChoicePrompt: "Escolha...",
        moveChoice: "Mover Load and parse the assessment item para baixo",
        clearDrawing: "Limpar desenho",
        noPointSelected: "Nenhum ponto selecionado",
        noRegionSelected: "Nenhuma regiao selecionada",
        oneAssociation: "1 associacao feita.",
        extendedTextCounter: "7 caracteres, 1 palavra",
        hotspotSelectionSummary: "Selecionado A",
      },
      {
        locale: "pt-PT",
        remove: "Remover",
        pairLabel: "Item XML com Response capture",
        removePair: "Remover Item XML com Response capture",
        inlineChoicePrompt: "Escolha...",
        moveChoice: "Mover Load and parse the assessment item para baixo",
        clearDrawing: "Limpar desenho",
        noPointSelected: "Nenhum ponto selecionado",
        noRegionSelected: "Nenhuma regiao selecionada",
        oneAssociation: "1 associacao feita.",
        extendedTextCounter: "7 caracteres, 1 palavra",
        hotspotSelectionSummary: "Selecionado A",
      },
      {
        locale: "fr-FR",
        remove: "Supprimer",
        pairLabel: "Item XML avec Response capture",
        removePair: "Supprimer Item XML avec Response capture",
        inlineChoicePrompt: "Choisir...",
        moveChoice: "Deplacer Load and parse the assessment item vers le bas",
        clearDrawing: "Effacer le dessin",
        noPointSelected: "Aucun point selectionne",
        noRegionSelected: "Aucune region selectionnee",
        oneAssociation: "1 association effectuee.",
        extendedTextCounter: "7 caracteres, 1 mot",
        hotspotSelectionSummary: "A selectionne",
      },
    ];

    for (const example of examples) {
      const messages = resolvePlayerMessages(example.locale, {});
      const pairLabel = messages.associationPairLabel({
        source: "Item XML",
        target: "Response capture",
      });
      expect(messages.remove(), example.locale).toBe(example.remove);
      expect(pairLabel, example.locale).toBe(example.pairLabel);
      expect(messages.removePair({ label: pairLabel }), example.locale).toBe(example.removePair);
      expect(messages.inlineChoicePrompt(), example.locale).toBe(example.inlineChoicePrompt);
      expect(
        messages.moveChoice({
          label: "Load and parse the assessment item",
          direction: "down",
        }),
        example.locale,
      ).toBe(example.moveChoice);
      expect(messages.clearDrawing(), example.locale).toBe(example.clearDrawing);
      expect(messages.noPointSelected(), example.locale).toBe(example.noPointSelected);
      expect(messages.noRegionSelected(), example.locale).toBe(example.noRegionSelected);
      expect(messages.associationsMade({ count: 1 }), example.locale).toBe(example.oneAssociation);
      expect(
        messages.extendedTextCounter({ characters: 7, words: 1 }),
        example.locale,
      ).toBe(example.extendedTextCounter);
      expect(
        messages.hotspotSelectionSummary({ selection: "A", count: 1 }),
        example.locale,
      ).toBe(example.hotspotSelectionSummary);
      if (example.locale === "sv-SE") {
        expect(messages.objectPositionedAt({ coordinates: "254 210" })).toBe(
          example.objectPositionedAt,
        );
        expect(
          messages.orderedItemMovedOneStep({
            label: "Load and parse the assessment item",
            direction: "down",
          }),
        ).toBe(example.orderedItemMoved);
      }
    }
  });

  it("falls back to English and lets host overrides replace individual messages", () => {
    const messages = resolvePlayerMessages("zz-ZZ", {
      clearDrawing: () => "Erase marks",
    });

    expect(messages.clearDrawing()).toBe("Erase marks");
    expect(messages.remove()).toBe("Remove");
    expect(messages.associationPairLabel({ source: "Item XML", target: "Response capture" })).toBe(
      "Item XML to Response capture",
    );
    expect(messages.associationsMade({ count: 2 })).toBe("2 associations made.");
  });
});
