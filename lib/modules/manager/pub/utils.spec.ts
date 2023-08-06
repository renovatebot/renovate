import { codeBlock } from 'common-tags';
import { parsePubspecLock } from './utils';

describe('modules/manager/pub/utils', () => {
  describe('parsePubspeckLock', () => {
    const fileName = 'pubspec.lock';

    it('load and parse successfully', () => {
      const pubspecLock = codeBlock`
        sdks:
          dart: ">=3.0.0 <4.0.0"
          flutter: ">=3.10.0"
      `;
      const actual = parsePubspecLock(fileName, pubspecLock);
      expect(actual).toMatchObject({
        sdks: { dart: '>=3.0.0 <4.0.0', flutter: '>=3.10.0' },
      });
    });

    it('invalid yaml', () => {
      const actual = parsePubspecLock(fileName, 'clearly-invalid');
      expect(actual).toBeNull();
    });

    it('invalid schema', () => {
      const actual = parsePubspecLock(fileName, 'clearly:\n\tinvalid: lock');
      expect(actual).toBeNull();
    });
  });
});
