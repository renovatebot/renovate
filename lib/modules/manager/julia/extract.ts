import { logger } from '../../../logger/index.ts';
import { coerceObject } from '../../../util/object.ts';
import { regEx } from '../../../util/regex.ts';
import { JuliaDatasource } from '../../datasource/julia/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { JuliaProject } from './schema.ts';

const uuidRegex = regEx(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
);

// Standard libraries that ship only with Julia, so General has no versions for
// them. Taken from `stdlib/` in JuliaLang/julia.
const unregisteredStdlibs = new Set([
  'Base64',
  'CRC32c',
  'Dates',
  'Distributed',
  'FileWatching',
  'Future',
  'InteractiveUtils',
  'Libdl',
  'LibGit2',
  'LinearAlgebra',
  'Logging',
  'Markdown',
  'Mmap',
  'Pkg',
  'Printf',
  'Profile',
  'Random',
  'REPL',
  'Serialization',
  'SharedArrays',
  'Sockets',
  'SparseArrays',
  'SuiteSparse',
  'Test',
  'Unicode',
  'UUIDs',
]);

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

  const { version, compat = {}, sources = {}, targets = {} } = parsed.data;
  // A package listed in several sections is a dependency of the first.
  const sections = (['deps', 'weakdeps', 'extras'] as const).map((depType) => ({
    depType,
    uuids: coerceObject(parsed.data[depType]),
  }));
  const deps: PackageDependency[] = [];
  for (const [depName, currentValue] of Object.entries(compat)) {
    // `julia` constrains the Julia version, not a registered package.
    if (depName === 'julia') {
      continue;
    }

    const section = sections.find(({ uuids }) => depName in uuids);
    let depType = section?.depType ?? 'compat';
    if (depType === 'extras') {
      // `[targets]` names the `[extras]` packages of each target.
      depType =
        (['test', 'build'] as const).find((target) =>
          targets[target]?.includes(depName),
        ) ?? depType;
    }
    const dep: PackageDependency = {
      depName,
      depType,
      currentValue,
      datasource: JuliaDatasource.id,
    };
    const uuid = section?.uuids[depName];
    if (uuid && uuidRegex.test(uuid)) {
      // Another registry's package can have the name of a General package.
      dep.packageName = `${depName}=${uuid}`;
    }
    // `[sources]` takes the package from a git repository or a local path
    // instead of a registry.
    if (sources[depName]?.url) {
      dep.skipReason = 'git-dependency';
    } else if (sources[depName]?.path) {
      dep.skipReason = 'path-dependency';
    } else if (unregisteredStdlibs.has(depName)) {
      dep.skipReason = 'unsupported';
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
