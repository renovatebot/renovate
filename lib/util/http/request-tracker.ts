import is from '@sindresorhus/is';
import { logger } from '../../logger';

let pendingRequests: Record<string, number> | null = null;

function makeKey(method: string, url: string): string {
  return `${url} (${method.toUpperCase()})`;
}

export function track(url: string, method = 'GET'): void {
  if (!pendingRequests) {
    return;
  }

  const key = makeKey(method, url);
  let counter = pendingRequests[key] ?? 0;
  counter += 1;
  pendingRequests[key] = counter;
}

export function untrack(url: string, method = 'GET'): void {
  if (!pendingRequests) {
    return;
  }

  const key = makeKey(method, url);
  let counter = pendingRequests[key] ?? 0;
  counter -= 1;
  if (counter > 0) {
    pendingRequests[key] = counter;
  } else {
    delete pendingRequests[key];
  }
}

export function init(): void {
  pendingRequests = {};
}

export function reset(): void {
  if (!is.emptyObject(pendingRequests)) {
    logger.warn({ pendingRequests }, 'Unfinished HTTP requests');
  }
  pendingRequests = null;
}
