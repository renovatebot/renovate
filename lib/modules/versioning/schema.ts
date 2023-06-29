import is from '@sindresorhus/is';
import { z } from 'zod';
import { logger } from '../../logger';
import versionings from './api';
import * as defaultVersioning from './semver-coerced';
import type { VersioningApi } from './types';

export const Versioning = z
  .unknown()
  .transform((versioningSpec): VersioningApi => {
    if (!is.string(versioningSpec)) {
      logger.debug(
        { versioning: versioningSpec },
        `Versioning: invalid name, falling back to ${defaultVersioning.id}`
      );
      return defaultVersioning.api;
    }

    const [versioningName, ...versioningRest] = versioningSpec.split(':');

    let versioning = versionings.get(versioningName);
    if (!versioning) {
      logger.info(
        { versioning: versioningSpec },
        `Versioning: '${versioningSpec}' not found, falling back to ${defaultVersioning.id}`
      );
      return defaultVersioning.api;
    }

    if (is.function_(versioning)) {
      const versioningConfig = versioningRest.length
        ? versioningRest.join(':')
        : undefined;
      versioning = new versioning(versioningConfig);
    }

    return versioning;
  });
