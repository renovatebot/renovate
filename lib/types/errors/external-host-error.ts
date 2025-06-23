import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';

export class ExternalHostError extends Error {
  hostType: string | undefined;

  err: Error;

  packageName?: string;

  reason?: string;

  constructor(err: Error, hostType?: string) {
    super(EXTERNAL_HOST_ERROR);
    // Set the prototype explicitly: https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, ExternalHostError.prototype);
    this.hostType = hostType;
    this.err = err;
  }
}
