import { ConanDatasource } from '../../datasource/conan';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import * as loose from '../../versioning/loose';
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

export default function extractPackageFile(
  content: string
): PackageFile | null {
  // only process sections where requirements are defined
  const sections = content.split(/def |\n\[/).filter(
    (part) =>
      part.includes('python_requires') || // only matches python_requires
      part.includes('build_require') || // matches [build_requires], build_requirements(), and build_requires
      part.includes('require') // matches [requires], requirements(), and requires
  );

  const deps = [];
  for (const section of sections) {
    let depType = setDepType(section, 'requires');
    const rawlines = section.split('\n').filter((line) => line.length !== 0);

    for (const rawline of rawlines) {
      // don't process after a comment
      const sanitizedLine = rawline.split('#')[0].split('//')[0];
      if (sanitizedLine) {
        depType = setDepType(sanitizedLine, depType);
        // extract all dependencies from each line
        const lines = sanitizedLine.split(',');
        for (const line of lines) {
          // In the case of complex ranges don't misread the userChannel as a dependency
          // ex: curl/[~1.2.3, loose=False, include_prerelease=True]@test/dev will split
          // down into include_prerelease=True]@test/dev.  This should not return test as a dependency
          if (!line.includes(']@')) {
            const matches = regex.exec(line.trim());
            if (matches) {
              let dep: PackageDependency = {};
              const depName = matches.groups.name;
              const currentValue = matches.groups.version.trim();
              // set to a value that won't cause this dependency to be thrown out by
              // lib/workers/repository/process/lookup/index.ts line: 333
              let currentDigest = ' ';
              let replaceString = `${depName}/${currentValue}`;
              if (matches.groups.userChannel) {
                currentDigest = matches.groups.userChannel;
                replaceString = `${depName}/${currentValue}${currentDigest}`;
              }

              // ignore packages with set ranges since conan does not use a lockfile, conan will handle this during installation
              if (!currentValue.includes('[')) {
                logger.trace(
                  `Found a conan package ${depName} ${currentValue} ${currentDigest} ${depType}`
                );
                dep = {
                  ...dep,
                  depName,
                  currentValue,
                  currentDigest,
                  datasource: ConanDatasource.id,
                  versioning: loose.id,
                  replaceString,
                  depType,
                  autoReplaceStringTemplate:
                    '{{depName}}/{{newValue}}{{#if newDigest}}{{newDigest}}{{/if}}',
                };
                deps.push(dep);
              }
            }
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
