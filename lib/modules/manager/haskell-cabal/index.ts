import type { Category } from '../../../constants/index.ts';
import type { RangeStrategy } from '../../../types/index.ts';
import { HackageDatasource } from '../../datasource/hackage/index.ts';
import * as pvpVersioning from '../../versioning/pvp/index.ts';
import type {
  PackageDependency,
  PackageFileContent,
  RangeConfig,
} from '../types.ts';
import type { CabalDependency } from './extract.ts';
import { extractNamesAndRanges, findDepends } from './extract.ts';

export const defaultConfig = {
  managerFilePatterns: ['/\\.cabal$/'],
  pinDigests: false,
};

export const categories: Category[] = ['haskell'];

export const supportedDatasources = [HackageDatasource.id];

export function extractPackageFile(content: string): PackageFileContent {
  const deps = [];
  let current = content;
  for (;;) {
    const maybeContent = findDepends(current);
    if (maybeContent === null) {
      break;
    }
    const cabalDeps: CabalDependency[] = extractNamesAndRanges(
      maybeContent.buildDependsContent,
    );
    for (const cabalDep of cabalDeps) {
      const dep: PackageDependency = {
        depName: cabalDep.packageName,
        currentValue: cabalDep.currentValue,
        datasource: HackageDatasource.id,
        packageName: cabalDep.packageName,
        versioning: pvpVersioning.id,
        replaceString: cabalDep.replaceString.trim(),
        autoReplaceStringTemplate: '{{{depName}}} {{{newValue}}}',
      };
      deps.push(dep);
    }
    current = current.slice(maybeContent.lengthProcessed);
  }
  return { deps };
}

export function getRangeStrategy({
  rangeStrategy,
}: RangeConfig): RangeStrategy {
  if (rangeStrategy === 'auto') {
    return 'widen';
  }
  return rangeStrategy!;
}
