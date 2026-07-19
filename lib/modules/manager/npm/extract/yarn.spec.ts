import { Fixtures } from '~test/fixtures.ts';
import { fs } from '~test/util.ts';
import {
  extractYarnCatalogs,
  getYarnLock,
  getYarnVersionFromLock,
} from './yarn.ts';

vi.mock('../../../../util/fs/index.ts');

describe('modules/manager/npm/extract/yarn', () => {
  describe('.getYarnLock()', () => {
    it('returns empty if exception parsing', async () => {
      fs.readLocalFile.mockResolvedValueOnce('abcd');
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBeTrue();
      expect(Object.keys(res.lockedVersions!)).toHaveLength(0);
    });

    it('extracts yarn 1', async () => {
      const plocktest1Lock = Fixtures.get('plocktest1/yarn.lock', '..');
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBeTrue();
      expect(res.lockfileVersion).toBeUndefined();
      expect(res.lockedVersions).toEqual({
        'ansi-styles@^3.2.1': '3.2.1',
        'chalk@^2.4.1': '2.4.1',
        'color-convert@^1.9.0': '1.9.1',
        'color-name@^1.1.1': '1.1.3',
        'escape-string-regexp@^1.0.5': '1.0.5',
        'has-flag@^3.0.0': '3.0.0',
        'supports-color@^5.3.0': '5.4.0',
      });
      expect(Object.keys(res.lockedVersions!)).toHaveLength(7);
    });

    it('extracts yarn 2', async () => {
      const plocktest1Lock = Fixtures.get('yarn2/yarn.lock', '..');
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBeFalse();
      expect(res.lockfileVersion).toBeNaN();
      expect(res.lockedVersions).toEqual({
        'ansi-styles@^3.2.1': '3.2.1',
        'chalk@^2.4.1': '2.4.2',
        'color-convert@^1.9.0': '1.9.3',
        'color-name@1.1.3': '1.1.3',
        'escape-string-regexp@^1.0.5': '1.0.5',
        'has-flag@^3.0.0': '3.0.0',
        'supports-color@^5.3.0': '5.5.0',
        'yarn2@.': '0.0.0-use.local',
      });
      expect(Object.keys(res.lockedVersions!)).toHaveLength(8);
    });

    it('extracts yarn 2 cache version', async () => {
      const plocktest1Lock = Fixtures.get('yarn2.2/yarn.lock', '..');
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBeFalse();
      expect(res.lockfileVersion).toBe(6);
      expect(res.lockedVersions).toEqual({
        '@babel/runtime@^7.11.2': '7.11.2',
        'ansi-styles@^3.2.1': '3.2.1',
        'chalk@^2.4.1': '2.4.2',
        'color-convert@^1.9.0': '1.9.3',
        'color-name@1.1.3': '1.1.3',
        'escape-string-regexp@^1.0.5': '1.0.5',
        'has-flag@^3.0.0': '3.0.0',
        'regenerator-runtime@^0.13.4': '0.13.7',
        'supports-color@^5.3.0': '5.5.0',
        'yarn2@.': '0.0.0-use.local',
      });
      expect(Object.keys(res.lockedVersions!)).toHaveLength(10);
    });

    it('ignores individual invalid entries', async () => {
      const invalidNameLock = Fixtures.get(
        'yarn1-invalid-name/yarn.lock',
        '..',
      );
      fs.readLocalFile.mockResolvedValueOnce(invalidNameLock);
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBeTrue();
      expect(res.lockfileVersion).toBeUndefined();
      expect(Object.keys(res.lockedVersions!)).toHaveLength(14);
    });
  });

  it('getYarnVersionFromLock', () => {
    expect(getYarnVersionFromLock({ isYarn1: true })).toBe('^1.22.18');
    expect(
      getYarnVersionFromLock({ isYarn1: false, lockfileVersion: 12 }),
    ).toBe('>=4.0.0');
    expect(
      getYarnVersionFromLock({ isYarn1: false, lockfileVersion: 10 }),
    ).toBe('^4.0.0');
    expect(getYarnVersionFromLock({ isYarn1: false, lockfileVersion: 8 })).toBe(
      '^3.0.0',
    );
    expect(getYarnVersionFromLock({ isYarn1: false, lockfileVersion: 6 })).toBe(
      '^2.2.0',
    );
    expect(getYarnVersionFromLock({ isYarn1: false, lockfileVersion: 3 })).toBe(
      '^2.0.0',
    );
  });

  describe('.extractYarnCatalogs()', () => {
    it('handles empty catalog entries', async () => {
      expect(
        await extractYarnCatalogs({}, 'package.json', false),
      ).toMatchObject({
        deps: [],
      });
    });

    it('parses valid .yarnrc.yml file', async () => {
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.getSiblingFileName.mockReturnValueOnce('yarn.lock');
      expect(
        await extractYarnCatalogs(
          {
            catalog: {
              react: '18.3.0',
            },
            catalogs: {
              react17: {
                react: '17.0.2',
              },
            },
          },
          'package.json',
          true,
        ),
      ).toMatchObject({
        deps: [
          {
            currentValue: '18.3.0',
            datasource: 'npm',
            depName: 'react',
            depType: 'yarn.catalog.default',
            prettyDepType: 'yarn.catalog.default',
          },
          {
            currentValue: '17.0.2',
            datasource: 'npm',
            depName: 'react',
            depType: 'yarn.catalog.react17',
            prettyDepType: 'yarn.catalog.react17',
          },
        ],
        managerData: {
          yarnLock: 'yarn.lock',
          hasPackageManager: true,
        },
      });
    });

    it('finds relevant lockfile', async () => {
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.getSiblingFileName.mockReturnValueOnce('yarn.lock');
      expect(
        await extractYarnCatalogs(
          {
            catalog: {
              react: '18.3.1',
            },
          },
          'package.json',
          false,
        ),
      ).toMatchObject({
        managerData: {
          yarnLock: 'yarn.lock',
          hasPackageManager: false,
        },
      });
    });
  });
});
