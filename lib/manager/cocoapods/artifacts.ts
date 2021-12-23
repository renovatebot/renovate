import { quote } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { exec } from '../../util/exec';
import type { ExecOptions } from '../../util/exec/types';
import {
  ensureCacheDir,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import { getRepoStatus } from '../../util/git';
import { regEx } from '../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

const pluginRegex = regEx(`^\\s*plugin\\s*(['"])(?<plugin>[^'"]+)(['"])`);

function getPluginCommands(content: string): string[] {
  const result = new Set<string>();
  const lines: string[] = content.split('\n');
  lines.forEach((line) => {
    const match = pluginRegex.exec(line);
    if (match) {
      const { plugin } = match.groups;
      result.add(`gem install ${quote(plugin)}`);
    }
  });
  return [...result];
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`cocoapods.getArtifacts(${packageFileName})`);

  if (updatedDeps.length < 1) {
    logger.debug('CocoaPods: empty update - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'Podfile.lock');

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
  } catch (err) {
    logger.warn({ err }, 'Podfile could not be written');
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }

  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug(`Lockfile not found: ${lockFileName}`);
    return null;
  }

  const match = regEx(/^COCOAPODS: (?<cocoapodsVersion>.*)$/m).exec(
    existingLockFileContent
  );
  const tagConstraint = match?.groups?.cocoapodsVersion ?? null;

  const cmd = [...getPluginCommands(newPackageFileContent), 'pod install'];
  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    extraEnv: {
      CP_HOME_DIR: await ensureCacheDir('cocoapods'),
    },
    docker: {
      image: 'cocoapods',
      tagScheme: 'ruby',
      tagConstraint,
    },
  };

  try {
    await exec(cmd, execOptions);
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.stderr || err.stdout || err.message,
        },
      },
    ];
  }

  const status = await getRepoStatus();
  if (!status.modified.includes(lockFileName)) {
    return null;
  }
  logger.debug(`Returning updated lockfile: ${lockFileName}`);
  const lockFileContent = await readLocalFile(lockFileName);
  const res: UpdateArtifactsResult[] = [
    {
      file: {
        name: lockFileName,
        contents: lockFileContent,
      },
    },
  ];

  const podsDir = upath.join(upath.dirname(packageFileName), 'Pods');
  const podsManifestFileName = upath.join(podsDir, 'Manifest.lock');
  if (await readLocalFile(podsManifestFileName, 'utf8')) {
    for (const f of status.modified.concat(status.not_added)) {
      if (f.startsWith(podsDir)) {
        res.push({
          file: {
            name: f,
            contents: await readLocalFile(f),
          },
        });
      }
    }
    for (const f of status.deleted || []) {
      res.push({
        file: {
          name: '|delete|',
          contents: f,
        },
      });
    }
  }
  return res;
}
