import { isNullOrUndefined } from '@sindresorhus/is';
import type { AST } from 'toml-eslint-parser';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { safeStringify } from '../../../util/stringify.ts';
import { parseTOMLDocument } from '../../../util/toml.ts';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types.ts';
import * as lockfile from './lockfile.ts';
import { MiseLockFile } from './schema.ts';

const versionPrefixRegex = regEx(/^(?<prefix>[^\d]*)\d/);

function getToolName(depName: string, lockFileData: MiseLockFile): string {
  if (lockFileData.tools[depName]) {
    return depName;
  }

  const delimiterIndex = depName.indexOf(':');
  if (delimiterIndex !== -1) {
    const shortName = depName.substring(delimiterIndex + 1);
    if (lockFileData.tools[shortName]) {
      return shortName;
    }
  }

  return '';
}

function formatLockedVersion(
  currentVersion: string,
  newVersion: string,
): string {
  const currentPrefix =
    versionPrefixRegex.exec(currentVersion)?.groups?.prefix ?? '';
  const newPrefix = versionPrefixRegex.exec(newVersion)?.groups?.prefix;
  if (newPrefix !== undefined) {
    return `${currentPrefix}${newVersion.slice(newPrefix.length)}`;
  }
  return newVersion;
}

function getVersionKeyValue(key: AST.TOMLKey): string | undefined {
  if (key.keys.length !== 1) {
    return undefined;
  }

  const [part] = key.keys;
  return part.type === 'TOMLBare' ? part.name : part.value;
}

function getVersionValueNode(
  content: string,
  depName: string,
  lockFileData: MiseLockFile,
  currentVersion: string,
  newVersion: string,
): { currentLockedVersion: string; versionNode: AST.TOMLValue } | undefined {
  const toolName = getToolName(depName, lockFileData);
  const lockedTools = lockfile.getLockedTool(lockFileData, depName);
  if (!toolName || !lockedTools?.length) {
    return undefined;
  }

  const toolIndex =
    lockedTools.length === 1
      ? 0
      : lockedTools.findIndex(
          ({ version }) =>
            version === currentVersion ||
            formatLockedVersion(version, currentVersion) === version ||
            version === newVersion ||
            formatLockedVersion(version, newVersion) === version,
        );
  if (toolIndex === -1) {
    return undefined;
  }

  const table = astTableForTool(content, toolName, toolIndex);
  const versionKeyValue = table?.body.find(
    (keyValue) => getVersionKeyValue(keyValue.key) === 'version',
  );
  if (versionKeyValue?.value.type !== 'TOMLValue') {
    return undefined;
  }
  return {
    currentLockedVersion: lockedTools[toolIndex].version,
    versionNode: versionKeyValue.value,
  };
}

function astTableForTool(
  content: string,
  toolName: string,
  toolIndex: number,
): AST.TOMLTable | undefined {
  const ast = parseTOMLDocument(content);
  return ast.body[0]?.body.find(
    (node): node is AST.TOMLTable =>
      node.type === 'TOMLTable' &&
      node.kind === 'array' &&
      node.resolvedKey.length === 3 &&
      node.resolvedKey[0] === 'tools' &&
      node.resolvedKey[1] === toolName &&
      node.resolvedKey[2] === toolIndex,
  );
}

export function updateLockedDependency(
  config: UpdateLockedConfig,
): UpdateLockedResult {
  const { depName, newVersion, lockFile, lockFileContent } = config;
  logger.debug(
    `mise.updateLockedDependency: ${depName} -> ${newVersion} [${lockFile}]`,
  );

  if (!depName || !lockFileContent) {
    return { status: 'unsupported' };
  }

  try {
    const parsed = MiseLockFile.safeParse(lockFileContent);
    if (!parsed.success) {
      return { status: 'unsupported' };
    }

    const lockedVersion = getVersionValueNode(
      lockFileContent,
      depName,
      parsed.data,
      config.currentVersion,
      newVersion,
    );
    if (!lockedVersion) {
      return { status: 'unsupported' };
    }
    const { currentLockedVersion: currentVersionValue, versionNode } =
      lockedVersion;

    const currentLockedVersion = lockFileContent.slice(
      versionNode.range[0],
      versionNode.range[1],
    );
    const updatedVersion = formatLockedVersion(currentVersionValue, newVersion);
    if (currentVersionValue === updatedVersion) {
      return { status: 'already-updated' };
    }

    const quote = currentLockedVersion.startsWith("'") ? "'" : '"';
    const replacement =
      quote === "'" ? `'${updatedVersion}'` : safeStringify(updatedVersion);
    const files = {
      [lockFile]:
        lockFileContent.slice(0, versionNode.range[0]) +
        replacement +
        lockFileContent.slice(versionNode.range[1]),
    };
    if (!isNullOrUndefined(config.packageFileContent)) {
      // Keep the package file in the update set so mise's artifact refresh runs
      // for selector lockfile updates and regenerates platform metadata.
      files[config.packageFile] = config.packageFileContent;
    }
    return { status: 'updated', files };
  } catch (err) {
    logger.debug({ err }, 'mise.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
