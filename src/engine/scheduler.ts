export type GameMode = "turn" | "real";

export interface SchedulerHooks {
  onTick: () => void;
  onFrame: (dt: number) => void;
}

const REALTIME_STEP_MS = 100;

export class Scheduler {
  private mode: GameMode = "turn";
  private frameHandle = 0;
  private lastTime = 0;
  private accumulator = 0;
  private readonly hooks: SchedulerHooks;

  constructor(hooks: SchedulerHooks) {
    this.hooks = hooks;
  }

  start(): void {
    this.lastTime = performance.now();
    const loop = (time: number) => {
      const dt = time - this.lastTime;
      this.lastTime = time;
      if (this.mode === "real") {
        this.accumulator += dt;
        while (this.accumulator >= REALTIME_STEP_MS) {
          this.hooks.onTick();
          this.accumulator -= REALTIME_STEP_MS;
        }
      }
      this.hooks.onFrame(dt);
      this.frameHandle = requestAnimationFrame(loop);
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.frameHandle);
  }

  setMode(mode: GameMode): void {
    if (this.mode === mode) {
      return;
    }
    this.mode = mode;
    this.accumulator = 0;
  }

  getMode(): GameMode {
    return this.mode;
  }

  requestTurnTick(): void {
    this.hooks.onTick();
  }
}
