import { logger } from '../../../logger/index.ts';
import { JuliaGeneralMetadataDatasource } from '../../datasource/julia-general-metadata/index.ts';
import * as juliaVersioning from '../../versioning/julia/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { JuliaProject } from './schema.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const parsed = JuliaProject.safeParse(content);
  if (!parsed.success) {
    logger.debug(
      { packageFile, err: parsed.error },
      'Failed to parse Julia project file',
    );
    return null;
  }

  const { version, compat = {} } = parsed.data;
  const deps: PackageDependency[] = [];
  for (const [depName, currentValue] of Object.entries(compat)) {
    // `julia` constrains the Julia version, not a registered package.
    if (depName === 'julia') {
      continue;
    }

    deps.push({
      depName,
      depType: 'compat',
      currentValue,
      datasource: JuliaGeneralMetadataDatasource.id,
      versioning: juliaVersioning.id,
    });
  }

  if (deps.length === 0) {
    return null;
  }

  const result: PackageFileContent = { deps };
  if (version) {
    result.packageFileVersion = version;
  }
  return result;
}
