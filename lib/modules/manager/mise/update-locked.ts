import { type AST, parseTOML } from 'toml-eslint-parser';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import type { UpdateLockedConfig, UpdateLockedResult } from '../types.ts';
import * as lockfile from './lockfile.ts';
import { MiseLockFile } from './schema.ts';

const numericVersionRegex = regEx(/^\d/);
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
  const prefix = versionPrefixRegex.exec(currentVersion)?.groups?.prefix;
  if (prefix && numericVersionRegex.test(newVersion)) {
    return `${prefix}${newVersion}`;
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
): AST.TOMLValue | undefined {
  const toolName = getToolName(depName, lockFileData);
  if (!toolName || !lockfile.getLockedTool(lockFileData, depName)?.length) {
    return undefined;
  }

  const table = astTableForTool(content, toolName);
  const versionKeyValue = table?.body.find(
    (keyValue) => getVersionKeyValue(keyValue.key) === 'version',
  );
  return versionKeyValue?.value.type === 'TOMLValue'
    ? versionKeyValue.value
    : undefined;
}

function astTableForTool(
  content: string,
  toolName: string,
): AST.TOMLTable | undefined {
  const ast = parseTOML(content, { tomlVersion: '1.0' });
  const topLevelTable = ast.body[0];
  return topLevelTable.body.find(
    (node): node is AST.TOMLTable =>
      node.type === 'TOMLTable' &&
      node.kind === 'array' &&
      node.resolvedKey.length === 3 &&
      node.resolvedKey[0] === 'tools' &&
      node.resolvedKey[1] === toolName &&
      node.resolvedKey[2] === 0,
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

    const currentVersionValue = lockfile.getLockedVersion(parsed.data, depName);
    if (!currentVersionValue) {
      return { status: 'unsupported' };
    }

    const versionNode = getVersionValueNode(
      lockFileContent,
      depName,
      parsed.data,
    );
    if (!versionNode) {
      return { status: 'unsupported' };
    }

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
      quote === "'"
        ? `'${updatedVersion.replaceAll("'", "''")}'`
        : JSON.stringify(updatedVersion);
    const files = {
      [lockFile]:
        lockFileContent.slice(0, versionNode.range[0]) +
        replacement +
        lockFileContent.slice(versionNode.range[1]),
    };
    return { status: 'updated', files };
  } catch (err) {
    logger.debug({ err }, 'mise.updateLockedDependency() error');
    return { status: 'update-failed' };
  }
}
