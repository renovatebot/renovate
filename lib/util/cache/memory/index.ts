declare const global: {
  renovateMemCache: Record<string, any> | undefined;
};

global.renovateMemCache = undefined;

export function init(): void {
  global.renovateMemCache = {};
}

export function reset(): void {
  global.renovateMemCache = undefined;
}

export function get<T = any>(key: string): T {
  return global.renovateMemCache?.[key];
}

export function set(key: string, value: unknown): void {
  if (global.renovateMemCache) {
    global.renovateMemCache[key] = value;
  }
}
