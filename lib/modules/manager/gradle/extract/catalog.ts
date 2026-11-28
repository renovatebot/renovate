import { regEx } from '../../../../util/regex.ts';
import type { PackageDependency } from '../../types.ts';
import type { GradleManagerData } from '../types.ts';
import { isTOMLFile } from '../utils.ts';

export { parseCatalog } from '../../../../util/gradle-version-catalog/index.ts';

function makeCatalogGroupKey(
  dep: PackageDependency<GradleManagerData>,
): string {
  return `${dep.managerData!.packageFile}:${dep.managerData!.fileReplacePosition}`;
}

export function unifyCatalogSharedVariableNames(
  deps: PackageDependency<GradleManagerData>[],
): void {
  const aliasMap: Record<string, string[]> = {};
  const catalogDeps: PackageDependency<GradleManagerData>[] = [];

  for (const dep of deps) {
    const packageFile = dep.managerData?.packageFile;
    if (
      packageFile &&
      dep.managerData?.fileReplacePosition !== undefined &&
      dep.sharedVariableName &&
      isTOMLFile(packageFile)
    ) {
      catalogDeps.push(dep);

      const key = makeCatalogGroupKey(dep);
      (aliasMap[key] ??= []).push(dep.sharedVariableName);
    }
  }

  for (const dep of catalogDeps) {
    const key = makeCatalogGroupKey(dep);
    const aliases = aliasMap[key];
    if (aliases.length > 1) {
      const name = aliases[0];
      dep.sharedVariableName = name.replace(regEx(/^[^.]+\.versions\./), '');
    }
  }
}
