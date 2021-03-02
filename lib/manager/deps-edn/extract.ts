import * as datasourceClojure from '../../datasource/clojure';
import { expandDepName } from '../leiningen/extract';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile {
  const deps: PackageDependency[] = [];

  const regex = /([^{\s,]*)[\s,]*{[\s,]*:mvn\/version[\s,]+"([^"]+)"[\s,]*}/;
  let rest = content;
  let match = regex.exec(rest);
  let offset = 0;
  while (match) {
    const [wholeSubstr, depName, currentValue] = match;
    offset += match.index + wholeSubstr.length;
    rest = content.slice(offset);
    match = regex.exec(rest);

    deps.push({
      datasource: datasourceClojure.id,
      depName: expandDepName(depName),
      currentValue,
      registryUrls: [],
    });
  }

  return { deps };
}
