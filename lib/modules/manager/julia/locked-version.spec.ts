import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { getLockedVersions } from './locked-version.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/julia/locked-version', () => {
  describe('getLockedVersions()', () => {
    it('reads a manifest of format 2.0', async () => {
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        julia_version = "1.10.12"
        manifest_format = "2.0"

        [[deps.Example]]
        git-tree-sha1 = "46e44e869b4d90b96bd8ed1fdcf32244fddfb6cc"
        uuid = "7876AF07-990D-54B4-AB0E-23690620F79A"
        version = "0.5.3"

        [[deps.LinearAlgebra]]
        deps = ["Libdl"]
        uuid = "37e2e46d-f89d-539d-b4ee-838fcccc9c8e"
      `);

      await expect(getLockedVersions('Manifest.toml')).resolves.toEqual(
        new Map([['7876af07-990d-54b4-ab0e-23690620f79a', '0.5.3']]),
      );
      expect(fs.readLocalFile).toHaveBeenCalledWith('Manifest.toml', 'utf8');
    });

    it('reads a manifest of the older layout', async () => {
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        [[Example]]
        git-tree-sha1 = "46e44e869b4d90b96bd8ed1fdcf32244fddfb6cc"
        uuid = "7876af07-990d-54b4-ab0e-23690620f79a"
        version = "0.5.3"

        [[libpng_jll]]
        uuid = "b53b4c65-9356-5827-b1ea-8c7a1a84506f"
        version = "1.6.59+1"
      `);

      await expect(getLockedVersions('Manifest.toml')).resolves.toEqual(
        new Map([
          ['7876af07-990d-54b4-ab0e-23690620f79a', '0.5.3'],
          ['b53b4c65-9356-5827-b1ea-8c7a1a84506f', '1.6.59+1'],
        ]),
      );
    });

    it.each([
      ['without packages', 'manifest_format = "2.0"'],
      ['with malformed packages', 'manifest_format = "2.0"\ndeps = "Example"'],
    ])('reads a manifest of format 2.0 %s', async (_, manifest) => {
      fs.readLocalFile.mockResolvedValueOnce(manifest);

      await expect(getLockedVersions('Manifest.toml')).resolves.toEqual(
        new Map(),
      );
    });

    it('returns null for a missing manifest', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);

      await expect(getLockedVersions('Manifest.toml')).resolves.toBeNull();
    });

    it('returns null for invalid TOML', async () => {
      fs.readLocalFile.mockResolvedValueOnce('not [ valid toml');

      await expect(getLockedVersions('Manifest.toml')).resolves.toBeNull();
    });
  });
});
