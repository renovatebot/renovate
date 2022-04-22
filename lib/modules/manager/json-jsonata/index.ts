import { URL } from 'url';
import jsonata from 'jsonata';
import { logger } from '../../../logger';
import * as template from '../../../util/template';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  Result,
} from '../types';

export const supportedDatasources: string[] = ['*'];

export const defaultConfig = {
  fileMatch: [],
};

export interface CustomExtractConfig extends ExtractConfig {
  matchQueries: string[];
  autoReplaceStringTemplate?: string;
  depNameTemplate?: string;
  packageNameTemplate?: string;
  datasourceTemplate?: string;
  versioningTemplate?: string;
  depTypeTemplate?: string;
}

export interface CustomPackageFile extends PackageFile {
  matchQueries: string[];
}

export function testJsonQuery(query): void {
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

function createDependency(
  queryResult: Record<string, string>,
  config: CustomExtractConfig
): PackageDependency {
  const dependency: PackageDependency = {};

  function updateDependency(field: string, value: string): void {
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
    const fieldTemplate = `${field}Template`;
    if (config[fieldTemplate]) {
      try {
        const compiled = template.compile(
          config[fieldTemplate] as string,
          queryResult,
          false
        );
        updateDependency(field, compiled);
      } catch (err) {
        logger.warn(
          { template: config[fieldTemplate] },
          'Error compiling template for custom manager'
        );
        return null;
      }
    } else if (queryResult[field]) {
      updateDependency(field, queryResult[field]);
    }
  }
  return dependency;
}

function handleMatching(
  json: unknown,
  packageFile: string,
  config: CustomExtractConfig
): PackageDependency[] {
  return config.matchQueries
    .flatMap((matchQuery) => jsonata(matchQuery).evaluate(json) || [])
    .map((queryResult) =>
      createDependency(queryResult as Record<string, string>, config)
    );
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
  deps = deps.filter(Boolean);
  if (deps.length) {
    const res: CustomPackageFile = { deps, matchQueries: config.matchQueries };
    // copy over templates for autoreplace
    for (const field of validMatchFields.map((f) => `${f}Template`)) {
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
