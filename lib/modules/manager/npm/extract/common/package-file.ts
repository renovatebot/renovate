import is from '@sindresorhus/is';
import { CONFIG_VALIDATION } from '../../../../../constants/error-messages';
import { logger } from '../../../../../logger';
import { regEx } from '../../../../../util/regex';
import type { PackageDependency, PackageFileContent } from '../../../types';
import type { NpmManagerData } from '../../types';
import type { NpmPackage, NpmPackageDependency } from '../types';
import {
  extractDependency,
  getExtractedConstraints,
  parseDepName,
} from './dependency';
import { setNodeCommitTopic } from './node';
import { extractOverrideDepsRec } from './overrides';

export function extractPackageJson(
  packageJson: NpmPackage,
  packageFile: string,
): PackageFileContent<NpmManagerData> | null {
  logger.trace(`npm.extractPackageJson(${packageFile})`);
  const deps: PackageDependency[] = [];

  if (packageJson._id && packageJson._args && packageJson._from) {
    logger.debug({ packageFile }, 'Ignoring vendorised package.json');
    return null;
  }
  if (packageFile !== 'package.json' && packageJson.renovate) {
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = packageFile;
    error.validationError =
      'Nested package.json must not contain Renovate configuration. Please use `packageRules` with `matchFileNames` in your main config instead.';
    throw error;
  }
  const packageJsonName = packageJson.name;
  logger.debug(
    `npm file ${packageFile} has name ${JSON.stringify(packageJsonName)}`,
  );
  const packageFileVersion = packageJson.version;

  const depTypes = {
    dependencies: 'dependency',
    devDependencies: 'devDependency',
    optionalDependencies: 'optionalDependency',
    peerDependencies: 'peerDependency',
    engines: 'engine',
    volta: 'volta',
    resolutions: 'resolutions',
    packageManager: 'packageManager',
    overrides: 'overrides',
    pnpm: 'pnpm',
  };

  for (const depType of Object.keys(depTypes) as (keyof typeof depTypes)[]) {
    let dependencies = packageJson[depType];
    if (dependencies) {
      try {
        if (depType === 'packageManager') {
          const match = regEx('^(?<name>.+)@(?<range>.+)$').exec(
            dependencies as string,
          );
          // istanbul ignore next
          if (!match?.groups) {
            break;
          }
          dependencies = { [match.groups.name]: match.groups.range };
        }
        for (const [key, val] of Object.entries(
          dependencies as NpmPackageDependency,
        )) {
          const depName = parseDepName(depType, key);
          let dep: PackageDependency = {
            depType,
            depName,
          };
          if (depName !== key) {
            dep.managerData = { key };
          }
          if (depType === 'overrides' && !is.string(val)) {
            // TODO: fix type #22198
            deps.push(
              ...extractOverrideDepsRec(
                [depName],
                val as unknown as NpmManagerData,
              ),
            );
          } else if (depType === 'pnpm' && depName === 'overrides') {
            for (const [overridesKey, overridesVal] of Object.entries(
              val as unknown as NpmPackageDependency,
            )) {
              if (is.string(overridesVal)) {
                dep = {
                  depName: overridesKey,
                  depType: 'overrides',
                  ...extractDependency(depName, overridesKey, overridesVal),
                };
                setNodeCommitTopic(dep);
                dep.prettyDepType = depTypes[depName];
                deps.push(dep);
              } else if (is.object(overridesVal)) {
                deps.push(
                  ...extractOverrideDepsRec(
                    [overridesKey],
                    overridesVal as unknown as NpmManagerData,
                  ),
                );
              }
            }
          } else {
            // TODO: fix type #22198
            dep = { ...dep, ...extractDependency(depType, depName, val!) };
            setNodeCommitTopic(dep);
            dep.prettyDepType = depTypes[depType];
            deps.push(dep);
          }
        }
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { fileName: packageFile, depType, err },
          'Error parsing package.json',
        );
        return null;
      }
    }
  }

  const extractedConstraints = getExtractedConstraints(deps);

  return {
    deps,
    extractedConstraints,
    packageFileVersion,
    managerData: {
      packageJsonName,
      hasPackageManager: is.nonEmptyStringAndNotWhitespace(
        packageJson.packageManager,
      ),
    },
  };
}
