import semverInc from 'semver/functions/inc';
import { logger } from '../../../logger';
import { getSiblingFileName, localPathExists } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { GitTagsDatasource } from '../../datasource/git-tags';
import type { PackageDependency, PackageFile } from '../types';

const regExps = {
  entireSection: regEx(
    /\/\* Begin XCRemoteSwiftPackageReference section \*\/([\0-\uFFFF]*)\/\* End XCRemoteSwiftPackageReference section \*\//
  ),
  eachPackage: regEx(
    /XCRemoteSwiftPackageReference "([^"]+?)".*?{(.*?};)(\t{2}|\s+)};/g
  ),
  packageIsa: regEx(/isa = XCRemoteSwiftPackageReference/),
  packageUrl: regEx(/repositoryURL = "(.*?)"/),
  packageRequirementKind: regEx(/kind = (.+?);/),
  packageRequirementMinimum: regEx(/minimumVersion = (.+?);/),
  packageRequirementMaximum: regEx(/maximumVersion = (.+?);/),
  packageRequirementVersion: regEx(/version = (.+?);/),
  packageRequirementBranch: regEx(/branch = (.+?);/),
  packageRequirementRevision: regEx(/revision = (.+?);/),
};

export async function extractPackageFile(
  content: string,
  packageFile: string = null
): Promise<PackageFile | null> {
  if (!content) {
    return null;
  }

  const sectionMatch = regExps.entireSection.exec(content);

  if (!sectionMatch || !sectionMatch[1]) {
    logger.debug(`${packageFile} contains no Swift package dependencies`);
    return null;
  }

  const matchText = sectionMatch[1].replaceAll('\n', '');
  const deps: PackageDependency[] = [];

  let packageMatch;
  while ((packageMatch = regExps.eachPackage.exec(matchText)) !== null) {
    const depName: string = packageMatch[1];

    if (!packageMatch[2].match(regExps.packageIsa)) {
      logger.debug(`${depName} has invalid ISA value`);
      continue;
    }

    let currentValue: string;
    let datasource: string;

    switch (packageMatch[2].match(regExps.packageRequirementKind)[1]) {
      case 'upToNextMinorVersion': {
        const minimum: string = packageMatch[2].match(
          regExps.packageRequirementMinimum
        )[1];
        const maximum = semverInc(minimum, 'minor');
        currentValue = `"${minimum}"..<"${maximum}"`;
        break;
      }
      case 'upToNextMajorVersion': {
        const minimum: string = packageMatch[2].match(
          regExps.packageRequirementMinimum
        )[1];
        const maximum = semverInc(minimum, 'major');
        currentValue = `"${minimum}"..<"${maximum}"`;
        break;
      }
      case 'versionRange': {
        const minimum: string = packageMatch[2].match(
          regExps.packageRequirementMinimum
        )[1];
        const maximum: string = packageMatch[2].match(
          regExps.packageRequirementMaximum
        )[1];
        currentValue = `"${minimum}"..<"${maximum}"`;
        break;
      }
      case 'exactVersion': {
        currentValue = packageMatch[2].match(
          regExps.packageRequirementVersion
        )[1];
        break;
      }
      case 'branch': {
        const value: string = packageMatch[2].match(
          regExps.packageRequirementBranch
        )[1];

        deps.push({
          currentValue: value,
          packageName: packageMatch[2].match(regExps.packageUrl)[1],
          depName,
          skipReason: 'unsupported-version',
        });
        continue;
      }
      case 'revision': {
        const value: string = packageMatch[2].match(
          regExps.packageRequirementRevision
        )[1];

        deps.push({
          currentValue: value,
          packageName: packageMatch[2].match(regExps.packageUrl)[1],
          depName,
          skipReason: 'is-pinned',
        });
        continue;
      }
    }

    if (!currentValue) {
      logger.debug(`${depName} has unknown revision requirements`);
      continue;
    }

    deps.push({
      currentValue: currentValue,
      datasource: datasource || GitTagsDatasource.id,
      packageName: packageMatch[2].match(regExps.packageUrl)[1],
      depName,
    });
  }

  if (!deps.length) {
    return null;
  }

  const res: PackageFile = { deps };
  const lockFile = getSiblingFileName(
    packageFile,
    'project.xcworkspace/xcshareddata/swiftpm/Package.resolved'
  );

  if (await localPathExists(lockFile)) {
    res.lockFiles = [lockFile];
  }

  return res;
}
