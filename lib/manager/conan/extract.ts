import { ConanDatasource } from '../../datasource/conan';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import * as loose from '../../versioning/loose';
import type { PackageDependency, PackageFile } from '../types';

const regex = regEx(
  `(?<name>[a-z-_0-9]+)\/(?<version>[^@\n{*"']+)(?<userChannel>@[-_a-zA-Z0-9]+\/[^\n.{*"' ]+)?`
);

export default function extractPackageFile(
  content: string
): PackageFile | null {
  // only process sections where requirements are defined
  const sections = content
    .split(/def |\n\[/)
    .filter(
      (part) =>
        part.includes('python_requires') ||
        part.includes('build_require') ||
        part.includes('require')
    )
    .filter(Boolean);

  let deps = [];
  for (const section of sections) {
    let depType = 'requires';
    if (section.includes('python_requires')) {
      depType = 'python_requires';
    } else if (section.includes('build_require')) {
      depType = 'build_requires';
    }
    const dependencies = section
      .split('\n')
      .filter((line) => line.length !== 0)
      .map((rawline) => {
        // don't process after a comment
        const line = rawline.split('#')[0].split('//')[0];
        if (line) {
          const matches = regex.exec(line.trim());
          if (matches) {
            let dep: PackageDependency = {};
            const depName = matches.groups.name;
            const currentValue = matches.groups.version.trim();
            let currentDigest = ' ';
            let replaceString = `${depName}/${currentValue}`;
            if (matches.groups.userChannel) {
              currentDigest = matches.groups.userChannel;
              replaceString = `${depName}/${currentValue}${currentDigest}`;
            }

            logger.debug(
              `Found a conan package ${depName} ${currentValue} ${currentDigest} ${depType}`
            );

            // ignore packages with set ranges, conan will handle this on the project side
            if (!currentValue.includes('[')) {
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
              return dep;
            }
          }
        }

        return null;
      })
      .filter(Boolean);

    deps = deps.concat(dependencies);
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
