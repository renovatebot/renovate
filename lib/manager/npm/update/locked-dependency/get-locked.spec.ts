import { loadJsonFixture } from '../../../../../test/util';
import { getLockedDependencies } from './get-locked';

jest.mock('../../../../util/fs');

const packageLockJson = loadJsonFixture('package-lock.json');

describe('manager/npm/update/locked-dependency/get-locked', () => {
  describe('getLockedDependencies()', () => {
    it('handles error', () => {
      expect(getLockedDependencies(null as any, 'some-dep', '1.0.0')).toEqual(
        []
      );
    });
    it('returns empty if failed to parse', () => {
      expect(getLockedDependencies({}, 'some-dep', '1.0.0')).toEqual([]);
    });
    it('finds direct dependency', () => {
      // FIXME: explicit assert condition
      expect(
        getLockedDependencies(packageLockJson, 'express', '4.0.0')
      ).toMatchSnapshot();
    });
    it('finds indirect dependency', () => {
      // FIXME: explicit assert condition
      expect(
        getLockedDependencies(packageLockJson, 'send', '0.2.0')
      ).toMatchSnapshot();
    });
  });
});
