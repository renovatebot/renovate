import { parsePkgAndParentSelector } from '@pnpm/parse-overrides';
import {
  isNonEmptyObject,
  isNonEmptyString,
  isNonEmptyStringAndNotWhitespace,
  isObject,
  isString,
} from '@sindresorhus/is';
import { CONFIG_VALIDATION } from '../../../../../constants/error-messages.ts';
import { logger } from '../../../../../logger/index.ts';
import { regEx } from '../../../../../util/regex.ts';
import type { PackageDependency, PackageFileContent } from '../../../types.ts';
import type { NpmManagerData } from '../../types.ts';
import { loadPackageJson } from '../../utils.ts';
import type { NpmPackage, NpmPackageDependency } from '../types.ts';
import {
  extractDependency,
  getExtractedConstraints,
  parseDepName,
} from './dependency.ts';
import { setNodeCommitTopic } from './node.ts';
import { extractOverrideDepsRec } from './overrides.ts';

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
          /* v8 ignore next 3 -- needs test */
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
          if (depType === 'overrides' && !isString(val)) {
            // TODO: fix type #22198
            deps.push(
              ...extractOverrideDepsRec(
                [depName],
                val as unknown as NpmManagerData,
              ),
            );
          } else if (depType === 'pnpm' && depName === 'overrides') {
            // pnpm overrides
            // https://pnpm.io/package_json#pnpmoverrides
            for (const [overridesKey, overridesVal] of Object.entries(
              val as unknown as NpmPackageDependency,
            )) {
              if (isString(overridesVal)) {
                // Newer flat syntax: `parent>parent>child`
                const packageName =
                  parsePkgAndParentSelector(overridesKey).targetPkg.name;
                dep = {
                  depName: overridesKey,
                  packageName,
                  depType: 'pnpm.overrides',
                  ...extractDependency(depName, packageName, overridesVal),
                };
                setNodeCommitTopic(dep);
                // TODO: Is this expected? It's always 'overrides'.
                dep.prettyDepType = depTypes[depName];
                deps.push(dep);
              } else if (isObject(overridesVal)) {
                // Older nested object syntax: `parent: { parent: { child: version } }`
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
        } /* v8 ignore next -- needs test */
      } catch (err) {
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
      hasPackageManager:
        isNonEmptyStringAndNotWhitespace(packageJson.packageManager) ||
        isNonEmptyObject(packageJson.devEngines?.packageManager),
      workspaces: packageJson.workspaces,
    },
  };
}

export async function hasPackageManager(
  packageJsonDir: string,
): Promise<boolean> {
  logger.trace(`npm.hasPackageManager from package.json`);

  const packageJsonResult = await loadPackageJson(packageJsonDir);

  return (
    isNonEmptyString(packageJsonResult?.packageManager?.name) &&
    isNonEmptyString(packageJsonResult?.packageManager?.version)
  );
}
