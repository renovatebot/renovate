import is from '@sindresorhus/is';
import jsonata from 'jsonata';
import { migrateDatasource } from '../../../../config/migrations/custom/datasource-migration';
import { logger } from '../../../../logger';
import * as template from '../../../../util/template';
import { parseUrl } from '../../../../util/url';
import type { PackageDependency } from '../../types';
import type { ValidMatchFields } from '../utils';
import { checkIsValidDependency, validMatchFields } from '../utils';
import { QueryResultZodSchema } from './schema';
import type { JSONataManagerTemplates, JsonataExtractConfig } from './types';

export async function handleMatching(
  json: unknown,
  packageFile: string,
  config: JsonataExtractConfig,
): Promise<PackageDependency[]> {
  let results: Record<string, string>[] = [];
  const { matchStrings: jsonataQueries } = config;
  for (const query of jsonataQueries) {
    // won't fail as this is verified during config validation
    const jsonataExpression = jsonata(query);
    // this does not throw error, just returns undefined if no matches
    const queryResult = await jsonataExpression.evaluate(json);

    // allows empty dep object cause templates can be used to configure the required fields
    // if some issues arise then the isValidDependency call will catch them later on
    if (!queryResult || is.emptyArray(queryResult)) {
      logger.debug(
        {
          jsonataQuery: query,
          packageFile,
        },
        'The jsonata query returned no matches. Possible error, please check your query. Skipping',
      );
      return [];
    }

    const parsed = QueryResultZodSchema.safeParse(queryResult);
    if (parsed.success) {
      results = results.concat(parsed.data);
    } else {
      logger.warn(
        { err: parsed.error, jsonataQuery: query, packageFile, queryResult },
        'Query results failed schema validation',
      );
      return [];
    }
  }

  return results
    .map((dep) => createDependency(dep, config))
    .filter(is.truthy)
    .filter((dep) =>
      checkIsValidDependency(dep, packageFile, 'custom.jsonata'),
    );
}

export function createDependency(
  queryResult: Record<string, string>,
  config: JsonataExtractConfig,
): PackageDependency | null {
  const dependency: PackageDependency = {};

  for (const field of validMatchFields) {
    const fieldTemplate = `${field}Template` as keyof JSONataManagerTemplates;
    const tmpl = config[fieldTemplate];
    if (tmpl) {
      try {
        const compiled = template.compile(tmpl, queryResult, false);
        updateDependency(field, compiled, dependency);
      } catch {
        logger.debug(
          { template: tmpl },
          'Error compiling template for JSONata manager',
        );
        return null;
      }
    } else if (queryResult[field]) {
      updateDependency(field, queryResult[field], dependency);
    }
  }
  return dependency;
}

function updateDependency(
  field: ValidMatchFields,
  value: string,
  dependency: PackageDependency,
): PackageDependency {
  switch (field) {
    case 'registryUrl': {
      const url = parseUrl(value)?.toString();
      if (!url) {
        logger.debug({ url: value }, 'Invalid JSONata manager registryUrl');
        break;
      }
      dependency.registryUrls = [url];
      break;
    }
    case 'datasource':
      dependency.datasource = migrateDatasource(value);
      break;
    default:
      dependency[field] = value;
      break;
  }

  return dependency;
}
