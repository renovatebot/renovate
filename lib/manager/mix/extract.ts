import * as datasourceHex from '../../datasource/hex';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { getSiblingFileName, localPathExists } from '../../util/fs';
import type { PackageDependency, PackageFile } from '../types';

const depSectionRegExp = /defp\s+deps.*do/g;
const depMatchRegExp = /{:(\w+),\s*([^:"]+)?:?\s*"([^"]+)",?\s*(organization: "(.*)")?.*}/gm;

export async function extractPackageFile(
  content: string,
  fileName: string
): Promise<PackageFile | null> {
  logger.trace('mix.extractPackageFile()');
  const deps: PackageDependency[] = [];
  const contentArr = content.split('\n');

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

          dep.datasource = datasource || datasourceHex.id;

          if (dep.datasource === datasourceHex.id) {
            dep.currentValue = currentValue;
            dep.lookupName = depName;
          }

          if (organization) {
            dep.lookupName += ':' + organization;
          }

          if (dep.datasource !== datasourceHex.id) {
            dep.skipReason = SkipReason.NonHexDeptypes;
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
  const lockFileName = getSiblingFileName(fileName, 'mix.lock');
  // istanbul ignore if
  if (await localPathExists(lockFileName)) {
    res.lockFiles = [lockFileName];
  }
  return res;
}
