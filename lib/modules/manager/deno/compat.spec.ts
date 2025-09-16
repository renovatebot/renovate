import { fs } from '../../../../test/util';
import { extractDenoCompatiblePackageJson } from './compat';

vi.mock('../../../util/fs');

describe('modules/manager/deno/compat', () => {
  describe('extractDenoCompatiblePackageJson()', () => {
    it('invalid package.json', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce('invalid');
      const result = await extractDenoCompatiblePackageJson('package.json');
      expect(result).toBeNull();
    });

    it('handles null response', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        // This package.json returns null from the extractor
        JSON.stringify({
          _id: 1,
          _args: 1,
          _from: 1,
        }),
      );
      const result = await extractDenoCompatiblePackageJson('package.json');
      expect(result).toBeNull();
    });
  });
});
