import { logger } from '../../../logger';
import { findLocalSiblingOrParent, localPathExists } from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
import { HexDatasource } from '../../datasource/hex';
import type { PackageDependency, PackageFile } from '../types';

const depSectionRegExp = regEx(/defp\s+deps.*do/g);
const depMatchRegExp = regEx(
  /{:(?<depName>\w+),\s*(?<datasource>[^:"]+)?:?\s*"(?<currentValue>[^"]+)",?\s*(?:organization: "(?<organization>.*)")?.*}/gm
);
const commentMatchRegExp = regEx(/#.*$/);

export async function extractPackageFile(
  content: string,
  fileName: string
): Promise<PackageFile | null> {
  logger.trace('mix.extractPackageFile()');
  const deps: PackageDependency[] = [];
  const contentArr = content
    .split(newlineRegex)
    .map((line) => line.replace(commentMatchRegExp, ''));
  for (let lineNumber = 0; lineNumber < contentArr.length; lineNumber += 1) {
    if (contentArr[lineNumber].match(depSectionRegExp)) {
      let depBuffer = '';
      do {
        depBuffer += contentArr[lineNumber] + '\n';
        lineNumber += 1;
      } while (!contentArr[lineNumber].includes('end'));
      let depMatchGroups = depMatchRegExp.exec(depBuffer)?.groups;
      while (depMatchGroups) {
        const { depName, datasource, currentValue, organization } =
          depMatchGroups;

        const dep: PackageDependency = {
          depName,
          currentValue,
        };

        dep.datasource = datasource || HexDatasource.id;

        if (dep.datasource === HexDatasource.id) {
          dep.currentValue = currentValue;
          dep.packageName = depName;
        }

        if (organization) {
          dep.packageName += ':' + organization;
        }

        if (dep.datasource !== HexDatasource.id) {
          dep.skipReason = 'non-hex-dep-types';
        }

        deps.push(dep);
        depMatchGroups = depMatchRegExp.exec(depBuffer)?.groups;
      }
    }
  }
  const res: PackageFile = { deps };
  const lockFileName =
    (await findLocalSiblingOrParent(fileName, 'mix.lock')) ?? 'mix.lock';
  // istanbul ignore if
  if (await localPathExists(lockFileName)) {
    res.lockFiles = [lockFileName];
  }
  return res;
}
