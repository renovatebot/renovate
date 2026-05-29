import os from 'node:os';
import { isNonEmptyStringAndNotWhitespace, isString } from '@sindresorhus/is';
import fs from 'fs-extra';
import { quote } from 'shlex';
import { stringify as serializeToml } from 'smol-toml';
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
import type { MiseFile, MiseSettingValue, MiseTool } from './schema.ts';
import { parseTomlFile } from './utils.ts';

const managerFilePatterns = [
  '**/{,.}mise{,.*}.toml',
  '**/{,.}mise/config{,.*}.toml',
  '**/.config/mise{,.*}.toml',
  '**/.config/mise/{mise,config}{,.*}.toml',
  '**/.config/mise/conf.d/*.toml',
  '**/.rtx{,.*}.toml',
];

const allowedSettings = new Set([
  'disable_tools',
  'enable_tools',
  'locked',
  'locked_verify_provenance',
  'lockfile',
  'lockfile_platforms',
  'minimum_release_age',
  'slsa',
]);

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
    return null;
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
    const { mirrorRoot, mirroredLockFilePath, mirroredCwd } =
      await createSanitizedMirror({
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
    // v8 ignore else -- non-null path is exercised, but lcov reports it as uncovered here
    if (rawContent === null) {
      throw new Error(`Unable to read mise config file: ${file}`);
    }
    const sanitized = sanitizeMiseConfig(rawContent, file);
    if (!sanitized) {
      throw new Error(
        `Unable to sanitize mise config file safely (only literal [tools] and [settings] entries are supported): ${file}`,
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
  return renderSanitizedToml(parsed);
}

function renderSanitizedToml(misefile: MiseFile): string {
  const sanitizedConfig: {
    tools: Record<string, MiseTool>;
    settings?: Record<string, MiseSettingValue>;
  } = {
    tools: Object.fromEntries(
      Object.entries(misefile.tools).map(([name, toolData]) => [
        name,
        normalizeMiseTool(toolData),
      ]),
    ),
  };

  const sanitizedSettings = Object.fromEntries(
    Object.entries(misefile.settings).filter(([key]) =>
      allowedSettings.has(key),
    ),
  );

  if (Object.keys(sanitizedSettings).length > 0) {
    sanitizedConfig.settings = sanitizedSettings;
  }

  return serializeToml(sanitizedConfig);
}

function normalizeMiseTool(toolData: MiseTool): MiseTool {
  if (typeof toolData === 'string' || Array.isArray(toolData)) {
    return toolData;
  }
  return Object.fromEntries(
    Object.entries(toolData).filter(([, value]) => typeof value === 'string'),
  );
}
