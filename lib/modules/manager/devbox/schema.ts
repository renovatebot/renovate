import { z } from 'zod/v3';
import { logger } from '../../../logger/index.ts';
import {
  Jsonc,
  LooseArray,
  LooseRecord,
  withDebugMessage,
} from '../../../util/schema-utils/index.ts';
import { DevboxDatasource } from '../../datasource/devbox/index.ts';
import { api } from '../../versioning/devbox/index.ts';
import type { PackageDependency } from '../types.ts';
import { devboxToolVersioning } from './tool-versioning.ts';

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

    const versioning = devboxToolVersioning[depName];
    if (versioning) {
      dep.versioning = versioning.id;
    }

    if (
      !(versioning?.api ?? api).isValid(currentValue) ||
      !(versioning?.api ?? api).isSingleVersion(currentValue)
    ) {
      logger.debug(
        { depName },
        'Devbox: skipping invalid devbox dependency in devbox JSON file.',
      );
      dep.skipReason = 'invalid-version';
      return dep;
    }

    return dep;
  });

export const Devbox = Jsonc.pipe(
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
  .catch(withDebugMessage([], 'Devbox: does not match schema'));
