import { fs } from '../../../test/util';
import { detectGlobalConfig } from './detect';

jest.mock('../../util/fs');

describe('manager/npm/detect', () => {
  describe('.detectGlobalConfig()', () => {
    it('detects .npmrc in home directory', async () => {
      fs.readFile.mockResolvedValueOnce(
        'registry=https://registry.npmjs.org\n'
      );
      const res = await detectGlobalConfig();
      expect(res).toMatchInlineSnapshot(`
Object {
  "npmrc": "registry=https://registry.npmjs.org
",
  "npmrcMerge": true,
}
`);
      expect(res.npmrc).toBeDefined();
      expect(res.npmrcMerge).toBe(true);
    });
    it('handles no .npmrc', async () => {
      fs.readFile.mockImplementationOnce(() => Promise.reject());
      const res = await detectGlobalConfig();
      expect(res).toEqual({});
    });
  });
});
