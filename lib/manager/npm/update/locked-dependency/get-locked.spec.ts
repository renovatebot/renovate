import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { getName } from '../../../../../test/util';
import { getLockedDependencies } from './get-locked';

jest.mock('../../../../util/fs');

const packageLockJson = JSON.parse(
  readFileSync(resolve(__dirname, './__fixtures__/package-lock.json'), 'utf8')
);

describe(getName(__filename), () => {
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
      expect(
        getLockedDependencies(packageLockJson, 'express', '4.0.0')
      ).toMatchSnapshot();
    });
    it('finds indirect dependency', () => {
      expect(
        getLockedDependencies(packageLockJson, 'send', '0.2.0')
      ).toMatchSnapshot();
    });
  });
});
