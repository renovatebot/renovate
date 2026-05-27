import os from 'node:os';
import { isNonEmptyStringAndNotWhitespace, isString } from '@sindresorhus/is';
import fs from 'fs-extra';
import { quote } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { findGithubToken } from '../../../util/check-token.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions, ExtraEnv } from '../../../util/exec/types.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { getFileList } from '../../../util/git/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { matchRegexOrGlob } from '../../../util/string-match.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { getConfigType, getLockFileName } from './lockfile.ts';
import type { MiseFile, MiseTool } from './schema.ts';
import { parseTomlFile } from './utils.ts';

const managerFilePatterns = [
  '**/{,.}mise{,.*}.toml',
  '**/{,.}mise/config{,.*}.toml',
  '**/.config/mise{,.*}.toml',
  '**/.config/mise/{mise,config}{,.*}.toml',
  '**/.config/mise/conf.d/*.toml',
  '**/.rtx{,.*}.toml',
];

/**
 * Updates mise lock files when dependencies are updated.
 * Runs `mise lock` for lock file maintenance or `mise lock <tools>` for targeted updates.
 */
export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const lockFileName = getLockFileName(packageFileName);
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug({ lockFileName }, 'No mise lock file found');
    return [
      {
        artifactError: {
          fileName: lockFileName,
          stderr:
            'mise lock file updating requires an existing lock file to refresh',
        },
      },
    ];
  }

  const { isLocal, env } = getConfigType(packageFileName);
  const localFlag = isLocal ? ' --local' : '';

  let cmd: string;
  if (config.isLockFileMaintenance) {
    cmd = `mise lock${localFlag}`;
  } else {
    const tools = updatedDeps
      .map(({ depName }) => depName)
      .filter(isNonEmptyStringAndNotWhitespace)
      .map(quote)
      .join(' ');
    cmd = tools ? `mise lock${localFlag} ${tools}` : `mise lock${localFlag}`;
  }

  const extraEnv: ExtraEnv = {};
  if (env) {
    extraEnv.MISE_ENV = env;
  }
  const token = findGithubToken(
    hostRules.find({
      hostType: 'github',
      url: 'https://api.github.com/',
    }),
  );
  if (token) {
    extraEnv.GITHUB_TOKEN = token;
  }

  const execOptions: ExecOptions = {
    extraEnv,
    toolConstraints: [
      {
        toolName: 'mise',
        constraint: config.constraints?.mise,
      },
    ],
    docker: {},
  };

  try {
    const {
      mirrorRoot,
      mirroredLockFilePath,
      mirroredCwd,
      mirroredPackageFilePath,
    } = await createSanitizedMirror({
      packageFileName,
      lockFileName,
      newPackageFileContent,
      existingLockFileContent,
    });
    execOptions.env = {
      ...execOptions.env,
      HOME: upath.join(mirrorRoot, '.home'),
      XDG_CONFIG_HOME: upath.join(mirrorRoot, '.home/.config'),
    };
    execOptions.cwd = mirroredCwd;
    await exec(
      `mise trust ${quote(mirroredPackageFilePath.replace(`${mirroredCwd}/`, ''))}`,
      execOptions,
    );
    await exec(cmd, execOptions);
    const newLockFileContent = await fs.readFile(mirroredLockFilePath, 'utf8');
    if (existingLockFileContent === newLockFileContent) {
      return null;
    }

    logger.debug({ lockFileName }, 'Returning updated mise lock file');
    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newLockFileContent,
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if: not worth testing
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }

    const errorOutput = [err.stdout, err.stderr, err.message]
      .filter(isString)
      .join('\n');

    logger.warn({ err }, `Error updating ${lockFileName}`);
    return [
      {
        artifactError: {
          fileName: lockFileName,
          stderr: errorOutput,
        },
      },
    ];
  }
}

async function createSanitizedMirror({
  packageFileName,
  lockFileName,
  newPackageFileContent,
  existingLockFileContent,
}: {
  packageFileName: string;
  lockFileName: string;
  newPackageFileContent: string;
  existingLockFileContent: string;
}): Promise<{
  mirrorRoot: string;
  mirroredLockFilePath: string;
  mirroredCwd: string;
  mirroredPackageFilePath: string;
}> {
  const configFiles = await getSameScopeConfigFiles(
    packageFileName,
    lockFileName,
  );
  const mirrorRoot = await fs.mkdtemp(
    upath.join(upath.toUnix(os.tmpdir()), 'renovate-mise-'),
  );

  for (const file of configFiles) {
    const rawContent =
      file === packageFileName
        ? newPackageFileContent
        : await readLocalFile(file, 'utf8');
    /* v8 ignore next -- covered by tests, but v8 attributes the throw path to the condition line */
    if (rawContent === null) {
      throw new Error(`Unable to read mise config file: ${file}`);
    }
    const sanitized = sanitizeMiseConfig(rawContent, file);
    if (!sanitized) {
      throw new Error(
        `Unable to sanitize mise config file safely (only literal [tools] entries are supported): ${file}`,
      );
    }
    const mirroredFilePath = upath.join(mirrorRoot, file);
    await fs.ensureDir(upath.dirname(mirroredFilePath));
    await fs.writeFile(mirroredFilePath, sanitized, 'utf8');
  }

  const mirroredLockFilePath = upath.join(mirrorRoot, lockFileName);
  await fs.ensureDir(upath.dirname(mirroredLockFilePath));
  await fs.writeFile(mirroredLockFilePath, existingLockFileContent, 'utf8');

  return {
    mirrorRoot,
    mirroredLockFilePath,
    mirroredCwd: upath.join(mirrorRoot, upath.dirname(packageFileName)),
    mirroredPackageFilePath: upath.join(mirrorRoot, packageFileName),
  };
}

async function getSameScopeConfigFiles(
  packageFileName: string,
  lockFileName: string,
): Promise<string[]> {
  const allFiles = await getFileList();
  const matchedFiles = allFiles.filter((file) =>
    managerFilePatterns.some((pattern) => matchRegexOrGlob(file, pattern)),
  );
  const configFiles = [...new Set([...matchedFiles, packageFileName])];
  return configFiles.filter((file) => getLockFileName(file) === lockFileName);
}

function sanitizeMiseConfig(
  content: string,
  packageFile: string,
): string | null {
  const parsed = parseTomlFile(content, packageFile);
  if (!parsed) {
    return null;
  }
  return renderToolsOnlyToml(parsed);
}

function renderToolsOnlyToml(misefile: MiseFile): string {
  const lines = ['[tools]'];
  const entries = Object.entries(misefile.tools);
  for (const [name, toolData] of entries) {
    lines.push(`${quoteTomlKey(name)} = ${renderMiseTool(toolData)}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderMiseTool(toolData: MiseTool): string {
  if (typeof toolData === 'string') {
    return JSON.stringify(toolData);
  }
  if (Array.isArray(toolData)) {
    return `[${toolData.map((item) => JSON.stringify(item)).join(', ')}]`;
  }
  const parts = Object.entries(toolData)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => `${key} = ${JSON.stringify(value)}`);
  return `{ ${parts.join(', ')} }`;
}

function quoteTomlKey(key: string): string {
  return JSON.stringify(key);
}
