import { Fixtures } from '../../../test/fixtures';
import { exists, readFile, remove } from './proxies';

jest.mock('fs-extra', () => Fixtures.fsExtra());

describe('util/fs/proxies', () => {
  beforeEach(() => {
    Fixtures.reset();
  });

  describe('remove', () => {
    it('should call remove in fs-extra', async () => {
      Fixtures.mock(
        {
          test: 'test',
        },
        '/'
      );
      expect(await readFile('/test', 'utf8')).toBe('test');
      await remove('/test');
      expect(await exists('/test')).toBeFalse();
    });
  });
});
