import "./styles.css";
import { initialize } from "./game/run";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
const uiRoot = document.getElementById("ui-root") as HTMLElement | null;

if (!canvas || !uiRoot) {
  throw new Error("Missing canvas or UI root");
}

initialize(canvas, uiRoot);
