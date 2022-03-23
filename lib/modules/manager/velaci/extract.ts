import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';
import type { VelaPipelineConfiguration } from './types';

export function extractPackageFile(file: string): PackageFile | null {
  let doc: VelaPipelineConfiguration;

  try {
    doc = load(file, { json: true }) as VelaPipelineConfiguration;
  } catch (err) {
    logger.warn({ err, file }, 'Failed to parse Vela file.');
    return null;
  }

  const deps: PackageDependency[] = [];
  try {
    // iterate over steps
    doc.steps?.forEach((step) => {
      const dep: PackageDependency = getDep(step.image as string);

      dep.depType = 'docker';
      deps.push(dep);
    });

    // iterate over services
    doc.services?.forEach((service) => {
      const dep: PackageDependency = getDep(service.image);

      dep.depType = 'docker';
      deps.push(dep);
    });

    // iterate over stages
    for (const stage in doc.stages) {
      logger.debug(doc.stages[stage]);
      doc.stages[stage].steps.forEach((step) => {
        const dep: PackageDependency = getDep(step.image as string);

        dep.depType = 'docker';
        deps.push(dep);
      });
    }

    // check secrets
    doc.secrets?.forEach((secret) => {
      if (secret.origin) {
        const dep: PackageDependency = getDep(secret.origin.image);

        dep.depType = 'docker';
        deps.push(dep);
      }
    });
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting VelaCI images');
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}
