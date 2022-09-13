import { ENDPOINT_NOT_SUPPORTED_ERROR } from '../../constants/error-messages';

export class EndpointNotSupportedError extends Error {
  err: Error;

  constructor(err: Error) {
    super(ENDPOINT_NOT_SUPPORTED_ERROR);
    // Set the prototype explicitly: https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, EndpointNotSupportedError.prototype);
    this.err = err;
  }
}
