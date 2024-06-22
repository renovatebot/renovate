import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split(newlineRegex);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];

      const firstLineMatch = regEx(
        /^(?<leading>\s* image:\s*)(?<replaceString>['"](?<currentFrom>[^\s'"]+)\\)$/,
      ).exec(line);

      if (firstLineMatch?.groups) {
        let currentFrom = firstLineMatch.groups.currentFrom;
        let replaceString = firstLineMatch.groups.replaceString;

        for (let i = lineNumber + 1; i < lines.length; i += 1) {
          const internalLine = lines[i];
          const middleLineMatch = regEx(
            /^(?<replaceString>\s*(?<currentFrom>[^\s'"]+)\\)$/,
          ).exec(internalLine);
          if (middleLineMatch?.groups) {
            currentFrom += middleLineMatch.groups.currentFrom;
            replaceString += '\n' + middleLineMatch.groups.replaceString;
          } else {
            const finalLineMatch = regEx(
              /^(?<replaceString>\s*(?<currentFrom>[^\s'"]+)['"])$/,
            ).exec(internalLine);
            if (finalLineMatch?.groups) {
              currentFrom += finalLineMatch.groups.currentFrom;
              replaceString += '\n' + finalLineMatch.groups.replaceString;

              const dep = getDep(currentFrom, true, config.registryAliases);
              dep.depType = 'docker';
              dep.replaceString = replaceString;
              if (dep.autoReplaceStringTemplate) {
                const d = '@{{newDigest}}';
                const c = firstLineMatch.groups.leading.length + 1;
                const nd = `\\\n${' '.repeat(c)}${d}`;
                const replaced = dep.autoReplaceStringTemplate.replace(d, nd);
                dep.autoReplaceStringTemplate = `"${replaced}"`;
              }
              deps.push(dep);
            }
            break;
          }
        }
      } else {
        const match = regEx(
          /^\s* image:\s*'?"?(?<currentFrom>[^\s'"]+)'?"?\s*$/,
        ).exec(line);
        if (match?.groups) {
          const dep = getDep(
            match.groups.currentFrom,
            true,
            config.registryAliases,
          );
          dep.depType = 'docker';
          deps.push(dep);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Error extracting DroneCI images');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
