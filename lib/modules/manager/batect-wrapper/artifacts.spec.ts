import * as httpMock from '../../../../test/http-mock';
import type { UpdateArtifact } from '../types';
import { updateArtifacts } from '.';

const defaultTo = '1.2.3';
const newUnixWrapperContent = `Unix wrapper script for ${defaultTo}`;
const newWindowsWrapperContent = `Windows wrapper script for ${defaultTo}`;

function artifactForPath(
  path: string,
  newVersion: string = defaultTo,
): UpdateArtifact {
  return {
    packageFileName: path,
    updatedDeps: [
      {
        depName: 'batect/batect',
      },
    ],
    newPackageFileContent: 'not used',
    config: {
      newVersion,
    },
  };
}

describe('modules/manager/batect-wrapper/artifacts', () => {
  beforeEach(() => {
    httpMock
      .scope('https://github.com')
      .get('/batect/batect/releases/download/1.2.3/batect')
      .reply(200, newUnixWrapperContent);

    httpMock
      .scope('https://github.com')
      .get('/batect/batect/releases/download/1.2.3/batect.cmd')
      .reply(200, newWindowsWrapperContent);

    httpMock
      .scope('https://github.com')
      .get('/batect/batect/releases/download/3.4.5/batect')
      .reply(404);

    httpMock
      .scope('https://github.com')
      .get('/batect/batect/releases/download/3.4.5/batect.cmd')
      .reply(418);
  });

  // TODO: fix mocks
  afterEach(() => httpMock.clear(false));

  describe('updateArtifacts', () => {
    it('returns updated files if the wrapper script is in the root directory', async () => {
      const artifact = artifactForPath('batect');
      const result = await updateArtifacts(artifact);

      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: 'batect',
            contents: newUnixWrapperContent,
          },
        },
        {
          file: {
            type: 'addition',
            path: 'batect.cmd',
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
            type: 'addition',
            path: 'some/sub/dir/batect',
            contents: newUnixWrapperContent,
          },
        },
        {
          file: {
            type: 'addition',
            path: 'some/sub/dir/batect.cmd',
            contents: newWindowsWrapperContent,
          },
        },
      ]);
    });

    it('returns an error if the updated wrapper script cannot be downloaded', async () => {
      const artifact = artifactForPath('batect', '3.4.5');
      const result = await updateArtifacts(artifact);

      expect(result).toEqual([
        {
          artifactError: {
            lockFile: 'batect',
            stderr:
              'HTTP GET https://github.com/batect/batect/releases/download/3.4.5/batect failed: HTTPError: Response code 404 (Not Found)',
          },
        },
        {
          artifactError: {
            lockFile: 'batect.cmd',
            stderr:
              "HTTP GET https://github.com/batect/batect/releases/download/3.4.5/batect.cmd failed: HTTPError: Response code 418 (I'm a Teapot)",
          },
        },
      ]);
    });
  });
});
