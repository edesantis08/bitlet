export interface Palette {
  readonly background: string;
  readonly floor: string;
  readonly wall: string;
  readonly accent: string;
  readonly hazard: string;
  readonly shard: string;
  readonly portal: string;
  readonly fog: string;
}

export const TILE_BASE = 16;
export const TILE_SCALE = 2;
export const TILE_SIZE = TILE_BASE * TILE_SCALE;

export const FONT_FAMILY = "IBM Plex Mono, Courier New, monospace";

const PALETTES: Record<string, Palette> = {
  default: {
    background: "#06111b",
    floor: "#0f2535",
    wall: "#214a63",
    accent: "#9be9ff",
    hazard: "#ff6f59",
    shard: "#fdfd96",
    portal: "#8e7dff",
    fog: "#03070b",
  },
  colorblind: {
    background: "#050c12",
    floor: "#14303f",
    wall: "#355d75",
    accent: "#ffcc4d",
    hazard: "#ff5a36",
    shard: "#f5ff7d",
    portal: "#a26dff",
    fog: "#020507",
  },
};

export function getPalette(mode: "default" | "colorblind"): Palette {
  return mode === "colorblind" ? PALETTES.colorblind : PALETTES.default;
}

export const HEART_COLOR = "#ff6f59";
export const HUD_TEXT_COLOR = "#d1f1ff";

export const AUDIO_TONES = {
  shard: 880,
  damage: 220,
  portal: 660,
  start: 520,
};
