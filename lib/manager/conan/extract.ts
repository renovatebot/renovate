import { ConanDatasource } from '../../datasource/conan';
import { logger } from '../../logger';
import * as loose from '../../versioning/loose';
import type { PackageDependency, PackageFile } from '../types';

const regex = new RegExp(
  /(?<name>[a-z\-_0-9]+)\/(?<version>[^@\n{*"']+)(?<userChannel>@\S+\/[^\n.{*"' ]+)?/gm
);

export default function extractPackageFile(
  content: string
): PackageFile | null {
  const sections = content
    .split('def ')
    .map((section) => {
      // only process sections where requirements are defined
      if (
        section.includes('python_requires') ||
        section.includes('build_require') ||
        section.includes('require')
      ) {
        return section;
      }
      return null;
    })
    .filter(Boolean);

  let deps = [];
  for (const section of sections) {
    const dependencies = section
      .split('\n')
      .map((rawline) => {
        let dep: PackageDependency = {};
        const line = rawline.split('#')[0].split('//')[0];
        if (line) {
          regex.lastIndex = 0;
          const matches = regex.exec(line.trim());
          if (matches) {
            const depName = matches.groups.name;
            const currentValue = matches.groups.version.trim();
            let currentDigest = ' ';
            let replaceString = `${depName}/${currentValue}`;
            if (matches.groups.userChannel) {
              currentDigest = matches.groups.userChannel;
              replaceString = `${depName}/${currentValue}${currentDigest}`;
            }

            logger.debug(
              `Found a conan package ${depName} ${currentValue} ${currentDigest}`
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
