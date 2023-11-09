import AggregateError from 'aggregate-error';
import pAll from 'p-all';
import pMap from 'p-map';
import { logger } from '../logger';
import { ExternalHostError } from '../types/errors/external-host-error';

type PromiseFactory<T> = () => Promise<T>;

function isExternalHostError(err: any): err is ExternalHostError {
  return err instanceof ExternalHostError;
}

function handleError(err: any): never {
  if (!(err instanceof AggregateError)) {
    throw err;
  }

  logger.debug({ err }, 'Aggregate error is thrown');

  const errors = [...err];

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

  throw err;
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
  mapper: pMap.Mapper<Element, NewElement>,
  options?: pMap.Options,
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
