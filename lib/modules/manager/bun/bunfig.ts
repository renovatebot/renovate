import { isNonEmptyString } from '@sindresorhus/is';
import ini from 'ini';
import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { coerceObject } from '../../../util/object.ts';
import { regEx } from '../../../util/regex.ts';
import { Result } from '../../../util/result.ts';
import { isHttpUrl, parseUrl } from '../../../util/url.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import type { PackageDependency } from '../types.ts';
import { BunfigConfig } from './schema.ts';

export async function loadBunfigToml(
  bunfigFile: string,
): Promise<BunfigConfig | null> {
  const content = await readLocalFile(bunfigFile, 'utf8');
  if (!content) {
    return null;
  }

  return Result.parse(content, BunfigConfig)
    .onError((err) => {
      logger.debug({ bunfigFile, err }, 'Failed to parse bunfig.toml');
    })
    .unwrapOrNull();
}

/**
 * Bun accepts credentials inside the registry URL, but Renovate resolves
 * credentials through host rules instead, so they are dropped here to keep them
 * out of logs and pull request bodies.
 */
function sanitizeRegistryUrl(registryUrl: string): string | null {
  const parsedUrl = parseUrl(registryUrl);
  if (!parsedUrl || !isHttpUrl(parsedUrl)) {
    logger.debug({ registryUrl }, 'Invalid bunfig.toml registry URL');
    return null;
  }

  if (!parsedUrl.username && !parsedUrl.password) {
    return registryUrl;
  }

  logger.debug('Removing credentials from bunfig.toml registry URL');
  parsedUrl.username = '';
  parsedUrl.password = '';
  return parsedUrl.href;
}

/**
 * Returns the scopes which the `.npmrc` file configures a registry for, like
 * `@myorg` for `@myorg:registry=https://registry.myorg.com`.
 */
function getNpmrcScopes(npmrc: string | undefined): string[] {
  if (!npmrc) {
    return [];
  }

  const scopes: string[] = [];
  for (const [key, value] of Object.entries(ini.parse(npmrc))) {
    const scope = key.replace(regEx(/:registry$/), '');
    if (scope !== key && scope.startsWith('@') && isNonEmptyString(value)) {
      scopes.push(scope);
    }
  }
  return scopes;
}

/**
 * Resolves the registry URL for a package name, following Bun's precedence: a
 * matching scoped registry first, then the default registry.
 *
 * Bun merges `bunfig.toml` over `.npmrc` key by key, so a scoped registry from
 * `.npmrc` still wins over the default registry from `bunfig.toml`.
 */
function resolveRegistryUrl(
  packageName: string,
  install: NonNullable<BunfigConfig['install']>,
  npmrcScopes: string[],
): string | null {
  for (const [scope, registryUrl] of Object.entries(
    coerceObject(install.scopes),
  )) {
    // Bun accepts scopes with and without the leading `@`
    const scopePrefix = scope.startsWith('@') ? scope : `@${scope}`;
    if (packageName.startsWith(`${scopePrefix}/`)) {
      return sanitizeRegistryUrl(registryUrl);
    }
  }

  if (npmrcScopes.some((scope) => packageName.startsWith(`${scope}/`))) {
    return null;
  }

  if (install.registry) {
    return sanitizeRegistryUrl(install.registry);
  }

  return null;
}

export function applyBunfigRegistries(
  deps: PackageDependency[],
  bunfig: BunfigConfig | null,
  npmrc?: string,
): void {
  const install = bunfig?.install;
  if (!install) {
    return;
  }

  const npmrcScopes = getNpmrcScopes(npmrc);

  for (const dep of deps) {
    const lookupName = dep.packageName ?? dep.depName;
    if (!lookupName || dep.datasource !== NpmDatasource.id) {
      continue;
    }

    const registryUrl = resolveRegistryUrl(lookupName, install, npmrcScopes);
    if (registryUrl) {
      dep.registryUrls = [registryUrl];
    }
  }
}
