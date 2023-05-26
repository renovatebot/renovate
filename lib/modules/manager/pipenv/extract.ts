import toml from '@iarna/toml';
import { RANGE_PATTERN } from '@renovatebot/pep440';
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { SkipReason } from '../../../types';
import { localPathExists } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { PypiDatasource } from '../../datasource/pypi';
import type { PackageDependency, PackageFileContent } from '../types';
import type { PipFile } from './types';

// based on https://www.python.org/dev/peps/pep-0508/#names
const packageRegex = regEx(/^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])$/i);
const rangePattern: string = RANGE_PATTERN;

const specifierPartPattern = `\\s*${rangePattern.replace(
  regEx(/\?<\w+>/g),
  '?:'
)}\\s*`;
const specifierPattern = `${specifierPartPattern}(?:,${specifierPartPattern})*`;
const specifierRegex = regEx(`^${specifierPattern}$`);
function extractFromSection(
  pipfile: PipFile,
  section: 'packages' | 'dev-packages'
): PackageDependency[] {
  const pipfileSection = pipfile[section];
  if (!pipfileSection) {
    return [];
  }

  const deps = Object.entries(pipfileSection)
    .map((x) => {
      const [depName, requirements] = x;
      let currentValue: string | undefined;
      let nestedVersion = false;
      let skipReason: SkipReason | undefined;
      if (requirements.git) {
        skipReason = 'git-dependency';
      } else if (requirements.file) {
        skipReason = 'file-dependency';
      } else if (requirements.path) {
        skipReason = 'local-dependency';
      } else if (requirements.version) {
        currentValue = requirements.version;
        nestedVersion = true;
      } else if (is.object(requirements)) {
        skipReason = 'unspecified-version';
      } else {
        currentValue = requirements;
      }
      if (currentValue === '*') {
        skipReason = 'unspecified-version';
      }
      if (!skipReason) {
        const packageMatches = packageRegex.exec(depName);
        if (!packageMatches) {
          logger.debug(
            `Skipping dependency with malformed package name "${depName}".`
          );
          skipReason = 'invalid-name';
        }
        // validated above
        const specifierMatches = specifierRegex.exec(currentValue!);
        if (!specifierMatches) {
          logger.debug(
            `Skipping dependency with malformed version specifier "${currentValue!}".`
          );
          skipReason = 'invalid-version';
        }
      }
      const dep: PackageDependency = {
        depType: section,
        depName,
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
      if (nestedVersion) {
        // TODO #7154
        dep.managerData!.nestedVersion = nestedVersion;
      }
      if (requirements.index) {
        if (is.array(pipfile.source)) {
          const source = pipfile.source.find(
            (item) => item.name === requirements.index
          );
          if (source) {
            dep.registryUrls = [source.url];
          }
        }
      }
      return dep;
    })
    .filter(Boolean);
  return deps;
}

export async function extractPackageFile(
  content: string,
  packageFile: string
): Promise<PackageFileContent | null> {
  logger.trace(`pipenv.extractPackageFile(${packageFile})`);

  let pipfile: PipFile;
  try {
    // TODO: fix type (#9610)
    pipfile = toml.parse(content) as any;
  } catch (err) {
    logger.debug({ err, packageFile }, 'Error parsing Pipfile');
    return null;
  }
  const res: PackageFileContent = { deps: [] };
  if (pipfile.source) {
    res.registryUrls = pipfile.source.map((source) => source.url);
  }

  res.deps = [
    ...extractFromSection(pipfile, 'packages'),
    ...extractFromSection(pipfile, 'dev-packages'),
  ];
  if (!res.deps.length) {
    return null;
  }

  const constraints: Record<string, any> = {};

  if (is.nonEmptyString(pipfile.requires?.python_version)) {
    constraints.python = `== ${pipfile.requires!.python_version}.*`;
  } else if (is.nonEmptyString(pipfile.requires?.python_full_version)) {
    constraints.python = `== ${pipfile.requires!.python_full_version}`;
  }

  if (is.nonEmptyString(pipfile.packages?.pipenv)) {
    constraints.pipenv = pipfile.packages!.pipenv;
  } else if (is.nonEmptyString(pipfile['dev-packages']?.pipenv)) {
    constraints.pipenv = pipfile['dev-packages']!.pipenv;
  }

  const lockFileName = `${packageFile}.lock`;
  if (await localPathExists(lockFileName)) {
    res.lockFiles = [lockFileName];
  }

  res.extractedConstraints = constraints;
  return res;
}
