import { loadJsonFixture } from '../../../../../../test/util';
import { getLockedDependencies } from './get-locked';

jest.mock('../../../../../util/fs');

const packageLockJson = loadJsonFixture('package-lock.json');
const bundledPackageLockJson = loadJsonFixture('bundled.package-lock.json');

describe('manager/npm/update/locked-dependency/package-lock/get-locked', () => {
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
      ).toMatchSnapshot([
        {
          resolved: 'https://registry.npmjs.org/express/-/express-4.0.0.tgz',
          version: '4.0.0',
        },
      ]);
    });
    it('finds indirect dependency', () => {
      expect(
        getLockedDependencies(packageLockJson, 'send', '0.2.0')
      ).toMatchSnapshot([
        {
          resolved: 'https://registry.npmjs.org/send/-/send-0.2.0.tgz',
          version: '0.2.0',
        },
      ]);
    });
    it('finds bundled dependency', () => {
      expect(
        getLockedDependencies(bundledPackageLockJson, 'ansi-regex', '3.0.0')
      ).toMatchSnapshot([
        {
          bundled: true,
          dev: true,
          integrity: 'sha1-7QMXwyIGT3lGbAKWa922Bas32Zg=',
          resolved:
            'https://registry.npmjs.org/ansi-regex/-/ansi-regex-3.0.0.tgz',
          version: '3.0.0',
        },
      ]);
    });
  });
});
