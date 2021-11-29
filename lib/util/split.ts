let startTime = 0;
let lastTime = 0;
let splits: Record<string, number> = {};

export function splitInit(): void {
  splits = {};
  startTime = Date.now();
  lastTime = startTime;
}

export function addSplit(name: string): void {
  splits[name] = Date.now() - lastTime;
  lastTime = Date.now();
}

export function getSplits(): any {
  return { splits, total: Date.now() - startTime };
}
