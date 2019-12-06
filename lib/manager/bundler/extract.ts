import { logger } from '../../logger';
import { isValid } from '../../versioning/ruby';
import { PackageFile, PackageDependency } from '../common';
import { platform } from '../../platform';

function parseHashArgs(str: string): Partial<PackageDependency> {
  const result: Partial<PackageDependency> = {};

  const parsed: Record<string, string> = {
    git: null,
    github: null,
    tag: null,
  };

  for (const [key] of Object.entries(parsed)) {
    const regex = new RegExp(
      `,\\s*(:${key}\\s*=>|${key}\\s*:)\\s*(['"])(?<value>[^'"]+)\\2`
    );
    const match = str.match(regex);
    if (match) parsed[key] = match.groups.value;
  }

  const { tag, git, github } = parsed;

  if (git) {
    result.datasource = 'github';
    const gitMatch = git.match(
      /[@/]github\.com[:/](?<user>[^/]+)\/(?<repo>[^/]+)\.git$/
    );
    if (gitMatch) {
      const { user, repo } = gitMatch.groups;
      result.lookupName = `${user}/${repo}`;
    } else {
      result.skipReason = 'invalid';
    }
  } else if (github) {
    result.datasource = 'github';
    const [user, repo] = github.split('/');
    result.lookupName = repo ? `${user}/${repo}` : `${user}/${user}`;
  }

  if (result.datasource) {
    if (tag) {
      result.depType = 'tags';
      result.currentValue = tag;
      if (!isValid(tag.replace(/^v/, ''))) {
        result.skipReason = 'invalid-value';
      }
    } else {
      result.skipReason = 'no-version';
    }
  }

  return result;
}

export async function extractPackageFile(
  content: string,
  fileName?: string
): Promise<PackageFile | null> {
  const res: PackageFile = {
    registryUrls: [],
    deps: [],
  };
  const lines = content.split('\n');
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    const sourceMatch = line.match(
      /^\s*source\s+(['"])(?<source>[^'"]+)\1\s*$/
    );
    if (sourceMatch) {
      const { source } = sourceMatch.groups;
      res.registryUrls.push(source);
    }
    const rubyMatch = line.match(/^\s*ruby\s+(['"])(?<ruby>[^'"]+)\1/);
    if (rubyMatch) {
      const { ruby } = rubyMatch.groups;
      res.compatibility = { ruby };
    }
    const gemMatchRegex = /^\s*gem\s+(['"])(?<depName>[^'"]+)\1(?<versions>(\s*,\s*(['"])[^'"]+\5)+)?(?<hashArgs>.*)$/;
    const gemMatch = line.match(gemMatchRegex);
    if (gemMatch) {
      const { depName, versions, hashArgs } = gemMatch.groups;
      const dep: PackageDependency = {
        depName,
        managerData: { lineNumber },
        ...parseHashArgs(hashArgs),
      };
      if (!dep.currentValue && !dep.skipReason) {
        if (versions) {
          dep.currentValue = versions
            .replace(/\s*,\s*/, '')
            .replace(/['"]/g, '')
            .trim();
          if (!isValid(dep.currentValue)) {
            dep.skipReason = 'invalid-value';
          }
        } else {
          dep.skipReason = 'no-version';
        }
        if (!dep.skipReason) dep.datasource = 'rubygems';
      }
      res.deps.push(dep);
    }
    const groupMatch = line.match(/^group\s+(.*?)\s+do/);
    if (groupMatch) {
      const depTypes = groupMatch[1]
        .split(',')
        .map(group => group.trim())
        .map(group => group.replace(/^:/, ''));
      const groupLineNumber = lineNumber;
      let groupContent = '';
      let groupLine = '';
      while (lineNumber < lines.length && groupLine !== 'end') {
        lineNumber += 1;
        groupLine = lines[lineNumber];
        if (groupLine !== 'end') {
          groupContent += (groupLine || '').replace(/^ {2}/, '') + '\n';
        }
      }
      const groupRes = await extractPackageFile(groupContent);
      if (groupRes) {
        res.deps = res.deps.concat(
          groupRes.deps.map(dep => ({
            ...dep,
            depTypes,
            managerData: {
              lineNumber: dep.managerData.lineNumber + groupLineNumber + 1,
            },
          }))
        );
      }
    }
    const sourceBlockMatch = line.match(
      /^\s*source\s+(['"])(?<repositoryUrl>[^'"]+)\1\s+do\s*$/
    );

    if (sourceBlockMatch) {
      const { repositoryUrl } = sourceBlockMatch.groups;
      const sourceLineNumber = lineNumber;
      let sourceContent = '';
      let sourceLine = '';
      while (lineNumber < lines.length && sourceLine !== 'end') {
        lineNumber += 1;
        sourceLine = lines[lineNumber];
        if (sourceLine !== 'end') {
          sourceContent += sourceLine.replace(/^ {2}/, '') + '\n';
        }
      }
      const sourceRes = await extractPackageFile(sourceContent);
      if (sourceRes) {
        res.deps = res.deps.concat(
          sourceRes.deps.map(dep => ({
            ...dep,
            registryUrls: [repositoryUrl],
            managerData: {
              lineNumber: dep.managerData.lineNumber + sourceLineNumber + 1,
            },
          }))
        );
      }
    }
    const platformsMatch = line.match(/^platforms\s+(.*?)\s+do/);
    if (platformsMatch) {
      const platformsLineNumber = lineNumber;
      let platformsContent = '';
      let platformsLine = '';
      while (lineNumber < lines.length && platformsLine !== 'end') {
        lineNumber += 1;
        platformsLine = lines[lineNumber];
        if (platformsLine !== 'end') {
          platformsContent += platformsLine.replace(/^ {2}/, '') + '\n';
        }
      }
      const platformsRes = await extractPackageFile(platformsContent);
      if (platformsRes) {
        res.deps = res.deps.concat(
          // eslint-disable-next-line no-loop-func
          platformsRes.deps.map(dep => ({
            ...dep,
            managerData: {
              lineNumber: dep.managerData.lineNumber + platformsLineNumber + 1,
            },
          }))
        );
      }
    }
    const ifMatch = line.match(/^if\s+(.*?)/);
    if (ifMatch) {
      const ifLineNumber = lineNumber;
      let ifContent = '';
      let ifLine = '';
      while (lineNumber < lines.length && ifLine !== 'end') {
        lineNumber += 1;
        ifLine = lines[lineNumber];
        if (ifLine !== 'end') {
          ifContent += ifLine.replace(/^ {2}/, '') + '\n';
        }
      }
      const ifRes = await extractPackageFile(ifContent);
      if (ifRes) {
        res.deps = res.deps.concat(
          // eslint-disable-next-line no-loop-func
          ifRes.deps.map(dep => ({
            ...dep,
            managerData: {
              lineNumber: dep.managerData.lineNumber + ifLineNumber + 1,
            },
          }))
        );
      }
    }
  }
  if (!res.deps.length && !res.registryUrls.length) {
    return null;
  }
  if (fileName) {
    const gemfileLock = fileName + '.lock';
    const lockContent = await platform.getFile(gemfileLock);
    if (lockContent) {
      logger.debug({ packageFile: fileName }, 'Found Gemfile.lock file');
      const bundledWith = lockContent.match(/\nBUNDLED WITH\n\s+(.*?)(\n|$)/);
      if (bundledWith) {
        res.compatibility = res.compatibility || {};
        res.compatibility.bundler = bundledWith[1];
      }
    }
  }
  return res;
}
