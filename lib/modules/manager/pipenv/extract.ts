import { pipenv as pipenvDetect } from '@renovatebot/detect-tools';
import { RANGE_PATTERN } from '@renovatebot/pep440';
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { SkipReason } from '../../../types';
import { getParentDir, localPathExists } from '../../../util/fs';
import { ensureLocalPath } from '../../../util/fs/util';
import { regEx } from '../../../util/regex';
import { parse as parseToml } from '../../../util/toml';
import { PypiDatasource } from '../../datasource/pypi';
import { normalizePythonDepName } from '../../datasource/pypi/common';
import type { PackageDependency, PackageFileContent } from '../types';
import type { PipFile, PipRequirement, PipSource } from './types';

// based on https://www.python.org/dev/peps/pep-0508/#names
export const packagePattern = '[A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9]';
export const extrasPattern = '(?:\\s*\\[[^\\]]+\\])*';
const packageRegex = regEx(`^(${packagePattern})(${extrasPattern})$`, 'i');

const rangePattern: string = RANGE_PATTERN;

const specifierPartPattern = `\\s*${rangePattern.replace(
  regEx(/\?<\w+>/g),
  '?:',
)}\\s*`;
const specifierPattern = `${specifierPartPattern}(?:,${specifierPartPattern})*`;
const specifierRegex = regEx(`^${specifierPattern}$`);
function extractFromSection(
  sectionName: string,
  pipfileSection: Record<string, PipRequirement>,
  sources?: PipSource[],
): PackageDependency[] {
  const deps = Object.entries(pipfileSection)
    .map((x) => {
      const [packageNameString, requirements] = x;
      let depName = packageNameString;

      let currentValue: string | undefined;
      let nestedVersion = false;
      let skipReason: SkipReason | undefined;
      if (is.object(requirements)) {
        if (requirements.git) {
          skipReason = 'git-dependency';
        } else if (requirements.file) {
          skipReason = 'file-dependency';
        } else if (requirements.path) {
          skipReason = 'local-dependency';
        } else if (requirements.version) {
          currentValue = requirements.version;
          nestedVersion = true;
        } else {
          skipReason = 'unspecified-version';
        }
      } else {
        currentValue = requirements;
      }
      if (currentValue === '*') {
        skipReason = 'unspecified-version';
      }
      if (!skipReason) {
        const packageMatches = packageRegex.exec(packageNameString);
        if (packageMatches) {
          depName = packageMatches[1];
        } else {
          logger.debug(
            `Skipping dependency with malformed package name "${packageNameString}".`,
          );
          skipReason = 'invalid-name';
        }
        // validated above
        const specifierMatches = specifierRegex.exec(currentValue!);
        if (!specifierMatches) {
          logger.debug(
            `Skipping dependency with malformed version specifier "${currentValue!}".`,
          );
          skipReason = 'invalid-version';
        }
      }
      const dep: PackageDependency = {
        depType: sectionName,
        depName,
        packageName: normalizePythonDepName(depName),
        managerData: {},
      };
      if (currentValue) {
        dep.currentValue = currentValue;
      }
      if (skipReason) {
        dep.skipReason = skipReason;
      } else {
        dep.datasource = PypiDatasource.id;
      }
      if (!skipReason && currentValue?.startsWith('==')) {
        dep.currentVersion = currentValue.replace(regEx(/^==\s*/), '');
      }
      if (nestedVersion) {
        // TODO #22198
        dep.managerData!.nestedVersion = nestedVersion;
      }
      if (sources && is.object(requirements) && requirements.index) {
        const source = sources.find((item) => item.name === requirements.index);
        if (source) {
          dep.registryUrls = [source.url];
        }
      }
      return dep;
    })
    .filter(Boolean);
  return deps;
}

function isPipRequirements(
  section?:
    | Record<string, PipRequirement>
    | Record<string, string>
    | PipSource[],
): section is Record<string, PipRequirement> {
  return (
    !is.array(section) &&
    is.object(section) &&
    !Object.values(section).some((dep) => !is.object(dep) && !is.string(dep))
  );
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.trace(`pipenv.extractPackageFile(${packageFile})`);

  let pipfile: PipFile;
  try {
    // TODO: fix type (#9610)
    pipfile = parseToml(content) as any;
  } catch (err) {
    logger.debug({ err, packageFile }, 'Error parsing Pipfile');
    return null;
  }
  const res: PackageFileContent = { deps: [] };

  const sources = pipfile?.source;

  if (sources) {
    res.registryUrls = sources.map((source) => source.url);
  }

  res.deps = Object.entries(pipfile)
    .map(([category, section]) => {
      if (
        category === 'source' ||
        category === 'requires' ||
        !isPipRequirements(section)
      ) {
        return [];
      }

      return extractFromSection(category, section, sources);
    })
    .flat();

  if (!res.deps.length) {
    return null;
  }

  const extractedConstraints: Record<string, any> = {};

  const pipfileDir = getParentDir(ensureLocalPath(packageFile));

  const pythonConstraint = await pipenvDetect.getPythonConstraint(pipfileDir);
  if (pythonConstraint) {
    extractedConstraints.python = pythonConstraint;
  }

  const pipenvConstraint = await pipenvDetect.getPipenvConstraint(pipfileDir);
  if (pipenvConstraint) {
    extractedConstraints.pipenv = pipenvConstraint;
  }

  const lockFileName = `${packageFile}.lock`;
  if (await localPathExists(lockFileName)) {
    res.lockFiles = [lockFileName];
  }

  res.extractedConstraints = extractedConstraints;
  return res;
}
