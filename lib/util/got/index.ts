import got from 'got';
import { create, mergeInstances } from './util';

export * from './common';

const dummy = create({
  options: {},
  handler: (options, next) => {
    return next(options);
  },
});

export const api = mergeInstances(got, dummy);

export default api;
