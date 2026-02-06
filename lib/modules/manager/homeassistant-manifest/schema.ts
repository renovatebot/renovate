import { z } from 'zod';
import { logger } from '../../../logger/index.ts';
import { Json, LooseArray } from '../../../util/schema-utils/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { extractPackageFile as extractPipRequirements } from '../pip_requirements/extract.ts';
import type { PackageDependency } from '../types.ts';

const Requirement = z.string().transform((requirement) => {
  const pipResult = extractPipRequirements(requirement);
  const dep = pipResult?.deps?.[0];
  if (dep) {
    return dep;
  }
  logger.debug({ requirement }, 'Unable to parse requirement version');
  return {
    depName: requirement,
    datasource: PypiDatasource.id,
    skipReason: 'invalid-dependency-specification',
  } as PackageDependency;
});

export const HomeAssistantManifest = Json.pipe(
  z.object({
    domain: z.string(),
    name: z.string(),
    requirements: LooseArray(Requirement).optional(),
  }),
).transform(
  ({ requirements }): PackageDependency[] | undefined => requirements,
);
