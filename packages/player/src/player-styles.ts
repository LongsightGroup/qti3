import { BASE_PLAYER_STYLES } from "./styles/base-styles.js";
import { CHOICE_HOTTEXT_PLAYER_STYLES } from "./styles/choice-hottext-styles.js";
import { CONTROL_PLAYER_STYLES } from "./styles/control-styles.js";
import { DRAWING_PLAYER_STYLES } from "./styles/drawing-styles.js";
import { GAP_MATCH_PLAYER_STYLES } from "./styles/gap-match-styles.js";
import { GRAPHIC_PLAYER_STYLES } from "./styles/graphic-styles.js";
import { MATCH_PAIR_PLAYER_STYLES } from "./styles/match-pair-styles.js";
import { TEXT_SLIDER_PLAYER_STYLES } from "./styles/text-slider-styles.js";

export const PLAYER_STYLES = [
  BASE_PLAYER_STYLES,
  CONTROL_PLAYER_STYLES,
  MATCH_PAIR_PLAYER_STYLES,
  GAP_MATCH_PLAYER_STYLES,
  CHOICE_HOTTEXT_PLAYER_STYLES,
  TEXT_SLIDER_PLAYER_STYLES,
  DRAWING_PLAYER_STYLES,
  GRAPHIC_PLAYER_STYLES,
].join("\n\n");

export function playerStyleElement(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = PLAYER_STYLES;
  return style;
}
