import type { BindingMap, InputAction } from "../engine/input";
import type { GameWorld, RunStats, Settings } from "../game/types";

export interface ScreenController {
  startRun: (seed?: string) => void;
  showSettings: () => void;
  showHowTo: () => void;
  showTitle: () => void;
  resume: () => void;
  quitToTitle: () => void;
  restart: () => void;
  applySettings: (settings: Partial<Settings>) => void;
  updateBinding: (action: InputAction, key: string) => void;
  resetBindings: () => void;
}

export function renderScreen(
  root: HTMLElement,
  world: GameWorld,
  controller: ScreenController,
  bindings: BindingMap,
  bestRun: RunStats | null,
): void {
  root.innerHTML = "";
  if (world.screen === "run") {
    return;
  }
  const panel = document.createElement("div");
  panel.className = "overlay-panel";
  if (world.screen === "title") {
    panel.append(titlePanel(controller, world));
  } else if (world.screen === "settings") {
    panel.append(settingsPanel(world, controller, bindings));
  } else if (world.screen === "howto") {
    panel.append(howToPanel(controller));
  } else if (world.screen === "pause") {
    panel.append(pausePanel(controller));
  } else if (world.screen === "summary") {
    panel.append(summaryPanel(world, controller, bestRun));
  }
  root.append(panel);
}

function titlePanel(controller: ScreenController, world: GameWorld): DocumentFragment {
  const frag = document.createDocumentFragment();
  const title = document.createElement("h1");
  title.textContent = "ShardCrawler";
  frag.append(title);
  const start = button("Start Run", () => controller.startRun(world.settings.customSeed));
  const settings = button("Settings", controller.showSettings);
  const howTo = button("How To Play", controller.showHowTo);
  frag.append(start, settings, howTo);
  return frag;
}

function settingsPanel(
  world: GameWorld,
  controller: ScreenController,
  bindings: BindingMap,
): DocumentFragment {
  const frag = document.createDocumentFragment();
  const heading = document.createElement("h2");
  heading.textContent = "Settings";
  frag.append(heading);

  const modeLabel = document.createElement("label");
  modeLabel.className = "option";
  modeLabel.textContent = "Mode";
  const modeSelect = document.createElement("select");
  for (const value of ["turn", "real"] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value === "turn" ? "Turn-based" : "Real-time";
    if (world.settings.mode === value) {
      option.selected = true;
    }
    modeSelect.append(option);
  }
  modeSelect.onchange = () => controller.applySettings({ mode: modeSelect.value as Settings["mode"] });
  modeLabel.append(modeSelect);
  frag.append(modeLabel);

  const difficultyLabel = document.createElement("label");
  difficultyLabel.className = "option";
  difficultyLabel.textContent = "Difficulty";
  const difficultySelect = document.createElement("select");
  for (const value of ["relaxed", "standard", "hard"] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value.charAt(0).toUpperCase() + value.slice(1);
    if (world.settings.difficulty === value) {
      option.selected = true;
    }
    difficultySelect.append(option);
  }
  difficultySelect.onchange = () => controller.applySettings({ difficulty: difficultySelect.value as Settings["difficulty"] });
  difficultyLabel.append(difficultySelect);
  frag.append(difficultyLabel);

  const paletteLabel = document.createElement("label");
  paletteLabel.className = "option";
  paletteLabel.textContent = "Palette";
  const paletteSelect = document.createElement("select");
  for (const value of ["default", "colorblind"] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value === "default" ? "Standard" : "Colorblind";
    if (world.settings.colorMode === value) {
      option.selected = true;
    }
    paletteSelect.append(option);
  }
  paletteSelect.onchange = () => controller.applySettings({ colorMode: paletteSelect.value as Settings["colorMode"] });
  paletteLabel.append(paletteSelect);
  frag.append(paletteLabel);

  const audioLabel = document.createElement("label");
  audioLabel.className = "option";
  audioLabel.textContent = "Audio";
  const audioToggle = document.createElement("input");
  audioToggle.type = "checkbox";
  audioToggle.checked = world.settings.audio;
  audioToggle.onchange = () => controller.applySettings({ audio: audioToggle.checked });
  audioLabel.append(audioToggle);
  frag.append(audioLabel);

  const shakeLabel = document.createElement("label");
  shakeLabel.className = "option";
  shakeLabel.textContent = "Screen shake";
  const shakeSlider = document.createElement("input");
  shakeSlider.type = "range";
  shakeSlider.min = "0";
  shakeSlider.max = "1";
  shakeSlider.step = "0.1";
  shakeSlider.value = String(world.settings.screenShake);
  shakeSlider.onchange = () => controller.applySettings({ screenShake: Number(shakeSlider.value) });
  shakeLabel.append(shakeSlider);
  frag.append(shakeLabel);

  const seedLabel = document.createElement("label");
  seedLabel.className = "option";
  seedLabel.textContent = "Custom seed";
  const seedInput = document.createElement("input");
  seedInput.type = "text";
  seedInput.value = world.settings.customSeed ?? "";
  seedInput.placeholder = "leave blank for random";
  seedInput.onchange = () => controller.applySettings({ customSeed: seedInput.value || undefined });
  seedLabel.append(seedInput);
  frag.append(seedLabel);

  const bindingsHeading = document.createElement("h3");
  bindingsHeading.textContent = "Bindings";
  frag.append(bindingsHeading);

  for (const [action, key] of Object.entries(bindings) as [InputAction, string][]) {
    const label = document.createElement("label");
    label.className = "option";
    label.textContent = action;
    const input = document.createElement("input");
    input.type = "text";
    input.value = key;
    input.onchange = () => controller.updateBinding(action, input.value);
    label.append(input);
    frag.append(label);
  }

  const resetBindings = button("Reset bindings", controller.resetBindings);
  const close = button("Back", controller.showTitle);
  frag.append(resetBindings, close);
  return frag;
}

