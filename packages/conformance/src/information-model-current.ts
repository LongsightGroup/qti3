import { elementSupport } from "@longsightgroup/qti3-core";
import { qtiInformationModelInventory } from "./information-model-inventory.js";
import {
  qtiInformationModelEvidence,
  reviewQtiInformationModel,
  type QtiInformationModelReference,
  type QtiInformationModelReview,
} from "./information-model.js";

/** Review the published information-model inventory against the current support matrix. */
export function reviewPublishedQtiInformationModel(
  references: readonly QtiInformationModelReference[],
): QtiInformationModelReview {
  return reviewQtiInformationModel({
    inventory: qtiInformationModelInventory,
    evidence: qtiInformationModelEvidence(elementSupport),
    references,
  });
}
