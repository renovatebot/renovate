import {
  ensureTrailingSlash,
  parseUrl,
  resolveBaseUrl,
} from '../../../util/url.ts';

export function isPublicRepository(helmRepository: string): boolean {
  const indexUrl = parseUrl(
    resolveBaseUrl(ensureTrailingSlash(helmRepository), 'index.yaml'),
  );

  return indexUrl?.href === 'https://charts.helm.sh/stable/index.yaml';
}
