import { codeBlock } from 'common-tags';
import { fs, logger, scm } from '../../../../../test/util';
import * as templates from '../../../../util/template';
import type { BranchConfig } from '../../../types';
import { bumpVersions } from './bump-versions';

jest.mock('../../../../util/fs');
jest.mock('../../../../modules/platform/scm');

describe('workers/repository/update/branch/bump-versions', () => {
  describe('bumpVersions', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    afterEach(() => {
      jest.spyOn(templates, 'compile').mockRestore();
    });

    it('should be noop if bumpVersions is undefined', async () => {
      const config = {} as BranchConfig;
      await bumpVersions(config);

      expect(config).toEqual({});
    });

    it('should be noop if bumpVersions is empty array', async () => {
      const config = {
        bumpVersions: [],
      } as unknown as BranchConfig;
      await bumpVersions(config);

      expect(config).toEqual({
        bumpVersions: [],
      });
    });

    it('should be noop if no packageFiles or artifacts have been updated', async () => {
      const config = {
        bumpVersions: [
          {
            fileMatch: ['\\.release-version'],
            bumpType: 'minor',
            matchStrings: ['^(?<version>.+)$'],
          },
        ],
        updatedPackageFiles: [],
        updatedArtifacts: [],
      } as unknown as BranchConfig;
      await bumpVersions(config);

      expect(config).toMatchObject({
        updatedPackageFiles: [],
        updatedArtifacts: [],
      });
    });

    it('should catch template error in fileMatch', async () => {
      jest.spyOn(templates, 'compile').mockImplementationOnce(() => {
        throw new Error("Unexpected token '{'");
      });
      const config = {
        bumpVersions: [
          {
            fileMatch: ['\\^'],
            bumpType: 'minor',
            matchStrings: ['^(?<version>.+)$'],
          },
        ],
        updatedPackageFiles: [
          {
            path: 'foo',
            contents: 'bar',
          },
        ],
        updatedArtifacts: [],
      } as unknown as BranchConfig;
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
      const compile = jest.spyOn(templates, 'compile');
      compile.mockReturnValueOnce('foo');
      compile.mockImplementationOnce(() => {
        throw new Error("Unexpected token '{'");
      });
      const config = {
        bumpVersions: [
          {
            fileMatch: ['foo'],
            bumpType: 'minor',
            matchStrings: ['^(?<version>.+)$'],
          },
        ],
        updatedPackageFiles: [
          {
            path: 'foo',
            contents: 'bar',
          },
        ],
        updatedArtifacts: [],
      } as unknown as BranchConfig;
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
      const compile = jest.spyOn(templates, 'compile');
      compile.mockReturnValueOnce('foo');
      compile.mockReturnValueOnce('^(?<version>.+)$');
      compile.mockImplementationOnce(() => {
        throw new Error("Unexpected token '{'");
      });
      const config = {
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
      } as unknown as BranchConfig;
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
      const config = {
        bumpVersions: [
          {
            fileMatch: ['\\.release-version'],
            bumpType: 'minor',
            matchStrings: ['^(?<version>.+)$'],
          },
        ],
        updatedPackageFiles: [
          {
            path: 'foo',
            contents: 'bar',
          },
        ],
      } as unknown as BranchConfig;
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
      const config = {
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
      } as unknown as BranchConfig;
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
      const config = {
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
      } as unknown as BranchConfig;
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
      const config = {
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
      } as unknown as BranchConfig;
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
      const config = {
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
      } as unknown as BranchConfig;
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
