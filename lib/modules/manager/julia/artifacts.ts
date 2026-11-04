import { quote } from 'shlex';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import dataFiles from '../../../data-files.generated.ts';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { getEnv } from '../../../util/env.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import { ensureCacheDir, readLocalFile } from '../../../util/fs/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { artifactErrorResult, updateLockFile } from '../util.ts';
import { JuliaProject } from './schema.ts';
import {
  getJuliaMinor,
  getJuliaupChannel,
  getManifestFileNames,
} from './utils.ts';

/**
 * The juliaup settings that the host may set: where juliaup keeps its Julia
 * versions, and the mirrors it downloads them from.
 */
const juliaupEnvNames = [
  'JULIAUP_DEPOT_PATH',
  'JULIAUP_SERVER',
  'JULIAUP_NIGHTLY_SERVER',
];

/**
 * Returns whether juliaup is installed, whose `julia` launcher runs
 * `julia +<version>` in that Julia version.
 */
async function hasJuliaup(execOptions: ExecOptions): Promise<boolean> {
  try {
    await exec('juliaup --version', execOptions);
    return true;
  } catch {
    return false;
  }
}

/**
 * Updates each manifest of the project with Pkg, in the Julia that runs it.
 * Builds and artifact downloads are skipped unless the repository may run
 * package scripts, `allowScripts` with `ignoreScripts=false`.
 */
export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`julia.updateArtifacts(${packageFileName})`);
  const { isLockFileMaintenance } = config;

  if (!isLockFileMaintenance && !updatedDeps.length) {
    logger.debug('No updated julia deps - returning null');
    return null;
  }

  const lockFileNames = await getManifestFileNames(
    packageFileName,
    JuliaProject.safeParse(newPackageFileContent).data?.manifest,
  );
  const packageSpecs = isLockFileMaintenance
    ? []
    : updatedDeps.flatMap(({ depName, newVersion }) =>
        depName && newVersion ? [`${depName}@${newVersion}`] : [],
      );
  const runsScripts =
    GlobalConfig.get('allowScripts') === true && config.ignoreScripts === false;
  const script = [
    runsScripts
      ? ''
      : dataFiles.get('data/julia/skip-builds-and-artifacts.jl')!,
    dataFiles.get('data/julia/update-manifest.jl')!,
  ].join('\n');

  const env = getEnv();
  const juliaupEnv = Object.fromEntries(
    juliaupEnvNames.flatMap((name) => (env[name] ? [[name, env[name]]] : [])),
  );
  const usesJuliaup =
    GlobalConfig.get('binarySource') === 'global' &&
    (await hasJuliaup({ cwdFile: packageFileName, extraEnv: juliaupEnv }));

  const results: UpdateArtifactsResult[] = [];
  for (const lockFileName of lockFileNames) {
    const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (!existingLockFileContent) {
      logger.debug(`No ${lockFileName} found`);
      continue;
    }

    const cmd = [
      'julia',
      ...(usesJuliaup
        ? [quote(`+${getJuliaupChannel(existingLockFileContent)}`)]
        : []),
      '--startup-file=no --history-file=no --project=.',
      `-e ${quote(script)}`,
      quote(upath.relative(upath.dirname(packageFileName), lockFileName)),
      ...packageSpecs.map(quote),
    ].join(' ');
    try {
      const execOptions: ExecOptions = {
        cwdFile: packageFileName,
        extraEnv: {
          // Julia 1.13 stores the General registry as a `.tar.zst`, which
          // Julia 1.7 to 1.12 can't read, so each minor version has a depot.
          JULIA_DEPOT_PATH: await ensureCacheDir(
            `julia/${getJuliaMinor(existingLockFileContent)}`,
          ),
          JULIA_PKG_PRECOMPILE_AUTO: '0',
          ...juliaupEnv,
        },
      };
      results.push(
        ...coerceArray(
          await updateLockFile({
            lockFileName,
            existingLockFileContent,
            packageFile: {
              path: packageFileName,
              contents: newPackageFileContent,
            },
            run: () => exec(cmd, execOptions),
          }),
        ),
      );
    } catch (err) {
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.warn(
        { lockfile: lockFileName, err },
        'Failed to update lock file',
      );
      results.push(...artifactErrorResult(lockFileName, err));
    }
  }
  return results.length ? results : null;
}
