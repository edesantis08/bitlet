import type { RNG } from "./rng";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Point, Size {}

export function pointKey({ x, y }: Point): string {
  return `${x},${y}`;
}

export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function inBounds(point: Point, size: Size): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < size.width && point.y < size.height;
}

export function rectPoints(rect: Rect): Point[] {
  const pts: Point[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      pts.push({ x, y });
    }
  }
  return pts;
}

export function neighbors4(point: Point): Point[] {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ];
}

export function randomRect(rng: RNG, bounds: Rect): Rect {
  const width = rng.nextInt(bounds.width - 3) + 3;
  const height = rng.nextInt(bounds.height - 3) + 3;
  const x = rng.nextInt(bounds.width - width) + bounds.x;
  const y = rng.nextInt(bounds.height - height) + bounds.y;
  return { x, y, width, height };
}

export function bresenhamLine(from: Point, to: Point): Point[] {
  const points: Point[] = [];
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) {
      break;
    }
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
}

export function lineOfSight(
  start: Point,
  end: Point,
  passable: (p: Point) => boolean,
  inclusive = false,
): boolean {
  const points = bresenhamLine(start, end);
  for (let i = 1; i < points.length - (inclusive ? 0 : 1); i += 1) {
    if (!passable(points[i])) {
      return false;
    }
  }
  return true;
}

export function computeFieldOfView(
  origin: Point,
  radius: number,
  size: Size,
  isTransparent: (p: Point) => boolean,
): boolean[] {
  const visible = new Array(size.width * size.height).fill(false);
  const queue: Point[] = [origin];
  const visited = new Set<string>([pointKey(origin)]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    const dist = manhattan(origin, current);
    if (dist > radius) {
      continue;
    }
    const idx = current.y * size.width + current.x;
    visible[idx] = lineOfSight(origin, current, isTransparent, true);
    if (!visible[idx]) {
      continue;
    }
    for (const next of neighbors4(current)) {
      if (!inBounds(next, size)) {
        continue;
      }
      const key = pointKey(next);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push(next);
    }
  }
  return visible;
}

export function floodFill(
  start: Point,
  size: Size,
  passable: (p: Point) => boolean,
): Set<string> {
  const reachable = new Set<string>();
  const queue: Point[] = [start];
  while (queue.length > 0) {
    const p = queue.shift()!;
    const key = pointKey(p);
    if (reachable.has(key)) {
      continue;
    }
    if (!inBounds(p, size) || !passable(p)) {
      continue;
    }
    reachable.add(key);
    for (const n of neighbors4(p)) {
      queue.push(n);
    }
  }
  return reachable;
}

export function findPathBfs(
  start: Point,
  goal: Point,
  size: Size,
  passable: (p: Point) => boolean,
): Point[] {
  const queue: Point[] = [start];
  const cameFrom = new Map<string, Point | null>();
  cameFrom.set(pointKey(start), null);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === goal.x && current.y === goal.y) {
      break;
    }
    for (const next of neighbors4(current)) {
      if (!inBounds(next, size) || !passable(next)) {
        continue;
      }
      const key = pointKey(next);
      if (cameFrom.has(key)) {
        continue;
      }
      cameFrom.set(key, current);
      queue.push(next);
    }
  }
  const path: Point[] = [];
  let cursor: Point | undefined = goal;
  const goalKey = pointKey(goal);
  if (!cameFrom.has(goalKey)) {
    return path;
  }
  while (cursor) {
    path.push(cursor);
    cursor = cameFrom.get(pointKey(cursor)) ?? undefined;
  }
  path.reverse();
  return path;
}
