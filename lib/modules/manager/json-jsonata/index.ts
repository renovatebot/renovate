import is from '@sindresorhus/is';
import jsonata from 'jsonata';
import type { JSONataManagerTemplates } from '../../../config/types';
import { logger } from '../../../logger';
import type { PackageDependency, PackageFile, Result } from '../types';
import type { CustomExtractConfig } from './types';
import { createDependency } from './utils';

export const supportedDatasources: string[] = ['*'];

export const defaultConfig = {
  fileMatch: [],
};

export interface CustomPackageFile extends PackageFile {
  matchQueries: string[];
}

export function testJsonQuery(query: string): void {
  jsonata(query);
}

const validMatchFields = [
  'depName',
  'packageName',
  'currentValue',
  'currentDigest',
  'datasource',
  'versioning',
  'extractVersion',
  'registryUrl',
  'depType',
];

function handleMatching(
  json: unknown,
  packageFile: string,
  config: CustomExtractConfig
): PackageDependency[] {
  return config.matchQueries
    .flatMap((matchQuery) => jsonata(matchQuery).evaluate(json) || [])
    .map((queryResult) =>
      createDependency(queryResult as Record<string, string>, config)
    )
    .filter(is.truthy);
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: CustomExtractConfig
): Result<PackageFile | null> {
  let deps: PackageDependency[];

  let json;
  try {
    json = JSON.parse(content);
  } catch (err) {
    logger.warn(
      { err, content, fileName: packageFile },
      `error parsing '${packageFile}'`
    );
    return null;
  }

  deps = handleMatching(json, packageFile, config);

  // filter all null values
  deps = deps.filter(is.truthy);
  if (deps.length) {
    const res: CustomPackageFile & JSONataManagerTemplates = {
      deps,
      matchQueries: config.matchQueries,
    };
    // copy over templates for autoreplace
    for (const field of validMatchFields.map(
      (f) => `${f}Template` as keyof JSONataManagerTemplates
    )) {
      if (config[field]) {
        res[field] = config[field];
      }
    }
    if (config.autoReplaceStringTemplate) {
      res.autoReplaceStringTemplate = config.autoReplaceStringTemplate;
    }
    return res;
  }

  return null;
}
