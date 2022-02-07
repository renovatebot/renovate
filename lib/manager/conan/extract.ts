import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import type { PackageDependency, PackageFile } from '../types';

const regex = regEx(
  `(?<name>[-_a-z0-9]+)/(?<version>[^@\n{*"']+)(?<userChannel>@[-_a-zA-Z0-9]+/[^\n.{*"' ]+)?`
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

export function extractPackageFile(content: string): PackageFile | null {
  // only process sections where requirements are defined
  const sections = content.split(/def |\n\[/).filter(
    (part) =>
      part.includes('python_requires') || // only matches python_requires
      part.includes('build_require') || // matches [build_requires], build_requirements(), and build_requires
      part.includes('require') // matches [requires], requirements(), and requires
  );

  const deps: PackageDependency[] = [];
  for (const section of sections) {
    let depType = setDepType(section, 'requires');
    const rawLines = section.split('\n').filter((line) => line.length !== 0);

    for (const rawline of rawLines) {
      // don't process after a comment
      const sanitizedLine = rawline.split('#')[0].split('//')[0];
      if (sanitizedLine) {
        depType = setDepType(sanitizedLine, depType);
        // extract all dependencies from each line
        const lines = sanitizedLine.split(/["'],/);
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
            const lookupName = `${depName}/${currentValue}${userAndChannel}`;

            dep = {
              ...dep,
              depName,
              lookupName,
              currentValue,
              replaceString,
              depType,
            };
            deps.push(dep);

            logger.trace(
              `Found a Conan package: ${depName}, ${currentValue}, ${userAndChannel}, ${depType}.`
            );
          }
        }
      }
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
