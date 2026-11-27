import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages.ts';

export class ExternalHostError extends Error {
  hostType: string | undefined;

  err: Error;

  packageName?: string;

  reason?: string;

  /** When true, the error fails only the dependency being looked up instead of aborting the repository run. */
  onlyThisDependencyAffected: boolean;

  constructor(
    err: Error,
    hostType?: string,
    onlyThisDependencyAffected = false,
  ) {
    super(EXTERNAL_HOST_ERROR);
    this.hostType = hostType;
    this.err = err;
    this.onlyThisDependencyAffected = onlyThisDependencyAffected;
  }
}
