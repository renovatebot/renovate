import { logger } from '../../../logger/index.ts';
import { CdnjsDatasource } from '../../datasource/cdnjs/index.ts';
import { JsDelivrDatasource } from '../../datasource/jsdelivr/index.ts';
import { UnpkgDatasource } from '../../datasource/unpkg/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { LibmanFile, type LibmanLibrary } from './schema.ts';

function parseLibrary(library: string): {
  name: string;
  currentValue?: string;
} {
  // The `library` value has the format `<name>@<version>`. Scoped npm
  // packages (e.g. `@popperjs/core@2.11.6`) also start with an `@`, so we
  // split on the *last* `@` rather than the first one.
  const atIndex = library.lastIndexOf('@');
  if (atIndex > 0) {
    return {
      name: library.slice(0, atIndex),
      currentValue: library.slice(atIndex + 1),
    };
  }
  return { name: library };
}

function getDep(
  lib: LibmanLibrary,
  defaultProvider: string | undefined,
): PackageDependency | null {
  const provider = lib.provider ?? defaultProvider;
  if (!provider) {
    return null;
  }

  const { name, currentValue } = parseLibrary(lib.library);
  if (!name) {
    return null;
  }

  const dep: PackageDependency = {
    depName: name,
    currentValue,
  };

  switch (provider) {
    case 'filesystem':
      // The `filesystem` provider references files local to the repository
      // and has no version/registry to check for updates, so we extract it
      // (for visibility in the dependency dashboard) but mark it as skipped.
      dep.skipReason = 'local-dependency';
      return dep;
    case 'cdnjs': {
      const asset = lib.files?.[0];
      dep.datasource = CdnjsDatasource.id;
      dep.packageName = asset ? `${name}/${asset}` : name;
      break;
    }
    case 'jsdelivr': {
      dep.datasource = JsDelivrDatasource.id;
      dep.packageName = `npm/${name}`;
      break;
    }
    case 'unpkg': {
      dep.datasource = UnpkgDatasource.id;
      dep.packageName = name;
      break;
    }
    default:
      dep.skipReason = 'unsupported-datasource';
      return dep;
  }

  if (!currentValue) {
    dep.skipReason = 'unspecified-version';
  }

  return dep;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  let libmanFile: LibmanFile;
  try {
    libmanFile = LibmanFile.parse(content);
  } catch (err) {
    logger.debug({ packageFile, err }, 'Invalid libman.json file');
    return null;
  }

  const deps: PackageDependency[] = [];
  for (const lib of libmanFile.libraries ?? []) {
    const dep = getDep(lib, libmanFile.defaultProvider);
    if (dep) {
      deps.push(dep);
    }
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}
