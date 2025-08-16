import { codeBlock } from 'common-tags';
import * as templates from '../../../../util/template';
import type { BranchConfig } from '../../../types';
import { bumpVersions } from './bump-versions';
import { fs, logger, partial, scm } from '~test/util';

vi.mock('../../../../util/fs');

describe('workers/repository/update/branch/bump-versions', () => {
  describe('bumpVersions', () => {
    it('should be noop if bumpVersions is undefined', async () => {
      const config = {} as BranchConfig;
      await bumpVersions(config);

      expect(config).toEqual({});
    });

    it('should be noop if bumpVersions is empty array', async () => {
      const config = partial<BranchConfig>({
        bumpVersions: [],
      });
      await bumpVersions(config);

      expect(config).toEqual({
        bumpVersions: [],
      });
    });

    it('should be noop if no packageFiles or artifacts have been updated', async () => {
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            filePatterns: ['\\.release-version'],
            bumpType: 'minor',
            matchStrings: ['^(?<version>.+)$'],
          },
        ],
        updatedPackageFiles: [],
        updatedArtifacts: [],
      });
      await bumpVersions(config);

      expect(config).toMatchObject({
        updatedPackageFiles: [],
        updatedArtifacts: [],
      });
    });

    it('should catch template error in filePatterns', async () => {
      vi.spyOn(templates, 'compile').mockImplementationOnce(() => {
        throw new Error("Unexpected token '{'");
      });
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            filePatterns: ['\\^'],
            bumpType: 'minor',
            matchStrings: ['^(?<version>.+)$'],
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: 'bar',
          },
        ],
        updatedArtifacts: [],
      });
      scm.getFileList.mockResolvedValueOnce(['foo']);

      await bumpVersions(config);

      expect(config).toMatchObject({
        artifactErrors: [
          {
            stderr:
              "Failed to calculate matched files for bumpVersions: Unexpected token '{'",
          },
        ],
      });
    });

    it('should catch template error in matchString', async () => {
      const compile = vi.spyOn(templates, 'compile');
      compile.mockReturnValueOnce('foo');
      compile.mockImplementationOnce(() => {
        throw new Error("Unexpected token '{'");
      });
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            name: 'bar',
            filePatterns: ['foo'],
            bumpType: 'minor',
            matchStrings: ['^(?<version>.+)$'],
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: 'bar',
          },
        ],
        updatedArtifacts: [],
      });
      scm.getFileList.mockResolvedValueOnce(['foo']);

      await bumpVersions(config);

      expect(config).toMatchObject({
        artifactErrors: [
          {
            stderr:
              "Failed to compile matchString for bumpVersions(bar): Unexpected token '{'",
          },
        ],
      });
    });

    it('should be noop if no files are matching', async () => {
      const compile = vi.spyOn(templates, 'compile');
      compile.mockReturnValueOnce('foo');
      compile.mockReturnValueOnce('^(?<version>.+)$');
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            filePatterns: ['foo'],
            bumpType: 'minor',
            matchStrings: ['^(?<version>.+)$'],
          },
        ],
        artifactErrors: [],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: '1.0.0',
          },
        ],
        updatedArtifacts: [],
      });
      scm.getFileList.mockResolvedValueOnce(['bar']);

      await bumpVersions(config);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'bumpVersions: filePatterns did not match any files',
      );

      expect(config).toMatchObject({
        artifactErrors: [],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: '1.0.0',
          },
        ],
        updatedArtifacts: [],
      });
    });

    it('should log debug if no matchString could be applied', async () => {
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            name: 'ipsum',
            filePatterns: ['\\.release-version'],
            matchStrings: ['^(?<version>\\d+)$'],
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: 'bar',
          },
        ],
      });
      scm.getFileList.mockResolvedValueOnce(['foo', '.release-version']);
      fs.readLocalFile.mockResolvedValueOnce('1.0.0');
      await bumpVersions(config);

      expect(logger.logger.trace).toHaveBeenCalledWith(
        { files: ['.release-version'] },
        'bumpVersions(ipsum): Found 1 files to bump versions',
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { file: '.release-version' },
        'bumpVersions(ipsum): No match found for bumping version',
      );

      expect(config).toMatchObject({
        updatedArtifacts: [],
      });
    });

    it('should catch template error in bumpType', async () => {
      const compile = vi.spyOn(templates, 'compile');
      compile.mockReturnValueOnce('foo');
      compile.mockReturnValueOnce('^(?<version>.+)$');
      compile.mockImplementationOnce(() => {
        throw new Error("Unexpected token '{'");
      });
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            filePatterns: ['foo'],
            bumpType: 'minor',
            matchStrings: ['^(?<version>.+)$'],
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: '1.0.0',
          },
        ],
        updatedArtifacts: [],
      });
      scm.getFileList.mockResolvedValueOnce(['foo']);

      await bumpVersions(config);

      expect(config).toMatchObject({
        artifactErrors: [
          {
            stderr:
              "Failed to calculate new version for bumpVersions: Unexpected token '{'",
          },
        ],
      });
    });

    it('should bump version in a non edited file and add to updatedArtifacts', async () => {
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            filePatterns: ['\\.release-version'],
            bumpType: 'minor',
            matchStrings: ['^(?<version>.+)$'],
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: 'bar',
          },
        ],
      });
      scm.getFileList.mockResolvedValueOnce(['foo', '.release-version']);
      fs.readLocalFile.mockResolvedValueOnce('1.0.0');
      await bumpVersions(config);

      expect(config).toMatchObject({
        updatedArtifacts: [
          {
            type: 'addition',
            path: '.release-version',
            contents: '1.1.0',
          },
        ],
      });
    });

    it('should bump version with patch by default', async () => {
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            filePatterns: ['\\.release-version'],
            matchStrings: ['^(?<version>.+)$'],
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: 'bar',
          },
        ],
      });
      scm.getFileList.mockResolvedValueOnce(['foo', '.release-version']);
      fs.readLocalFile.mockResolvedValueOnce('1.0.0');
      await bumpVersions(config);

      expect(config).toMatchObject({
        updatedArtifacts: [
          {
            type: 'addition',
            path: '.release-version',
            contents: '1.0.1',
          },
        ],
      });
    });

    it('should bump version in an already changed packageFiles', async () => {
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            filePatterns: ['foo'],
            bumpType: 'minor',
            matchStrings: ['\\s*version:\\s+(?<version>[^\\s]+)'],
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.0.0
              dependencies: {}
            `,
          },
        ],
      });
      scm.getFileList.mockResolvedValueOnce(['foo']);
      await bumpVersions(config);

      expect(config).toMatchObject({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.0.0
              dependencies: {}
            `,
          },
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.1.0
              dependencies: {}
            `,
          },
        ],
      });
    });

    it('should bump version in an already changed artifact file', async () => {
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            filePatterns: ['foo'],
            bumpType: 'minor',
            matchStrings: ['\\s*version:\\s+(?<version>[^\\s]+)'],
          },
        ],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.0.0
              dependencies: {}
            `,
          },
        ],
      });
      scm.getFileList.mockResolvedValueOnce(['foo']);
      await bumpVersions(config);

      expect(config).toMatchObject({
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.0.0
              dependencies: {}
            `,
          },
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.1.0
              dependencies: {}
            `,
          },
        ],
      });
    });

    it('should bump version in deleted and recreated file changed artifact file', async () => {
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            filePatterns: ['foo'],
            bumpType: 'minor',
            matchStrings: ['\\s*version:\\s+(?<version>[^\\s]+)'],
          },
        ],
        updatedArtifacts: [
          {
            type: 'deletion',
            path: 'foo',
          },
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.0.0
              dependencies: {}
            `,
          },
        ],
      });
      scm.getFileList.mockResolvedValueOnce(['foo']);
      await bumpVersions(config);

      expect(config).toMatchObject({
        updatedArtifacts: [
          {
            type: 'deletion',
            path: 'foo',
          },
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.0.0
              dependencies: {}
            `,
          },
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.1.0
              dependencies: {}
            `,
          },
        ],
      });
    });

    it('should ignore deleted file', async () => {
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            filePatterns: ['foo'],
            bumpType: 'minor',
            matchStrings: ['\\s*version:\\s+(?<version>[^\\s]+)'],
          },
        ],
        updatedArtifacts: [
          {
            type: 'deletion',
            path: 'foo',
          },
        ],
      });
      scm.getFileList.mockResolvedValueOnce(['foo']);
      await bumpVersions(config);

      expect(config).toMatchObject({
        updatedArtifacts: [
          {
            type: 'deletion',
            path: 'foo',
          },
        ],
      });
    });

    it('should log if file is not readable', async () => {
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            name: 'foo',
            filePatterns: ['foo-bar'],
            bumpType: 'minor',
            matchStrings: ['\\s*version:\\s+(?<version>[^\\s]+)'],
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.0.0
              dependencies: {}
            `,
          },
        ],
      });
      fs.readLocalFile.mockRejectedValue(new Error('an error'));
      scm.getFileList.mockResolvedValueOnce(['foo-bar']);

      await bumpVersions(config);

      expect(logger.logger.warn).toHaveBeenCalledWith(
        { file: 'foo-bar' },
        'bumpVersions(foo): Could not read file: an error',
      );
      expect(config).toMatchObject({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.0.0
              dependencies: {}
            `,
          },
        ],
      });
    });

    it('should ignore not matched strings', async () => {
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            filePatterns: ['foo'],
            bumpType: 'minor',
            matchStrings: [
              'version=\\s*(?<version>[^\\s]+)', // not matching with the version group
              '\\s*version:\\s+(?<foo>[^\\s]+)', // match without the version group
              '\\s*version:\\s+(?<version>[^\\s]+)',
            ],
          },
        ],
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.0.0
              dependencies: {}
            `,
          },
        ],
      });
      scm.getFileList.mockResolvedValueOnce(['foo']);

      await bumpVersions(config);

      expect(config).toMatchObject({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.0.0
              dependencies: {}
            `,
          },
          {
            type: 'addition',
            path: 'foo',
            contents: codeBlock`
              version: 1.1.0
              dependencies: {}
            `,
          },
        ],
      });
    });
  });
});
