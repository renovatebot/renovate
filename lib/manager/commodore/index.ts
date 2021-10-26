import * as datasourceGitRefs from '../../datasource/git-refs';
import type { PackageDependency, PackageFile } from '../types';

import { logger } from '../../logger';

import yaml from 'js-yaml';

export const defaultConfig = {
  fileMatch: ['^*.yml$'],
};

interface CommodoreConfig {
  parameters: CommodoreParameters;
}

interface CommodoreParameters {
  components: Map<string, CommodoreComponentDependency>;
}

interface CommodoreComponentDependency {
  name: string;
  url: string;
  version: string;
}

function readComponents(content: string): CommodoreComponentDependency[] {
  let doc: CommodoreConfig = yaml.load(content) as CommodoreConfig;
  if (
    doc === undefined ||
    doc === null ||
    doc.parameters === undefined ||
    doc.parameters === null ||
    doc.parameters.components === undefined ||
    doc.parameters.components === null
  ) {
    return [];
  }

  let comps: Array<CommodoreComponentDependency> = [];
  for (let k in doc.parameters.components) {
    let com = doc.parameters.components[k];
    com.name = k;
    comps.push(com);
  }
  return comps;
}

export function extractPackageFile(
  content: string,
  fileName: string
): PackageFile | null {
  let components: CommodoreComponentDependency[];

  components = readComponents(content);
  try {
  } catch (err) {
    logger.debug({ fileName }, 'Failed to parse component parameter');
    return null;
  }

  let deps = components.map((v: CommodoreComponentDependency) => {
    return {
      depName: `${v.name} in ${fileName}`,
      lookupName: v.url,
      currentValue: v.version,
    } as PackageDependency;
  });
  return { deps, datasource: datasourceGitRefs.id };
}
