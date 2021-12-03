import { ClojureDatasource } from '../../datasource/clojure';
import { regEx } from '../../util/regex';
import { expandDepName } from '../leiningen/extract';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile {
  const deps: PackageDependency[] = [];

  const regex = regEx(
    /([^{\s,]*)[\s,]*{[\s,]*:mvn\/version[\s,]+"([^"]+)"[\s,]*}/
  );
  let rest = content;
  let match = regex.exec(rest);
  let offset = 0;
  while (match) {
    const [wholeSubstr, depName, currentValue] = match;
    offset += match.index + wholeSubstr.length;
    rest = content.slice(offset);
    match = regex.exec(rest);

    deps.push({
      datasource: ClojureDatasource.id,
      depName: expandDepName(depName),
      currentValue,
      registryUrls: [],
    });
  }

  return { deps };
}
