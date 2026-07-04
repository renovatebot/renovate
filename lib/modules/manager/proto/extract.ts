import { logger } from '../../../logger/index.ts';
import { getSiblingFileName } from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { isHttpUrl } from '../../../util/url.ts';
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
      'proto: failed to parse .prototools file',
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

  const builtin = protoTooling[name]?.config;
  if (builtin) {
    return builtin;
  }

  // A non-built-in tool is resolvable via its plugin locator; the proto-plugin
  // datasource reads the plugin definition (locally or over http) at lookup
  // time, so extraction stays free of I/O.
  return locator
    ? pluginConfig(locator, packageFile)
    : { skipReason: 'unsupported-datasource' };
}

function pluginConfig(
  locator: string,
  packageFile: string,
): Partial<PackageDependency> {
  // WASM plugins carry no introspectable version source.
  if (locator.endsWith('.wasm')) {
    return { skipReason: 'unsupported-datasource' };
  }

  // proto pins are bare while git tags are commonly `v`-prefixed.
  const extractVersion = '^v?(?<version>.+)';

  if (isHttpUrl(locator)) {
    return {
      datasource: ProtoPluginDatasource.id,
      packageName: locator,
      extractVersion,
    };
  }

  if (locator.startsWith('file://')) {
    const relativePath = locator.replace(regEx(/^file:\/\//), '');
    return {
      datasource: ProtoPluginDatasource.id,
      packageName: getSiblingFileName(packageFile, relativePath),
      extractVersion,
    };
  }

  return { skipReason: 'unsupported-datasource' };
}
