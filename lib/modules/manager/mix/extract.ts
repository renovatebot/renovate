import { logger } from '../../../logger';
import { findLocalSiblingOrParent, localPathExists } from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
import { HexDatasource } from '../../datasource/hex';
import type { PackageDependency, PackageFile } from '../types';

const depSectionRegExp = regEx(/defp\s+deps.*do/g);
const depMatchRegExp = regEx(
  /{:(\w+),\s*([^:"]+)?:?\s*"([^"]+)",?\s*(organization: "(.*)")?.*}/gm
);

export async function extractPackageFile(
  content: string,
  fileName: string
): Promise<PackageFile | null> {
  logger.trace('mix.extractPackageFile()');
  const deps: PackageDependency[] = [];
  const contentArr = content.split(newlineRegex);

  for (let lineNumber = 0; lineNumber < contentArr.length; lineNumber += 1) {
    if (contentArr[lineNumber].match(depSectionRegExp)) {
      logger.trace(`Matched dep section on line ${lineNumber}`);
      let depBuffer = '';
      do {
        depBuffer += contentArr[lineNumber] + '\n';
        lineNumber += 1;
      } while (!contentArr[lineNumber].includes('end'));
      let depMatch: RegExpMatchArray;
      do {
        depMatch = depMatchRegExp.exec(depBuffer);
        if (depMatch) {
          const depName = depMatch[1];
          const datasource = depMatch[2];
          const currentValue = depMatch[3];
          const organization = depMatch[5];

          const dep: PackageDependency = {
            depName,
            currentValue,
            managerData: {},
          };

          dep.datasource = datasource || HexDatasource.id;

          if (dep.datasource === HexDatasource.id) {
            dep.currentValue = currentValue;
            dep.lookupName = depName;
          }

          if (organization) {
            dep.lookupName += ':' + organization;
          }

          if (dep.datasource !== HexDatasource.id) {
            dep.skipReason = 'non-hex-dep-types';
          }

          // Find dep's line number
          for (let i = 0; i < contentArr.length; i += 1) {
            if (contentArr[i].includes(`:${depName},`)) {
              dep.managerData.lineNumber = i;
            }
          }

          deps.push(dep);
        }
      } while (depMatch);
    }
  }
  const res: PackageFile = { deps };
  const lockFileName =
    (await findLocalSiblingOrParent(fileName, 'mix.lock')) || 'mix.lock';
  // istanbul ignore if
  if (await localPathExists(lockFileName)) {
    res.lockFiles = [lockFileName];
  }
  return res;
}
