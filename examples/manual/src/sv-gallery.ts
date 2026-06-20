import { sharedVocabularyGalleryBootstrapped } from "../../../tests/browser/fixtures/sv-gallery.ts";

if (!sharedVocabularyGalleryBootstrapped) {
  throw new Error("Shared vocabulary gallery failed to bootstrap.");
}
