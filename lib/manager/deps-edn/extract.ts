import { DEFAULT_MAVEN_REPO } from '../maven/extract';
import { expandDepName, DEFAULT_CLOJARS_REPO } from '../leiningen/extract';
import { PackageFile, PackageDependency } from '../common';
import { DATASOURCE_MAVEN } from '../../constants/data-binary-source';

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
      datasource: DATASOURCE_MAVEN,
      depName: expandDepName(depName),
      currentValue,
      fileReplacePosition,
      registryUrls: [DEFAULT_CLOJARS_REPO, DEFAULT_MAVEN_REPO],
    });
  }

  return { deps };
}
