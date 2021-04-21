import { getName } from '../../test/util';
import * as massage from './massage';
import type { RenovateConfig } from './types';

describe(getName(__filename), () => {
  describe('massageConfig', () => {
    it('returns empty', () => {
      const config: RenovateConfig = {};
      const res = massage.massageConfig(config);
      expect(res).toMatchSnapshot();
    });
    it('massages strings to array', () => {
      const config: RenovateConfig = {
        schedule: 'before 5am' as never,
      };
      const res = massage.massageConfig(config);
      expect(Array.isArray(res.schedule)).toBe(true);
    });
    it('massages npmToken', () => {
      const config: RenovateConfig = {
        npmToken: 'some-token',
      };
      expect(massage.massageConfig(config)).toMatchSnapshot();
    });
    it('massages packageRules matchUpdateTypes', () => {
      const config: RenovateConfig = {
        packageRules: [
          {
            matchPackageNames: ['foo'],
            minor: {
              semanticCommitType: 'feat',
            },
            patch: {
              semanticCommitType: 'fix',
            },
          },
        ],
      };
      const res = massage.massageConfig(config);
      expect(res).toMatchSnapshot();
      expect(res.packageRules).toHaveLength(3);
    });
  });
});
