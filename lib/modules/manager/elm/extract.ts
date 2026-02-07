import { logger } from '../../../logger/index.ts';
import { ElmPackageDatasource } from '../../datasource/elm-package/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import * as elmVersioning from '../../versioning/elm/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import type {
  ElmApplicationJsonType,
  ElmJsonType,
  ElmPackageJsonType,
} from './schema.ts';
import { ElmJson } from './schema.ts';

type DepType =
  | 'dependencies:direct'
  | 'dependencies:indirect'
  | 'test-dependencies:direct'
  | 'test-dependencies:indirect'
  | 'dependencies'
  | 'test-dependencies';

function extractApplicationDeps(
  elmJson: ElmApplicationJsonType,
): PackageDependency[] {
  const deps: PackageDependency[] = [];

  const sections: {
    source: Record<string, string>;
    depType: DepType;
  }[] = [
    { source: elmJson.dependencies.direct, depType: 'dependencies:direct' },
    { source: elmJson.dependencies.indirect, depType: 'dependencies:indirect' },
    {
      source: elmJson['test-dependencies'].direct,
      depType: 'test-dependencies:direct',
    },
    {
      source: elmJson['test-dependencies'].indirect,
      depType: 'test-dependencies:indirect',
    },
  ];

  for (const { source, depType } of sections) {
    for (const [depName, currentValue] of Object.entries(source)) {
      deps.push({
        depName,
        currentValue,
        depType,
        datasource: ElmPackageDatasource.id,
        versioning: elmVersioning.id,
      });
    }
  }

  return deps;
}

function extractPackageDeps(elmJson: ElmPackageJsonType): PackageDependency[] {
  const deps: PackageDependency[] = [];

  const sections: {
    source: Record<string, string>;
    depType: DepType;
  }[] = [
    { source: elmJson.dependencies, depType: 'dependencies' },
    { source: elmJson['test-dependencies'], depType: 'test-dependencies' },
  ];

  for (const { source, depType } of sections) {
    for (const [depName, currentValue] of Object.entries(source)) {
      deps.push({
        depName,
        currentValue,
        depType,
        datasource: ElmPackageDatasource.id,
        versioning: elmVersioning.id,
      });
    }
  }

  return deps;
}

function extractElmVersion(elmJson: ElmJsonType): PackageDependency {
  return {
    depName: 'elm',
    packageName: 'elm/compiler',
    currentValue: elmJson['elm-version'],
    depType: 'elm-version',
    datasource: GithubTagsDatasource.id,
    versioning: elmVersioning.id,
  };
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    logger.debug({ packageFile }, 'Invalid JSON in elm.json');
    return null;
  }

  const result = ElmJson.safeParse(parsed);
  if (!result.success) {
    logger.debug(
      { packageFile, error: result.error },
      'Failed to parse elm.json',
    );
    return null;
  }

  const elmJson = result.data;

  const deps: PackageDependency[] =
    elmJson.type === 'application'
      ? extractApplicationDeps(elmJson)
      : extractPackageDeps(elmJson);

  deps.push(extractElmVersion(elmJson));

  return { deps };
}
