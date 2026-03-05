import { hostRules } from './util.ts';

export * as hostRules from '../lib/util/host-rules.ts';

beforeEach(() => {
  hostRules.clear();
});
