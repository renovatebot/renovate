import type { UrlParsedResult } from '../types';
import type { HomebrewUrlHandler } from './base';
import { GitHubUrlHandler } from './github';
import { NpmUrlHandler } from './npm';

const handlers: HomebrewUrlHandler[] = [
  new GitHubUrlHandler(),
  new NpmUrlHandler(),
];

export function findHandler(
  url: string | null,
): { handler: HomebrewUrlHandler; parsed: UrlParsedResult } | null {
  if (!url) {
    return null;
  }
  for (const handler of handlers) {
    const parsed = handler.parseUrl(url);
    if (parsed) {
      return { handler, parsed };
    }
  }
  return null;
}

export function findHandlerByType(type: string): HomebrewUrlHandler | null {
  return handlers.find((h) => h.type === type) ?? null;
}
