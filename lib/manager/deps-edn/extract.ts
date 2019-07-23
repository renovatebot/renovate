import { DEFAULT_MAVEN_REPO } from '../maven/extract';
import { expandDepName, DEFAULT_CLOJARS_REPO } from '../leiningen/extract';
import { PackageFile, PackageDependency } from '../common';

export function extractPackageFile(content: string): PackageFile {
  const deps: PackageDependency[] = [];

  const regex = /([^{\s,]*)[\s,]*{[\s,]*:mvn\/version[\s,]+"([^"]+)"[\s,]*}/;
  let rest = content;
  let match = rest.match(regex);
  let offset = 0;
  while (match) {
    const [wholeSubstr, depName, currentValue] = match;
    const fileReplacePosition =
      offset + match.index + wholeSubstr.indexOf(currentValue);

    offset += match.index + wholeSubstr.length;
    rest = content.slice(offset);
    match = rest.match(regex);

    deps.push({
      datasource: 'maven',
      depName: expandDepName(depName),
      currentValue,
      fileReplacePosition,
      registryUrls: [DEFAULT_CLOJARS_REPO, DEFAULT_MAVEN_REPO],
    });
  }

  return { deps };
}
