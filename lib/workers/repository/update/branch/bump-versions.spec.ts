import { codeBlock } from 'common-tags';
import { fs, logger, partial, scm } from '../../../../../test/util';
import * as templates from '../../../../util/template';
import type { BranchConfig } from '../../../types';
import { bumpVersions } from './bump-versions';

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
            fileMatch: ['\\.release-version'],
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

    it('should catch template error in fileMatch', async () => {
      vi.spyOn(templates, 'compile').mockImplementationOnce(() => {
        throw new Error("Unexpected token '{'");
      });
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            fileMatch: ['\\^'],
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
            fileMatch: ['foo'],
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
              "Failed to compile matchString for bumpVersions: Unexpected token '{'",
          },
        ],
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
            fileMatch: ['foo'],
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
            fileMatch: ['\\.release-version'],
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

    it('should bump version in an already changed packageFiles', async () => {
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            fileMatch: ['foo'],
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
            fileMatch: ['foo'],
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
            version: 1.1.0
            dependencies: {}
            `,
          },
        ],
      });
    });

    it('should log if file is not readable', async () => {
      const config = partial<BranchConfig>({
        bumpVersions: [
          {
            fileMatch: ['foo'],
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
      scm.getFileList.mockResolvedValueOnce(['foo-bar']);

      await bumpVersions(config);

      expect(logger.logger.trace).toHaveBeenCalledWith(
        { file: 'foo-bar' },
        'bumpVersions: Could not read file',
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
            fileMatch: ['foo'],
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
            version: 1.1.0
            dependencies: {}
            `,
          },
        ],
      });
    });
  });
});
