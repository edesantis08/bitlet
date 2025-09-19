const BINDINGS_KEY = "shardcrawler.bindings";

type InputAction =
  | "move_up"
  | "move_down"
  | "move_left"
  | "move_right"
  | "wait"
  | "interact"
  | "pause"
  | "restart";

type BindingMap = Record<InputAction, string>;

const DEFAULT_BINDINGS: BindingMap = {
  move_up: "ArrowUp",
  move_down: "ArrowDown",
  move_left: "ArrowLeft",
  move_right: "ArrowRight",
  wait: "KeyQ",
  interact: "Space",
  pause: "KeyP",
  restart: "KeyR",
};

function normalizeKey(key: string): string {
  return key.trim() || "Space";
}

export class InputManager {
  private bindings: BindingMap;
  private queue: InputAction[] = [];
  private listeners: Set<(action: InputAction) => void> = new Set<(action: InputAction) => void>();

  constructor() {
    this.bindings = loadBindings();
    window.addEventListener("keydown", (event) => this.onKeyDown(event));
  }

  private onKeyDown(event: KeyboardEvent): void {
    const action = this.resolveAction(event.code);
    if (!action) {
      return;
    }
    event.preventDefault();
    this.queue.push(action);
    for (const listener of this.listeners) {
      listener(action);
    }
  }

  resolveAction(code: string): InputAction | null {
    const entries = Object.entries(this.bindings) as [InputAction, string][];
    for (const [action, binding] of entries) {
      if (binding.toLowerCase() === code.toLowerCase()) {
        return action;
      }
    }
    // Allow duplicates with fallback to defaults for WASD
    switch (code) {
      case "KeyW":
        return "move_up";
      case "KeyS":
        return "move_down";
      case "KeyA":
        return "move_left";
      case "KeyD":
        return "move_right";
      case "Space":
        return "interact";
      default:
        return null;
    }
  }

  drainActions(): InputAction[] {
    const copy = [...this.queue];
    this.queue.length = 0;
    return copy;
  }

  onAction(listener: (action: InputAction) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getBindings(): BindingMap {
    return { ...this.bindings };
  }

  setBinding(action: InputAction, key: string): void {
    this.bindings = { ...this.bindings, [action]: normalizeKey(key) };
    saveBindings(this.bindings);
  }

  resetBindings(): void {
    this.bindings = { ...DEFAULT_BINDINGS };
    saveBindings(this.bindings);
  }
}

function loadBindings(): BindingMap {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BindingMap;
      return { ...DEFAULT_BINDINGS, ...parsed };
    }
  } catch (error) {
    console.warn("Failed to load bindings", error);
  }
  return { ...DEFAULT_BINDINGS };
}

function saveBindings(bindings: BindingMap): void {
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(bindings));
  } catch (error) {
    console.warn("Failed to save bindings", error);
  }
}

export type { InputAction, BindingMap };
