import { Fixtures } from '../../../../test/fixtures';
import { lazyParsePubspeckLock } from './utils';

describe('modules/manager/pub/utils', () => {
  describe('lazyParsePubspeckLock', () => {
    const fileName = 'pubspec.lock';
    const pubspecLock = Fixtures.get('pubspec.1.lock');

    it('load and parse successfully', () => {
      const actual = lazyParsePubspeckLock(fileName, pubspecLock);
      expect(actual.getValue()).toMatchObject({
        sdks: { dart: '>=3.0.0 <4.0.0', flutter: '>=3.10.0' },
      });
    });

    it('invalid yaml', () => {
      const actual = lazyParsePubspeckLock(fileName, 'clearly-invalid');
      expect(actual.getValue()).toBeNull();
    });

    it('invalid schema', () => {
      const actual = lazyParsePubspeckLock(
        fileName,
        'clearly:\n\tinvalid: lock'
      );
      expect(actual.getValue()).toBeNull();
    });
  });
});
