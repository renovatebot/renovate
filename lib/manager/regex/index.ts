import * as template from '../../util/template';
import { CustomExtractConfig, PackageFile, Result } from '../common';
import { regEx } from '../../util/regex';
import { logger } from '../../logger';

export const autoReplace = true;

export const defaultConfig = {
  pinDigests: false,
};

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: CustomExtractConfig
): Result<PackageFile | null> {
  const regexMatch = regEx(config.matchStrings[0], 'g');
  const deps = [];
  let matchResult;
  let depIndex = 0;
  do {
    matchResult = regexMatch.exec(content);
    if (matchResult) {
      const dep: any = {};
      const { groups } = matchResult;
      const fields = [
        'depName',
        'lookupName',
        'currentValue',
        'currentDigest',
        'datasource',
        'versioning',
      ];
      for (const field of fields) {
        const fieldTemplate = `${field}Template`;
        if (config[fieldTemplate]) {
          try {
            dep[field] = template.compile(config[fieldTemplate], groups);
          } catch (err) {
            logger.warn(
              { template: config[fieldTemplate] },
              'Error compiling template for custom manager'
            );
            return null;
          }
        } else if (groups[field]) {
          dep[field] = groups[field];
        }
      }
      dep.autoReplaceData = {
        depIndex,
        replaceString: `${matchResult[0]}`,
      };
      deps.push(dep);
    }
    depIndex += 1;
  } while (matchResult);
  if (deps.length) {
    return { deps, matchStrings: config.matchStrings };
  }
  return null;
}
