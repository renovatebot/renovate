import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import type { Doc } from './types';

function extractYaml(content: string): string {
  // regex remove go templated ({{ . }}) values
  return content
    .replace(regEx(/{{`.+?`}}/gs), '')
    .replace(regEx(/{{.+?}}/g), '');
}

export function loadDocs(content: string): Doc[] {
  return loadAll(extractYaml(content), null, { json: true }) as Doc[];
}

/** Looks for kustomize specific keys in a helmfile and returns true if found */
export function areKustomizationsUsed(
  packageFileName: string,
  content: string
): boolean {
  let docs: Doc[];
  try {
    docs = loadDocs(content);
  } catch (err) {
    logger.debug(
      { err, packageFileName },
      'Failed to parse helmfile helmfile.yaml'
    );
    return false;
  }

  for (const doc of docs) {
    if (!(doc && is.array(doc.releases))) {
      continue;
    }

    for (const release of doc.releases) {
      if (
        release.strategicMergePatches ||
        release.jsonPatches ||
        release.transformers
      ) {
        return true;
      }
    }
  }
  return false;
}
