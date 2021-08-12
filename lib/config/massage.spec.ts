import { getName } from '../../test/util';
import * as massage from './massage';
import type { RenovateConfig } from './types';

describe(getName(), () => {
  describe('massageConfig', () => {
    it('returns empty', () => {
      const config: RenovateConfig = {};
      const res = massage.massageConfig(config);
      expect(res).toEqual({});
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
      expect(massage.massageConfig(config)).toEqual({
        npmrc: '//registry.npmjs.org/:_authToken=some-token\n',
      });
    });
    it('massages packageRules matchUpdateTypes', () => {
      const config: RenovateConfig = {
        packageRules: [
          {
            matchPackageNames: ['foo'],
            separateMajorMinor: false,
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
