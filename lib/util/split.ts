import type { RenovateSplit } from '../config/types';

let startTime = 0;
let lastTime = 0;
let splits: Record<RenovateSplit, number> = {
  init: 0,
  onboarding: 0,
  extract: 0,
  lookup: 0,
  update: 0,
};

export function splitInit(): void {
  splits = {
    init: 0,
    onboarding: 0,
    extract: 0,
    lookup: 0,
    update: 0,
  };
  startTime = Date.now();
  lastTime = startTime;
}

export function addSplit(name: RenovateSplit): void {
  const now = Date.now();
  splits[name] = now - lastTime;
  lastTime = now;
}

export function getSplits(): any {
  return { splits, total: Date.now() - startTime };
}
