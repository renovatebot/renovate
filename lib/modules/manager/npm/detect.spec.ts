import { detectGlobalConfig } from './index.ts';
import { fs } from '~test/util.ts';

vi.mock('../../../util/fs/index.ts');

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
