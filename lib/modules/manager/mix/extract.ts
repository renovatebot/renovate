import { logger } from '../../../logger';
import { findLocalSiblingOrParent, localPathExists } from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
import { HexDatasource } from '../../datasource/hex';
import type { PackageDependency, PackageFile } from '../types';

const depSectionRegExp = regEx(/defp\s+deps.*do/g);
const depMatchRegExp = regEx(
  /{:(?<app>\w+)(\s*,\s*"(?<requirement>[^"]+)")?(\s*,\s*(?<opts>[^}]+))?}/gm
);
const githubRegexp = regEx(/github:\s*"(?<value>[^"]+)"/);
const organizationRegexp = regEx(/organization:\s*"(?<value>[^"]+)"/);
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
        const { app, requirement, opts } = depMatchGroups;

        const github = githubRegexp.exec(opts)?.groups?.value;
        const organization = organizationRegexp.exec(opts)?.groups?.value;

        const packageName = organization ? `${app}:${organization}` : app;
        const currentValue = requirement || github;
        const datasource = github ? 'github' : HexDatasource.id;

        const dep: PackageDependency = {
          depName: app,
          currentValue,
          datasource,
        };

        if (datasource === HexDatasource.id) {
          dep.packageName = packageName;
        } else {
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
