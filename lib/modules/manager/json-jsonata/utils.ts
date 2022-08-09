import { URL } from 'url';
import type { JSONataManagerTemplates } from '../../../config/types';
import { logger } from '../../../logger';
import * as template from '../../../util/template';
import type { PackageDependency } from '../types';
import type { CustomExtractConfig } from './types';

export const validMatchFields = [
  'depName',
  'packageName',
  'currentValue',
  'currentDigest',
  'datasource',
  'versioning',
  'extractVersion',
  'registryUrl',
  'depType',
] as const;

type ValidMatchFields = typeof validMatchFields[number];

export function createDependency(
  queryResult: Record<string, string>,
  config: CustomExtractConfig
): PackageDependency | null {
  const dependency: PackageDependency = {};

  function updateDependency(field: ValidMatchFields, value: string): void {
    switch (field) {
      case 'registryUrl':
        // check if URL is valid and pack inside an array
        try {
          const url = new URL(value).toString();
          dependency.registryUrls = [url];
        } catch (err) {
          logger.warn({ value }, 'Invalid json manager registryUrl');
        }
        break;
      default:
        dependency[field] = value;
        break;
    }
  }

  for (const field of validMatchFields) {
    const fieldTemplate = `${field}Template` as keyof JSONataManagerTemplates;
    const tmpl = config[fieldTemplate];
    if (tmpl) {
      try {
        const compiled = template.compile(tmpl, queryResult, false);
        updateDependency(field, compiled);
      } catch (err) {
        logger.warn(
          { template: tmpl },
          'Error compiling template for JSONata manager'
        );
        return null;
      }
    } else if (queryResult[field]) {
      updateDependency(field, queryResult[field]);
    }
  }
  return dependency;
}
