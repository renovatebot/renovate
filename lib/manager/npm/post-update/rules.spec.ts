import { getName } from '../../../../test/util';
import * as hostRules from '../../../util/host-rules';
import { processHostRules } from './rules';

describe(getName(), () => {
  describe('processHostRules()', () => {
    beforeEach(() => {
      hostRules.clear();
    });
    it('returns empty if no rules', () => {
      const res = processHostRules();
      expect(res.additionalNpmrcContent).toHaveLength(0);
      expect(res.additionalYarnRcYml).toBeUndefined();
    });
    it('returns empty if no resolvedHost', () => {
      hostRules.add({ hostType: 'npm', token: 'abc123' });
      const res = processHostRules();
      expect(res.additionalNpmrcContent).toHaveLength(0);
      expect(res.additionalYarnRcYml).toBeUndefined();
    });
    it('returns rules content', () => {
      hostRules.add({
        hostType: 'npm',
        matchHost: 'registry.company.com',
        username: 'user123',
        password: 'pass123',
      });
      const res = processHostRules();
      expect(res).toMatchSnapshot();
    });
    it('returns mixed rules content', () => {
      hostRules.add({
        hostType: 'npm',
        matchHost: 'https://registry.npmjs.org',
        token: 'token123',
      });
      hostRules.add({
        hostType: 'npm',
        matchHost: 'https://registry.other.org',
        authType: 'Basic',
        token: 'basictoken123',
      });
      hostRules.add({
        hostType: 'npm',
        matchHost: 'registry.company.com',
        username: 'user123',
        password: 'pass123',
      });
      const res = processHostRules();
      expect(res).toMatchSnapshot();
    });
  });
});
