import is from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { parse as parseToml } from '../../../util/toml.ts';
import { JuliaGeneralMetadataDatasource } from '../../datasource/julia-general-metadata/index.ts';
import * as juliaVersioning from '../../versioning/julia/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

interface JuliaProject {
  name?: string;
  version?: string;
  deps?: Record<string, string>;
  extras?: Record<string, string>;
  compat?: Record<string, string>;
}

const uuidRegex = regEx(/^[0-9a-f]{8}-/i);

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

  const depsSection = is.plainObject(project.deps) ? project.deps : {};
  const extrasSection = is.plainObject(project.extras) ? project.extras : {};

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

    const dep: PackageDependency = {
      depName,
      depType: 'compat',
      currentValue,
      datasource: JuliaGeneralMetadataDatasource.id,
      versioning: juliaVersioning.id,
    };

    // Decorate the PR title with the abbreviated UUID, matching Julia's
    // `Pkg.status` output (e.g. `[1520ce14] AbstractTrees`). Always-on
    // — UUIDs are how Julia disambiguates packages, and PR titles read
    // identically across public-only and (future) private-registry
    // setups.
    const fullUuid = depsSection[depName] ?? extrasSection[depName];
    if (is.string(fullUuid) && uuidRegex.test(fullUuid)) {
      dep.commitMessageTopic = `${depName} [${fullUuid.slice(0, 8)}]`;
    }

    deps.push(dep);
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
