import upath from 'upath';
import { z } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import {
  findLocalSiblingOrParent,
  getParentDir,
  getSiblingFileName,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { coerceObject } from '../../../util/object.ts';
import { LooseRecord, Toml } from '../../../util/schema-utils/index.ts';
import type { PixiLockFile } from './types.ts';

const PathDependencies = LooseRecord(z.object({ path: z.string() }))
  .catch({})
  .transform((deps) => Object.values(deps).map(({ path }) => path));

const PypiDependencyTables = z.object({
  'pypi-dependencies': PathDependencies.optional(),
  target: LooseRecord(
    z.object({ 'pypi-dependencies': PathDependencies.optional() }),
  ).optional(),
});

const RequiresPixi = z
  .object({ 'requires-pixi': z.string().optional() })
  .optional()
  .catch(undefined);

/**
 * `$` of `pixi.toml` or `$.tool.pixi` of `pyproject.toml`, reduced to
 * `requires-pixi` and the `path` of every pypi dependency across the default
 * feature, named features and platform targets.
 */
const PixiWorkspace = PypiDependencyTables.extend({
  feature: LooseRecord(PypiDependencyTables).optional(),
  workspace: RequiresPixi,
  project: RequiresPixi,
}).transform(({ feature, workspace, project, ...defaultFeature }) => ({
  requiresPixi: workspace?.['requires-pixi'] ?? project?.['requires-pixi'],
  pathDependencies: [
    defaultFeature,
    ...Object.values(coerceObject(feature)),
  ].flatMap((tables) => [
    ...coerceArray(tables['pypi-dependencies']),
    ...Object.values(coerceObject(tables.target)).flatMap((target) =>
      coerceArray(target['pypi-dependencies']),
    ),
  ]),
}));

type PixiWorkspace = z.infer<typeof PixiWorkspace>;

const PixiTomlWorkspace = Toml.pipe(PixiWorkspace);

const PyProjectWorkspace = Toml.pipe(
  z.object({ tool: z.object({ pixi: PixiWorkspace }) }),
).transform(({ tool }) => tool.pixi);

async function getWorkspace(
  workspaceDir: string,
): Promise<PixiWorkspace | null> {
  // `pixi` prefers `pixi.toml` over `pyproject.toml` in the same directory.
  const pixiToml = await readLocalFile(
    upath.join(workspaceDir, 'pixi.toml'),
    'utf8',
  );
  if (pixiToml !== null) {
    return PixiTomlWorkspace.safeParse(pixiToml).data ?? null;
  }

  const pyProject = await readLocalFile(
    upath.join(workspaceDir, 'pyproject.toml'),
    'utf8',
  );
  if (pyProject !== null) {
    return PyProjectWorkspace.safeParse(pyProject).data ?? null;
  }

  return null;
}

/**
 * Find the `pixi.lock` that covers a package file.
 *
 * A sibling `pixi.lock` is always used. Otherwise the nearest parent
 * `pixi.lock` is used only if its workspace manifest references the package
 * file's directory as a path dependency, since `pixi` records the metadata of
 * such packages in the lock file.
 */
export async function findPixiLockFile(
  packageFile: string,
): Promise<PixiLockFile | null> {
  const lockFileName = await findLocalSiblingOrParent(packageFile, 'pixi.lock');
  if (!lockFileName) {
    return null;
  }

  if (lockFileName === getSiblingFileName(packageFile, 'pixi.lock')) {
    return { lockFileName, isParent: false };
  }

  const workspaceDir = getParentDir(lockFileName);
  const packageDir = getParentDir(packageFile);
  const workspace = await getWorkspace(workspaceDir);
  if (
    workspace?.pathDependencies.some(
      (path) =>
        upath.normalizeTrim(upath.join(workspaceDir, path)) === packageDir,
    )
  ) {
    return {
      lockFileName,
      isParent: true,
      requiresPixi: workspace.requiresPixi,
    };
  }

  logger.debug(
    { packageFile, lockFileName },
    'pixi workspace does not reference package file',
  );
  return null;
}
