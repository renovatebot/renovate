import { Fixtures } from '../../../../../test/fixtures';
import { fs } from '../../../../../test/util';
import { getYarnLock, getYarnVersionFromLock } from './yarn';

jest.mock('../../../../util/fs');

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
      expect(res.lockedVersions).toMatchSnapshot();
      expect(Object.keys(res.lockedVersions!)).toHaveLength(7);
    });

    it('extracts yarn 2', async () => {
      const plocktest1Lock = Fixtures.get('yarn2/yarn.lock', '..');
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBeFalse();
      expect(res.lockfileVersion).toBeNaN();
      expect(res.lockedVersions).toMatchSnapshot();
      expect(Object.keys(res.lockedVersions!)).toHaveLength(8);
    });

    it('extracts yarn 2 cache version', async () => {
      const plocktest1Lock = Fixtures.get('yarn2.2/yarn.lock', '..');
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBeFalse();
      expect(res.lockfileVersion).toBe(6);
      expect(res.lockedVersions).toMatchSnapshot();
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
});
