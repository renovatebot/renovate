import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import type { PackageDependency, PackageFileContent } from '../types';
import { isComment } from './common';

const regex = regEx(
  `(?<name>[-_a-z0-9]+)/(?<version>[^@\n{*"']+)(?<userChannel>@[-_a-zA-Z0-9]+/[^#\n.{*"' ]+)?#?(?<revision>[-_a-f0-9]+[^\n{*"'])?`,
);

function setDepType(content: string, originalType: string): string {
  let depType = originalType;
  if (content.includes('python_requires')) {
    depType = 'python_requires';
  } else if (content.includes('build_require')) {
    depType = 'build_requires';
  } else if (content.includes('requires')) {
    depType = 'requires';
  }
  return depType;
}

export function extractPackageFile(content: string): PackageFileContent | null {
  // only process sections where requirements are defined
  const sections = content.split(/def |\n\[/).filter(
    (part) =>
      part.includes('python_requires') || // only matches python_requires
      part.includes('build_require') || // matches [build_requires], build_requirements(), and build_requires
      part.includes('require'), // matches [requires], requirements(), and requires
  );

  const deps: PackageDependency[] = [];
  for (const section of sections) {
    let depType = setDepType(section, 'requires');
    const rawLines = section.split('\n').filter(is.nonEmptyString);

    for (const rawLine of rawLines) {
      if (!isComment(rawLine)) {
        depType = setDepType(rawLine, depType);
        // extract all dependencies from each line
        const lines = rawLine.split(/["'],/);
        for (const line of lines) {
          const matches = regex.exec(line.trim());
          if (matches?.groups) {
            let dep: PackageDependency = {};
            const depName = matches.groups?.name;
            const currentValue = matches.groups?.version.trim();

            let replaceString = `${depName}/${currentValue}`;
            // conan uses @_/_ as a placeholder for no userChannel
            let userAndChannel = '@_/_';

            if (matches.groups.userChannel) {
              userAndChannel = matches.groups.userChannel;
              replaceString = `${depName}/${currentValue}${userAndChannel}`;
            }
            const packageName = `${depName}/${currentValue}${userAndChannel}`;

            dep = {
              ...dep,
              depName,
              packageName,
              currentValue,
              replaceString,
              depType,
            };
            if (matches.groups.revision) {
              dep.currentDigest = matches.groups.revision;
              dep.autoReplaceStringTemplate = `{{depName}}/{{newValue}}${userAndChannel}{{#if newDigest}}#{{newDigest}}{{/if}}`;
              dep.replaceString = `${replaceString}#${dep.currentDigest}`;
            }

            deps.push(dep);
          }
        }
      }
    }
  }

  return deps.length ? { deps } : null;
}
