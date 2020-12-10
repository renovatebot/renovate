import * as httpMock from '../../../test/httpMock';
import * as _githubReleases from '../../datasource/github-releases';

import { UpdateArtifact } from '../common';
import { updateArtifacts } from './artifacts';

const newVersion = '1.2.3';
const newUnixWrapperContent = `Unix wrapper script for ${newVersion}`;
const newWindowsWrapperContent = `Windows wrapper script for ${newVersion}`;

jest.mock('../../datasource/github-releases');
const githubReleases: any = _githubReleases;

function artifactForPath(path: string): UpdateArtifact {
  return {
    packageFileName: path,
    updatedDeps: ['batect/batect'],
    newPackageFileContent: 'not used',
    config: {
      toVersion: newVersion,
    },
  };
}

describe('lib/manager/batect-wrapper/artifacts', () => {
  beforeEach(() => {
    githubReleases.getReleases.mockResolvedValue({
      releases: [
        {
          version: '1.1.0',
          files: [
            {
              name: 'batect',
              url: 'https://shouldnotbeused.com',
            },
            {
              name: 'batect.cmd',
              url: 'https://shouldnotbeused.com',
            },
          ],
        },
        {
          version: '1.2.3',
          files: [
            {
              name: 'batect',
              url:
                'https://gitstorage.com/batect/batect/releases/download/1.2.3/batect',
            },
            {
              name: 'batect.cmd',
              url:
                'https://gitstorage.com/batect/batect/releases/download/1.2.3/batect.cmd',
            },
            {
              name: 'batect.jar',
              url:
                'https://gitstorage.com/batect/batect/releases/download/1.2.3/batect.jar',
            },
          ],
        },
      ],
    });

    httpMock.setup();

    httpMock
      .scope('https://gitstorage.com')
      .get('/batect/batect/releases/download/1.2.3/batect')
      .reply(200, newUnixWrapperContent);

    httpMock
      .scope('https://gitstorage.com')
      .get('/batect/batect/releases/download/1.2.3/batect.cmd')
      .reply(200, newWindowsWrapperContent);
  });

  afterEach(() => {
    httpMock.reset();
  });

  describe('updateArtifacts', () => {
    it('returns updated files if the wrapper script is in the root directory', async () => {
      const artifact = artifactForPath('batect');
      const result = await updateArtifacts(artifact);

      expect(result).toEqual([
        {
          file: {
            name: 'batect',
            contents: newUnixWrapperContent,
          },
        },
        {
          file: {
            name: 'batect.cmd',
            contents: newWindowsWrapperContent,
          },
        },
      ]);
    });

    it('returns updated files if the wrapper script is in a subdirectory', async () => {
      const artifact = artifactForPath('some/sub/dir/batect');
      const result = await updateArtifacts(artifact);

      expect(result).toEqual([
        {
          file: {
            name: 'some/sub/dir/batect',
            contents: newUnixWrapperContent,
          },
        },
        {
          file: {
            name: 'some/sub/dir/batect.cmd',
            contents: newWindowsWrapperContent,
          },
        },
      ]);
    });
  });
});
