import { Fixtures } from '../../../../test/fixtures';
import { lazyParsePubspeckLock } from './utils';

describe('modules/manager/pub/utils', () => {
  describe('lazyParsePubspeckLock', () => {
    const pubspecLock = Fixtures.get('pubspec.1.lock');

    it('load and parse successfully', () => {
      const actual = lazyParsePubspeckLock(pubspecLock);
      expect(actual.getValue()).toMatchObject({
        sdks: { dart: '>=3.0.0 <4.0.0', flutter: '>=3.10.0' },
      });
    });

    it('invalid yaml', () => {
      const actual = lazyParsePubspeckLock('clearly-invalid');
      expect(actual.getValue()).toBeNull();
    });

    it('invalid schema', () => {
      const actual = lazyParsePubspeckLock('clearly:\n\tinvalid: lock');
      expect(actual.getValue()).toBeNull();
    });
  });
});
