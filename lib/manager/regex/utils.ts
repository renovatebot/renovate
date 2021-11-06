import { URL } from 'url';
import { logger } from '../../logger';
import * as template from '../../util/template';
import type { CustomExtractConfig, PackageDependency } from '../types';
import type { ExtractionTemplate } from './types';

export const validMatchFields = [
  'depName',
  'lookupName',
  'currentValue',
  'currentDigest',
  'datasource',
  'versioning',
  'extractVersion',
  'registryUrl',
  'depType',
];

export function createDependency(
  extractionTemplate: ExtractionTemplate,
  config: CustomExtractConfig,
  dep?: PackageDependency
): PackageDependency {
  const dependency = dep || {};
  const { groups, replaceString } = extractionTemplate;

  function updateDependency(field: string, value: string): void {
    switch (field) {
      case 'registryUrl':
        // check if URL is valid and pack inside an array
        try {
          const url = new URL(value).toString();
          dependency.registryUrls = [url];
        } catch (err) {
          logger.warn({ value }, 'Invalid regex manager registryUrl');
        }
        break;
      default:
        dependency[field] = value;
        break;
    }
  }

  for (const field of validMatchFields) {
    const fieldTemplate = `${field}Template`;
    if (config[fieldTemplate]) {
      try {
        const compiled = template.compile(config[fieldTemplate], groups, false);
        updateDependency(field, compiled);
      } catch (err) {
        logger.warn(
          { template: config[fieldTemplate] },
          'Error compiling template for custom manager'
        );
        return null;
      }
    } else if (groups[field]) {
      updateDependency(field, groups[field]);
    }
  }
  dependency.replaceString = replaceString;
  return dependency;
}

export function regexMatchAll(
  regex: RegExp,
  content: string
): RegExpMatchArray[] {
  const matches: RegExpMatchArray[] = [];
  let matchResult;
  do {
    matchResult = regex.exec(content);
    if (matchResult) {
      matches.push(matchResult);
    }
  } while (matchResult);
  return matches;
}

export function mergeGroups(
  mergedGroup: Record<string, string>,
  secondGroup: Record<string, string>
): Record<string, string> {
  return { ...mergedGroup, ...secondGroup };
}

export function mergeExtractionTemplate(
  base: ExtractionTemplate,
  addition: ExtractionTemplate
): ExtractionTemplate {
  return {
    groups: mergeGroups(base.groups, addition.groups),
    replaceString: addition.replaceString ?? base.replaceString,
  };
}
