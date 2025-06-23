import { hostRules } from './util';

export * as hostRules from '../lib/util/host-rules';

beforeEach(() => {
  hostRules.clear();
});
