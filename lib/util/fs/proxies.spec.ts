import fs from 'fs-extra';
import { remove } from './proxies';

jest.mock('fs-extra');

describe('util/fs/proxies', () => {
  describe('remove', () => {
    it('should call remove in fs-extra', async () => {
      (fs.remove as jest.Mock).mockResolvedValue(undefined);
      const path = 'path mock';
      expect(await remove(path)).toBeUndefined();
      expect(fs.remove).toHaveBeenNthCalledWith(1, path);
    });
  });
});
