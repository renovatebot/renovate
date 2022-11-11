import { ENDPOINT_NOT_SUPPORTED_ERROR } from '../../constants/error-messages';

export class EndpointNotSupportedError extends Error {
  err: Error;

  constructor(err: Error) {
    super(ENDPOINT_NOT_SUPPORTED_ERROR);
    this.err = err;
  }
}
