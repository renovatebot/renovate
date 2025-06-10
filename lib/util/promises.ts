import AggregateErrorLegacy from 'aggregate-error';
import pAll from 'p-all';
import type { Mapper, Options } from 'p-map';
import pMap from 'p-map';
import { logger } from '../logger';
import { ExternalHostError } from '../types/errors/external-host-error';

type PromiseFactory<T> = () => Promise<T>;

function isExternalHostError(err: any): err is ExternalHostError {
  return err instanceof ExternalHostError;
}

function handleMultipleErrors(errors: Error[]): never {
  const hostError = errors.find(isExternalHostError);
  if (hostError) {
    throw hostError;
  }
  if (
    errors.length === 1 ||
    new Set(errors.map(({ message }) => message)).size === 1
  ) {
    const [error] = errors;
    throw error;
  }

  throw new AggregateError(errors);
}

function handleError(err: any): never {
  // AggregateErrorLegacy can be dropped after `p_all` was upgraded too
  // https://github.com/renovatebot/renovate/issues/36429
  if (!(err instanceof AggregateError || err instanceof AggregateErrorLegacy)) {
    throw err;
  }

  logger.debug({ err }, 'Aggregate error is thrown');
  handleMultipleErrors(err instanceof AggregateError ? err.errors : [...err]);
}

export async function all<T>(
  tasks: PromiseFactory<T>[],
  options?: pAll.Options,
): Promise<T[]> {
  try {
    const res = await pAll(tasks, {
      concurrency: 5,
      stopOnError: false,
      ...options,
    });
    return res;
  } catch (err) {
    return handleError(err);
  }
}

export async function map<Element, NewElement>(
  input: Iterable<Element>,
  mapper: Mapper<Element, NewElement>,
  options?: Options,
): Promise<NewElement[]> {
  try {
    const res = await pMap(input, mapper, {
      concurrency: 5,
      stopOnError: false,
      ...options,
    });
    return res;
  } catch (err) {
    return handleError(err);
  }
}
