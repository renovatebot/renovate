import { codeBlock } from 'common-tags';
import upath from 'upath';
import { fs } from '~test/util.ts';
import { logger } from '../../../logger/index.ts';
import {
  getJuliaConstraint,
  getJuliaMinor,
  getLockedVersionsManifest,
  getManifestFileNames,
} from './utils.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/julia/utils', () => {
  describe('getManifestFileNames()', () => {
    beforeEach(() => {
      fs.getSiblingFileName.mockImplementation((file, sibling) =>
        upath.join(upath.dirname(file), sibling),
      );
      fs.isValidLocalPath.mockReturnValue(true);
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
      'takes the manifest that the project names, even before it exists: %s',
      async (exists, expected) => {
        fs.localPathExists.mockResolvedValueOnce(exists);

        await expect(
          getManifestFileNames('pkg/Project.toml', '../Manifest.toml'),
        ).resolves.toEqual(expected);
        expect(fs.readLocalDirectory).not.toHaveBeenCalled();
      },
    );

    it('does not read a named manifest outside the repository', async () => {
      fs.isValidLocalPath.mockReturnValueOnce(false);

      await expect(
        getManifestFileNames('Project.toml', '../Manifest.toml'),
      ).resolves.toEqual([]);
      expect(fs.localPathExists).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        { packageFile: 'Project.toml', manifestFile: '../Manifest.toml' },
        'Julia manifest is outside the repository',
      );
    });

    describe('in a workspace', () => {
      const files: Record<string, string> = {};

      beforeEach(() => {
        for (const file of Object.keys(files)) {
          delete files[file];
        }
        fs.readLocalFile.mockImplementation((file) =>
          Promise.resolve(files[file] ?? null),
        );
        fs.readLocalDirectory.mockResolvedValue([
          'Project.toml',
          'Manifest.toml',
        ]);
      });

      it('takes the manifest of the workspace that lists the project', async () => {
        files['Project.toml'] = codeBlock`
          [workspace]
          projects = ["test", "sub/docs"]
        `;

        await expect(
          getManifestFileNames('test/Project.toml', 'Manifest-test.toml'),
        ).resolves.toEqual(['Manifest.toml']);
        await expect(
          getManifestFileNames('sub/docs/Project.toml', undefined),
        ).resolves.toEqual(['Manifest.toml']);
        expect(fs.readLocalDirectory).toHaveBeenCalledWith('.');
        expect(fs.readLocalDirectory).not.toHaveBeenCalledWith('test');
      });

      it('looks past a parent project without the workspace', async () => {
        files['sub/JuliaProject.toml'] = codeBlock`
          [deps]
        `;
        files['sub/Project.toml'] = codeBlock`
          [workspace]
          projects = ["docs"]
        `;
        files['Project.toml'] = codeBlock`
          [workspace]
          projects = ["sub/docs"]
        `;

        await expect(
          getManifestFileNames('sub/docs/Project.toml', undefined),
        ).resolves.toEqual(['Manifest.toml']);
        expect(fs.readLocalFile).not.toHaveBeenCalledWith(
          'sub/Project.toml',
          'utf8',
        );
      });

      it('takes the manifest that the workspace names', async () => {
        files['JuliaProject.toml'] = codeBlock`
          manifest = "Manifest-ws.toml"

          [workspace]
          projects = ["test"]
        `;
        fs.localPathExists.mockResolvedValueOnce(true);

        await expect(
          getManifestFileNames('test/Project.toml', undefined),
        ).resolves.toEqual(['Manifest-ws.toml']);
      });

      it.each([
        ['does not list the project', 'projects = ["docs"]'],
        ['is malformed', 'projects = "test"'],
      ])(
        'takes the own manifests when the workspace %s',
        async (_, projects) => {
          files['Project.toml'] = `[workspace]\n${projects}\n`;

          await expect(
            getManifestFileNames('test/Project.toml', undefined),
          ).resolves.toEqual(['test/Manifest.toml']);
        },
      );

      it('ignores a parent project that is not TOML', async () => {
        files['Project.toml'] = 'not toml [';

        await expect(
          getManifestFileNames('test/Project.toml', undefined),
        ).resolves.toEqual(['test/Manifest.toml']);
      });
    });
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

  describe('getJuliaMinor()', () => {
    it.each([
      ['julia_version = "1.10.12"', '1.10'],
      ['julia_version = "1.14.0-DEV"', '1.14'],
      ['[[Example]]\nversion = "0.5.5"', '1.6'],
      ['not [ toml', '1.6'],
    ])('returns the minor version for %j', (manifest, expected) => {
      expect(getJuliaMinor(codeBlock`${manifest}`)).toBe(expected);
    });
  });

  describe('getJuliaConstraint()', () => {
    it.each([
      ['julia_version = "1.10.12"', '=1.10.12'],
      ['[[Example]]\nversion = "0.5.5"', '~1.6'],
      ['not [ toml', '~1.6'],
    ])('returns the constraint for %j', (manifest, expected) => {
      expect(getJuliaConstraint(codeBlock`${manifest}`)).toBe(expected);
    });
  });
});
