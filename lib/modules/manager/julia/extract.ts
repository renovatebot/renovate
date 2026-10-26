import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { JuliaGeneralMetadataDatasource } from '../../datasource/julia-general-metadata/index.ts';
import * as juliaVersioning from '../../versioning/julia/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { JuliaProject } from './schema.ts';

const uuidRegex = regEx(/^[0-9a-f]{8}-/i);

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
  const uuids = {
    ...parsed.data.extras,
    ...parsed.data.weakdeps,
    ...parsed.data.deps,
  };
  const deps: PackageDependency[] = [];
  for (const [depName, currentValue] of Object.entries(compat)) {
    // `julia` constrains the Julia version, not a registered package.
    if (depName === 'julia') {
      continue;
    }

    const dep: PackageDependency = {
      depName,
      depType: 'compat',
      currentValue,
      datasource: JuliaGeneralMetadataDatasource.id,
      versioning: juliaVersioning.id,
    };
    // Pkg shows a package as `[7876af07] Example`.
    const uuid = uuids[depName];
    if (uuid && uuidRegex.test(uuid)) {
      dep.commitMessageTopic = `${depName} [${uuid.slice(0, 8)}]`;
    }
    deps.push(dep);
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
