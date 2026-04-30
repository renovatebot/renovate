import is from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { parse as parseToml } from '../../../util/toml.ts';
import { JuliaGeneralMetadataDatasource } from '../../datasource/julia-general-metadata/index.ts';
import * as juliaVersioning from '../../versioning/julia/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

interface JuliaProject {
  name?: string;
  version?: string;
  deps?: Record<string, string>;
  compat?: Record<string, string>;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  let project: JuliaProject;
  try {
    project = parseToml(content) as JuliaProject;
  } catch (err) {
    logger.debug({ err, packageFile }, 'julia: failed to parse Project.toml');
    return null;
  }

  if (!is.plainObject(project.compat)) {
    return null;
  }

  const deps: PackageDependency[] = [];
  for (const [depName, currentValue] of Object.entries(project.compat)) {
    if (!is.string(currentValue)) {
      continue;
    }
    // The `julia` entry constrains the language runtime itself, not a
    // package in the General registry. Skip until a Julia-runtime
    // datasource exists.
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
  if (is.string(project.version)) {
    result.packageFileVersion = project.version;
  }
  return result;
}
