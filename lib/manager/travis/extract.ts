import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import * as datasourceGithubTags from '../../datasource/github-tags';
import { logger } from '../../logger';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  // TODO: fix type
  let doc: any;
  try {
    doc = load(content, { json: true });
  } catch (err) {
    logger.warn({ err, content }, 'Failed to parse .travis.yml file.');
    return null;
  }
  let deps: PackageDependency[] = [];
  if (doc && is.array(doc.node_js)) {
    deps = doc.node_js.map((currentValue) => ({
      depName: 'node',
      datasource: datasourceGithubTags.id,
      lookupName: 'nodejs/node',
      currentValue: currentValue.toString(),
    }));
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
