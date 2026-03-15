import { logger } from '../../../logger/index.ts';
import {
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { parse as parseToml } from '../../../util/toml.ts';
import {
  type BunfigConfig,
  type BunfigRegistryConfig,
  BunfigSchema,
  type RawBunfigConfig,
} from './schema.ts';

function getRegistryUrl(config: BunfigRegistryConfig): string {
  return typeof config === 'string' ? config : config.url;
}

function normalizeBunfigConfig(config: RawBunfigConfig): BunfigConfig {
  const install = config.install;
  if (!install) {
    return {};
  }

  return {
    install: {
      registry: install.registry ? getRegistryUrl(install.registry) : undefined,
      scopes: install.scopes
        ? Object.fromEntries(
            Object.entries(install.scopes).map(([scope, registryConfig]) => [
              scope,
              getRegistryUrl(registryConfig),
            ]),
          )
        : undefined,
    },
  };
}

/**
 * Resolves the registry URL for a given package name based on bunfig.toml config.
 * Scoped packages (@org/pkg) are matched against scoped registries first.
 */
export function resolveRegistryUrl(
  packageName: string,
  bunfigConfig: BunfigConfig,
): string | null {
  const install = bunfigConfig.install;
  if (!install) {
    return null;
  }

  // Check scoped registries first
  if (install.scopes) {
    for (const [scope, registryUrl] of Object.entries(install.scopes)) {
      // Bun scopes in bunfig.toml don't include the @ prefix
      const scopePrefix = scope.startsWith('@') ? scope : `@${scope}`;
      if (packageName.startsWith(`${scopePrefix}/`)) {
        return registryUrl;
      }
    }
  }

  // Fall back to default registry
  if (install.registry) {
    return install.registry;
  }

  return null;
}

/**
 * Loads and parses bunfig.toml from the filesystem.
 * Returns null if file not found or parsing fails.
 */
export async function loadBunfigToml(
  packageFile: string,
): Promise<BunfigConfig | null> {
  const bunfigFileName = await findLocalSiblingOrParent(
    packageFile,
    'bunfig.toml',
  );

  if (!bunfigFileName) {
    return null;
  }

  const content = await readLocalFile(bunfigFileName, 'utf8');
  if (!content) {
    return null;
  }

  return parseBunfigToml(content);
}

/**
 * Parses bunfig.toml content string into a typed config object.
 */
export function parseBunfigToml(content: string): BunfigConfig | null {
  try {
    const parsed = parseToml(content);
    const res = BunfigSchema.safeParse(parsed);
    if (res.success) {
      return normalizeBunfigConfig(res.data);
    }

    logger.debug({ err: res.error }, 'Failed to parse bunfig.toml');
    return null;
  } catch (err) {
    logger.debug({ err }, 'Failed to parse bunfig.toml TOML syntax');
    return null;
  }
}
