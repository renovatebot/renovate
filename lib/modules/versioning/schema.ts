import { isFunction } from '@sindresorhus/is';
import { z } from 'zod/v3';
import { logger } from '../../logger/index.ts';
import versionings from './api.ts';
import * as defaultVersioning from './semver-coerced/index.ts';
import type { VersioningApi } from './types.ts';

export const Versioning = z
  .string()
  .transform((versioningSpec, ctx): VersioningApi => {
    const [versioningName, ...versioningRest] = versioningSpec.split(':');

    let versioning = versionings.get(versioningName);
    if (!versioning) {
      logger.debug(
        `Versioning: '${versioningSpec}' not found, falling back to ${defaultVersioning.id}`,
      );
      return defaultVersioning.api;
    }

    if (isFunction(versioning)) {
      const versioningConfig = versioningRest.length
        ? versioningRest.join(':')
        : undefined;

      try {
        versioning = new versioning(versioningConfig);
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          message: `Versioning: '${versioningSpec}' failed to initialize`,
          params: { error },
        });
        return z.NEVER;
      }
    }

    return versioning;
  });
