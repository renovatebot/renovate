import * as fs from 'fs-extra';
import { getName } from '../../../test/util';
import { remove } from './proxies';

jest.mock('fs-extra');

describe(getName(__filename), () => {
  describe('remove', () => {
    it('should call remove in fs-extra', async () => {
      (fs.remove as jest.Mock).mockResolvedValue(undefined);
      const path = 'path mock';
      expect(await remove(path)).toBeUndefined();
      expect(fs.remove).toHaveBeenNthCalledWith(1, path);
    });
  });
});
