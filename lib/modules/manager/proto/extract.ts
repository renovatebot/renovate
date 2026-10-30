import { logger } from '../../../logger/index.ts';
import { getSiblingFileName } from '../../../util/fs/index.ts';
import { ProtoPluginDatasource } from '../../datasource/proto-plugin/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { ProtoToolsFile } from './schema.ts';
import { protoTooling } from './upgradeable-tooling.ts';

/**
 * Version aliases that cannot be updated via semver.
 */
const versionAliases = new Set(['latest', 'stable', 'canary', 'nightly']);

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`proto.extractPackageFile(${packageFile})`);

  const parsed = ProtoToolsFile.safeParse(content);
  if (!parsed.success) {
    logger.debug(
      { err: parsed.error, packageFile },
      'Error parsing proto .prototools file.',
    );
    return null;
  }

  const { versions, plugins } = parsed.data;
  const deps = Object.entries(versions).map(([toolName, version]) => ({
    depName: toolName,
    currentValue: version,
    ...toolConfig(toolName, version, plugins[toolName], packageFile),
  }));

  return deps.length ? { deps } : null;
}

function toolConfig(
  name: string,
  version: string,
  locator: string | undefined,
  packageFile: string,
): Partial<PackageDependency> {
  if (versionAliases.has(version)) {
    return { skipReason: 'unsupported-version' };
  }

  // proto lets a configured locator override a built-in tool. The proto-plugin
  // datasource reads the plugin at lookup time, so extraction stays free of I/O.
  if (locator) {
    return pluginConfig(locator, packageFile);
  }

  return protoTooling[name]?.config ?? { skipReason: 'unsupported-datasource' };
}

function pluginConfig(
  locator: string,
  packageFile: string,
): Partial<PackageDependency> {
  // Only TOML plugins are read; JSON, YAML and WASM plugins are skipped.
  if (!locator.endsWith('.toml')) {
    return { skipReason: 'unsupported-datasource' };
  }

  // proto pins are bare while git tags are commonly `v`-prefixed.
  const extractVersion = '^v?(?<version>.+)';

  if (locator.startsWith('https://')) {
    return {
      datasource: ProtoPluginDatasource.id,
      packageName: locator,
      extractVersion,
    };
  }

  if (locator.startsWith('file://')) {
    const path = locator.slice('file://'.length);
    // An absolute path points outside the repository.
    if (path.startsWith('/')) {
      return { skipReason: 'unsupported-url' };
    }
    return {
      datasource: ProtoPluginDatasource.id,
      packageName: getSiblingFileName(packageFile, path),
      extractVersion,
    };
  }

  return { skipReason: 'unsupported-datasource' };
}
