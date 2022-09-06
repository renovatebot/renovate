import pAll from 'p-all';
import pMap from 'p-map';

type PromiseFactory<T> = () => Promise<T>;

export function all<T>(
  tasks: PromiseFactory<T>[],
  options?: pAll.Options
): Promise<T[]> {
  return pAll(tasks, {
    concurrency: 5,
    ...options,
    stopOnError: true,
  });
}

export function map<Element, NewElement>(
  input: Iterable<Element>,
  mapper: pMap.Mapper<Element, NewElement>,
  options?: pMap.Options
): Promise<NewElement[]> {
  return pMap(input, mapper, {
    concurrency: 5,
    ...options,
    stopOnError: true,
  });
}
