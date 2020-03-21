import { CLOJARS_REPO, MAVEN_REPO } from '../../datasource/maven/common';
import { expandDepName } from '../leiningen/extract';
import { PackageFile, PackageDependency } from '../common';
import * as datasourceMaven from '../../datasource/maven';

export function extractPackageFile(content: string): PackageFile {
  const deps: PackageDependency[] = [];

  const regex = /([^{\s,]*)[\s,]*{[\s,]*:mvn\/version[\s,]+"([^"]+)"[\s,]*}/;
  let rest = content;
  let match = regex.exec(rest);
  let offset = 0;
  while (match) {
    const [wholeSubstr, depName, currentValue] = match;
    const fileReplacePosition =
      offset + match.index + wholeSubstr.indexOf(currentValue);

    offset += match.index + wholeSubstr.length;
    rest = content.slice(offset);
    match = regex.exec(rest);

    deps.push({
      datasource: datasourceMaven.id,
      depName: expandDepName(depName),
      currentValue,
      fileReplacePosition,
      registryUrls: [CLOJARS_REPO, MAVEN_REPO],
    });
  }

  return { deps };
}