function howToPanel(controller: ScreenController): DocumentFragment {
  const frag = document.createDocumentFragment();
  const heading = document.createElement("h2");
  heading.textContent = "How To Play";
  const text = document.createElement("p");
  text.innerHTML =
    "Collect shards to reach the quota, then step into the portal to descend. <br />" +
    "Arrows or WASD move, Space interacts (open portal or blink), Q waits, P pauses, R restarts. <br />" +
    "Sentinels chase you, turrets fire lines, spikes pulse on timers. Keys unlock the one locked door per depth.";
  frag.append(heading, text, button("Back", controller.showTitle));
  return frag;
}

function pausePanel(controller: ScreenController): DocumentFragment {
  const frag = document.createDocumentFragment();
  const heading = document.createElement("h2");
  heading.textContent = "Paused";
  frag.append(heading);
  frag.append(button("Resume", controller.resume));
  frag.append(button("Restart", controller.restart));
  frag.append(button("Quit", controller.quitToTitle));
  return frag;
}

function summaryPanel(world: GameWorld, controller: ScreenController, bestRun: RunStats | null): DocumentFragment {
  const frag = document.createDocumentFragment();
  const heading = document.createElement("h2");
  heading.textContent = world.run.stats.victory ? "Victory" : "Run Summary";
  frag.append(heading);
  const list = document.createElement("ul");
  list.style.listStyle = "none";
  list.style.padding = "0";
  list.append(summaryItem(`Seed: ${world.run.stats.seedString}`));
  list.append(summaryItem(`Depth reached: ${world.run.stats.depthReached}/5`));
  list.append(summaryItem(`Shards: ${world.run.stats.shardsCollected}`));
  list.append(summaryItem(`Turns: ${world.run.stats.turnsTaken}`));
  list.append(summaryItem(`Time: ${(world.run.stats.timeMs / 1000).toFixed(1)}s`));
  frag.append(list);
  if (bestRun) {
    const best = document.createElement("p");
    best.textContent = `Best: depth ${bestRun.depthReached}, shards ${bestRun.shardsCollected}`;
    frag.append(best);
  }
  frag.append(button("Start New Run", () => controller.startRun()));
  frag.append(button("Quit to Title", controller.showTitle));
  return frag;
}

function summaryItem(text: string): HTMLLIElement {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}

function button(label: string, handler: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.onclick = (event) => {
    event.preventDefault();
    handler();
  };
  return btn;
}
