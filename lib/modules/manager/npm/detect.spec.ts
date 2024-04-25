import { fs } from '../../../../test/util';
import { detectGlobalConfig } from '.';

jest.mock('../../../util/fs');

describe('modules/manager/npm/detect', () => {
  describe('.detectGlobalConfig()', () => {
    it('detects .npmrc in home directory', async () => {
      fs.readSystemFile.mockResolvedValueOnce(
        'registry=https://registry.npmjs.org\n',
      );
      const res = await detectGlobalConfig();
      expect(res).toMatchInlineSnapshot(`
        {
          "npmrc": "registry=https://registry.npmjs.org
        ",
          "npmrcMerge": true,
        }
      `);
      expect(res.npmrc).toBeDefined();
      expect(res.npmrcMerge).toBe(true);
    });

    it('handles no .npmrc', async () => {
      fs.readSystemFile.mockRejectedValueOnce('error');
      const res = await detectGlobalConfig();
      expect(res).toEqual({});
    });
  });
});
