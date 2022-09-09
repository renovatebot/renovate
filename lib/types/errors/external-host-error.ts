import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';

export class ExternalHostError extends Error {
  hostType: string | undefined;

  err: Error;

  packageName?: string;

  reason?: string;

  timeoutId: NodeJS.Timeout | undefined;

  constructor(err: Error, hostType?: string) {
    super(EXTERNAL_HOST_ERROR);
    // Set the prototype explicitly: https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, ExternalHostError.prototype);
    this.hostType = hostType;
    this.err = err;

    // istanbul ignore if
    if (process.env.RENOVATE_X_EXTERNAL_HOST_ERROR_LOG_TIMEOUT_MINUTES) {
      const timeoutMinutes = parseInt(
        process.env.RENOVATE_X_EXTERNAL_HOST_ERROR_LOG_TIMEOUT_MINUTES,
        10
      );
      this.timeoutId = setTimeout(() => /* istanbul ignore next*/ {
        logger.debug(
          { err: this, reasonErr: err },
          'Uncaught ExternalHostError'
        );
      }, timeoutMinutes * 60 * 1000);
    }
  }

  resetTimeout(): void {
    // istanbul ignore if
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }
}
