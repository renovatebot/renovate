import * as datasourceGalaxy from '../../datasource/galaxy';
import * as datasourceGitTags from '../../datasource/git-tags';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { PackageDependency, PackageFile } from '../common';

const galaxyRoleRegex = /.+\..+/;

function interpretLine(
  lineMatch: RegExpMatchArray,
  lineNumber: number,
  dependency: PackageDependency
): PackageDependency {
  const localDependency: PackageDependency = dependency;
  const key = lineMatch[2];
  const value = lineMatch[3].replace(/["']/g, '');
  switch (key) {
    case 'name': {
      localDependency.managerData.name = value;
      break;
    }
    case 'version': {
      localDependency.managerData.version = value;
      localDependency.currentValue = value;
      localDependency.managerData.lineNumber = lineNumber;
      break;
    }
    case 'scm': {
      localDependency.managerData.scm = value;
      break;
    }
    case 'src': {
      localDependency.managerData.src = value;
      break;
    }
    default: {
      return null;
    }
  }
  return localDependency;
}

function finalize(dependency: PackageDependency): boolean {
  const dep = dependency;
  if (dependency.managerData.version === null) {
    dep.skipReason = SkipReason.NoVersion;
    return false;
  }

  const source: string = dep.managerData.src;
  const sourceMatch: RegExpMatchArray = new RegExp(
    /^(git|http|git\+http|ssh)s?(:\/\/|@).*(\/|:)(.+\/[^.]+)\/?(\.git)?$/
  ).exec(source);
  if (sourceMatch) {
    dep.datasource = datasourceGitTags.id;
    dep.depName = sourceMatch[4];
    // remove leading `git+` from URLs like `git+https://...`
    dep.lookupName = source.replace(/git\+/, '');
  } else if (galaxyRoleRegex.exec(source)) {
    dep.datasource = datasourceGalaxy.id;
    dep.depName = dep.managerData.src;
    dep.lookupName = dep.managerData.src;
  } else if (galaxyRoleRegex.exec(dep.managerData.name)) {
    dep.datasource = datasourceGalaxy.id;
    dep.depName = dep.managerData.name;
    dep.lookupName = dep.managerData.name;
  } else {
    dep.skipReason = SkipReason.NoSourceMatch;
    return false;
  }
  if (dep.managerData.name !== null) {
    dep.depName = dep.managerData.name;
  }

  return true;
}

export default function extractPackageFile(
  content: string
): PackageFile | null {
  logger.trace('ansible-galaxy.extractPackageFile()');
  const newBlockRegEx = new RegExp(/^\s*-\s*((\w+):\s*(.*))$/);
  const blockLineRegEx = new RegExp(/^\s*((\w+):\s*(.*))$/);
  const deps: PackageDependency[] = [];
  const lines = content.split('\n');
  try {
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      let lineMatch = newBlockRegEx.exec(lines[lineNumber]);
      if (lineMatch) {
        const dep: PackageDependency = {
          managerData: {
            name: null,
            version: null,
            scm: null,
            src: null,
          },
        };
        do {
          const localdep = interpretLine(lineMatch, lineNumber, dep);
          if (localdep == null) {
            break;
          }
          const line = lines[lineNumber + 1];

          if (!line) {
            break;
          }
          lineMatch = blockLineRegEx.exec(line);
          if (lineMatch) {
            lineNumber += 1;
          }
        } while (lineMatch);
        if (finalize(dep)) {
          delete dep.managerData;
          deps.push(dep);
        }
      }
    }

    if (!deps.length) {
      return null;
    }
    return { deps };
  } catch (err) /* c8 ignore next */ {
    logger.debug({ err }, 'Error extracting ansible-galaxy deps');
    return null;
  }
}
