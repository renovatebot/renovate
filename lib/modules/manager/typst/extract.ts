import stripJsonComments from 'strip-json-comments';
import { newlineRegex } from '../../../util/regex.ts';
import { TypstDatasource } from '../../datasource/typst/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

export function extractPackageFile(content: string): PackageFileContent {
  const lines = stripJsonComments(content).split(newlineRegex);
  const deps: PackageDependency[] = [];

  const importRegex =
    /#import\s+"@(?<namespace>[^/]+)\/(?<pkg>[^:]+):(?<version>[^"]+)"/g;

  for (const line of lines) {
    for (const match of line.matchAll(importRegex)) {
      const { namespace, pkg, version } = match.groups!;
      const dep: PackageDependency = {
        datasource: TypstDatasource.id,
        packageName: `${namespace}/${pkg}`,
        currentValue: version,
      };

      if (namespace === 'preview') {
        dep.depName = pkg;
      }

      if (namespace !== 'preview') {
        dep.skipReason = namespace === 'local' ? 'local' : 'unsupported';
      }

      deps.push(dep);
    }
  }

  return { deps };
}
