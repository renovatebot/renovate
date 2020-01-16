import { DEFAULT_MAVEN_REPO } from '../maven/extract';
import { expandDepName, DEFAULT_CLOJARS_REPO } from '../leiningen/extract';
import {
  PackageFile,
  PackageDependency,
  ExtractPackageFileConfig,
} from '../common';
import { DATASOURCE_MAVEN } from '../../constants/data-binary-source';

export function extractPackageFile({
  fileContent,
}: ExtractPackageFileConfig): PackageFile {
  const deps: PackageDependency[] = [];

  const regex = /([^{\s,]*)[\s,]*{[\s,]*:mvn\/version[\s,]+"([^"]+)"[\s,]*}/;
  let rest = fileContent;
  let match = rest.match(regex);
  let offset = 0;
  while (match) {
    const [wholeSubstr, depName, currentValue] = match;
    const fileReplacePosition =
      offset + match.index + wholeSubstr.indexOf(currentValue);

    offset += match.index + wholeSubstr.length;
    rest = fileContent.slice(offset);
    match = rest.match(regex);

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
