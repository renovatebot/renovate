import * as massage from './massage';
import type { RenovateConfig } from './types';

describe('config/massage', () => {
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
      expect(Array.isArray(res.schedule)).toBeTrue();
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
    it('massages packageRules matchUpdateTypes with wildcard', () => {
      const config: RenovateConfig = {
        packageRules: [
          {
            // @ts-expect-error - Wildcard is not defined in our types
            matchUpdateTypes: ['*'],
          },
        ],
      };
      const res = massage.massageConfig(config);
      expect(res.packageRules[0].matchUpdateTypes).toHaveLength(6);
    });
    it('does not massage lockFileMaintenance', () => {
      const config: RenovateConfig = {
        packageRules: [
          {
            matchManagers: ['helmv3'],
            matchBaseBranches: ['release/ft10/1.9.x'],
            lockFileMaintenance: { enabled: true },
            schedule: ['at any time'],
          },
        ],
      };
      const res = massage.massageConfig(config);
      expect(res).toMatchSnapshot();
      expect(res.packageRules).toHaveLength(1);
    });
  });
});
