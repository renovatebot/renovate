import { z } from 'zod';
import { logger } from '../../../logger';
import { Jsonc, LooseArray, LooseRecord } from '../../../util/schema-utils';
import { DevboxDatasource } from '../../datasource/devbox';
import { api as devboxVersioning } from '../../versioning/devbox';
import type { PackageDependency } from '../types';

const DevboxEntry = z
  .array(z.string())
  .min(1)
  .transform(([depName, currentValue]) => {
    const dep: PackageDependency = {
      datasource: DevboxDatasource.id,
      depName,
    };

    if (!currentValue) {
      logger.trace(
        { depName },
        'Devbox: skipping invalid devbox dependency in devbox JSON file.',
      );
      dep.skipReason = 'not-a-version';
      return dep;
    }

    dep.currentValue = currentValue;

    if (!devboxVersioning.isValid(currentValue)) {
      logger.trace(
        { depName },
        'Devbox: skipping invalid devbox dependency in devbox JSON file.',
      );
      dep.skipReason = 'invalid-version';
      return dep;
    }

    return dep;
  });

export const DevboxSchema = Jsonc.pipe(
  z.object({
    packages: z
      .union([
        LooseArray(z.string().transform((pkg) => pkg.split('@'))),
        LooseRecord(
          z.union([
            z.string(),
            z
              .object({ version: z.string() })
              .transform(({ version }) => version),
          ]),
        ).transform((obj) => Object.entries(obj)),
      ])
      .pipe(LooseArray(DevboxEntry)),
  }),
)
  .transform(({ packages }) => packages)
  .nullable()
  .catch(({ error: err }) => {
    logger.debug({ err }, 'Devbox: error parsing file');
    return null;
  });
