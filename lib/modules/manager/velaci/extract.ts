import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import type { VelaPipelineConfiguration } from './types.ts';

export function extractPackageFile(
  file: string,
  packageFile?: string,
): PackageFileContent | null {
  let doc: VelaPipelineConfiguration;

  try {
    // TODO: use schema (#9610)
    doc = parseSingleYaml(file);
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse Vela file.');
    return null;
  }

  const deps: PackageDependency[] = [];

  // iterate over steps
  for (const step of coerceArray(doc.steps)) {
    const dep = getDep(step.image);

    deps.push(dep);
  }

  // iterate over services
  for (const service of coerceArray(doc.services)) {
    const dep = getDep(service.image);

    deps.push(dep);
  }

  // iterate over stages
  for (const stage of Object.values(doc.stages ?? {})) {
    for (const step of coerceArray(stage.steps)) {
      const dep = getDep(step.image);

      deps.push(dep);
    }
  }

  // check secrets
  for (const secret of Object.values(doc.secrets ?? {})) {
    if (secret.origin) {
      const dep = getDep(secret.origin.image);

      deps.push(dep);
    }
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}
