import { logger } from '../../../logger';
import { findLocalSiblingOrParent, localPathExists } from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HexDatasource } from '../../datasource/hex';
import type { PackageDependency, PackageFileContent } from '../types';

const depSectionRegExp = regEx(/defp\s+deps.*do/g);
const depMatchRegExp = regEx(
  /{:(?<app>\w+)(\s*,\s*"(?<requirement>[^"]+)")?(\s*,\s*(?<opts>[^}]+))?}/gm,
);
const gitRegexp = regEx(/git:\s*"(?<value>[^"]+)"/);
const githubRegexp = regEx(/github:\s*"(?<value>[^"]+)"/);
const refRegexp = regEx(/ref:\s*"(?<value>[^"]+)"/);
const branchOrTagRegexp = regEx(/(?:branch|tag):\s*"(?<value>[^"]+)"/);
const organizationRegexp = regEx(/organization:\s*"(?<value>[^"]+)"/);
const commentMatchRegExp = regEx(/#.*$/);

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.trace(`mix.extractPackageFile(${packageFile})`);
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
      } while (contentArr[lineNumber].trim() !== 'end');
      let depMatchGroups = depMatchRegExp.exec(depBuffer)?.groups;
      while (depMatchGroups) {
        const { app, requirement, opts } = depMatchGroups;
        const github = githubRegexp.exec(opts)?.groups?.value;
        const git = gitRegexp.exec(opts)?.groups?.value;
        const ref = refRegexp.exec(opts)?.groups?.value;
        const branchOrTag = branchOrTagRegexp.exec(opts)?.groups?.value;
        const organization = organizationRegexp.exec(opts)?.groups?.value;

        let dep: PackageDependency;

        if (git ?? github) {
          dep = {
            depName: app,
            currentDigest: ref,
            currentValue: branchOrTag,
            datasource: git ? GitTagsDatasource.id : GithubTagsDatasource.id,
            packageName: git ?? github,
          };
        } else {
          dep = {
            depName: app,
            currentValue: requirement,
            datasource: HexDatasource.id,
            packageName: organization ? `${app}:${organization}` : app,
          };
          if (requirement?.startsWith('==')) {
            dep.currentVersion = requirement.replace(regEx(/^==\s*/), '');
          }
        }

        deps.push(dep);
        depMatchGroups = depMatchRegExp.exec(depBuffer)?.groups;
      }
    }
  }
  const res: PackageFileContent = { deps };
  const lockFileName =
    (await findLocalSiblingOrParent(packageFile, 'mix.lock')) ?? 'mix.lock';
  // istanbul ignore if
  if (await localPathExists(lockFileName)) {
    res.lockFiles = [lockFileName];
  }
  return res;
}
