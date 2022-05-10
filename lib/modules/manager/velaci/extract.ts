import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';
import type { VelaPipelineConfiguration } from './types';

export function extractPackageFile(file: string): PackageFile | null {
  let doc: VelaPipelineConfiguration | null;

  try {
    doc = load(file, { json: true }) as VelaPipelineConfiguration;
  } catch (err) {
    logger.warn({ err, file }, 'Failed to parse Vela file.');
    return null;
  }

  const deps: PackageDependency[] = [];
  try {
    // iterate over steps
    for (const step of doc.steps ?? []) {
      const dep: PackageDependency = getDep(step.image);

      deps.push(dep);
    }

    // iterate over services
    for (const service of doc.services ?? []) {
      const dep: PackageDependency = getDep(service.image);

      deps.push(dep);
    }

    // iterate over stages
    for (const [, stage] of Object.entries(doc.stages ?? {})) {
      for (const step of stage.steps ?? []) {
        const dep: PackageDependency = getDep(step.image);

        deps.push(dep);
      }
    }

    // check secrets
    for (const [, secret] of Object.entries(doc.secrets)) {
      if (secret.origin) {
        const dep: PackageDependency = getDep(secret.origin.image);

        deps.push(dep);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting VelaCI images');
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}
