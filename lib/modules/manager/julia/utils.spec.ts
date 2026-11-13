import upath from 'upath';
import { fs } from '~test/util.ts';
import { getLockedVersionsManifest, getManifestFileNames } from './utils.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/julia/utils', () => {
  describe('getManifestFileNames()', () => {
    beforeEach(() => {
      fs.getSiblingFileName.mockImplementation((file, sibling) =>
        upath.join(upath.dirname(file), sibling),
      );
    });

    it('takes each versioned manifest and the first plain one', async () => {
      fs.readLocalDirectory.mockResolvedValueOnce([
        'Project.toml',
        'Manifest.toml',
        'JuliaManifest.toml',
        'Manifest-v1.10.toml',
        'JuliaManifest-v1.12.toml',
        'Manifest-v1.12.toml',
        'Manifest-v1.13.toml',
        'JuliaManifest-v1.13.toml',
        'Manifest-v1.x.toml',
      ]);

      await expect(
        getManifestFileNames('pkg/Project.toml', undefined),
      ).resolves.toEqual([
        'pkg/JuliaManifest-v1.12.toml',
        'pkg/JuliaManifest-v1.13.toml',
        'pkg/JuliaManifest.toml',
        'pkg/Manifest-v1.10.toml',
      ]);
      expect(fs.readLocalDirectory).toHaveBeenCalledWith('pkg');
    });

    it('takes Manifest.toml without JuliaManifest.toml', async () => {
      fs.readLocalDirectory.mockResolvedValueOnce([
        'JuliaProject.toml',
        'Manifest.toml',
      ]);

      await expect(
        getManifestFileNames('JuliaProject.toml', undefined),
      ).resolves.toEqual(['Manifest.toml']);
    });

    it('returns none when the directory cannot be listed', async () => {
      fs.readLocalDirectory.mockRejectedValueOnce(new Error('ENOENT'));

      await expect(
        getManifestFileNames('Project.toml', undefined),
      ).resolves.toEqual([]);
    });

    it.each([
      [true, ['Manifest.toml']],
      [false, []],
    ])(
      'takes the manifest that the project names, when it exists: %s',
      async (exists, expected) => {
        fs.localPathExists.mockResolvedValueOnce(exists);

        await expect(
          getManifestFileNames('pkg/Project.toml', '../Manifest.toml'),
        ).resolves.toEqual(expected);
        expect(fs.readLocalDirectory).not.toHaveBeenCalled();
      },
    );
  });

  describe('getLockedVersionsManifest()', () => {
    it.each([
      [['Manifest-v1.10.toml', 'Manifest.toml'], 'Manifest.toml'],
      [
        [
          'JuliaManifest-v1.9.toml',
          'Manifest-v1.10.toml',
          'Manifest-v1.2.toml',
        ],
        'Manifest-v1.10.toml',
      ],
      [
        ['pkg/Manifest-v2.0.toml', 'pkg/Manifest-v1.13.toml'],
        'pkg/Manifest-v2.0.toml',
      ],
      [['../Manifest.toml'], '../Manifest.toml'],
      [[], undefined],
    ])('takes from %j: %s', (manifestFiles, expected) => {
      expect(getLockedVersionsManifest(manifestFiles)).toBe(expected);
    });
  });
});
