import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';

export class ExternalHostError extends Error {
  hostType: string | undefined;

  err: Error;

  packageName?: string;

  reason?: string;

  private static trackedInstances: Set<ExternalHostError> = new Set();

  constructor(err: Error, hostType?: string) {
    super(EXTERNAL_HOST_ERROR);
    // Set the prototype explicitly: https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, ExternalHostError.prototype);
    this.hostType = hostType;
    this.err = err;
    ExternalHostError.trackedInstances.add(this);
  }

  // istanbul ignore next
  stopTracking(): void {
    ExternalHostError.trackedInstances.delete(this);
  }

  // istanbul ignore next
  static resetTracking(): void {
    ExternalHostError.trackedInstances.clear();
  }

  // istanbul ignore next
  static reportPending(): void {
    const messages = new Set<string>();
    for (const err of this.trackedInstances) {
      if (!messages.has(err.message)) {
        messages.add(err.message);
        logger.debug({ err }, 'Uncaught ExternalHostError');
      }
    }
    this.resetTracking();
  }
}
