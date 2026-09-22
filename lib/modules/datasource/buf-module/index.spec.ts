import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { BufModuleDatasource } from './index.ts';

const datasource = new BufModuleDatasource();
const baseUrl = 'https://buf.build';
const listPath =
  '/buf.alpha.registry.v1alpha1.RepositoryCommitService/ListRepositoryCommitsByReference';
const getPath =
  '/buf.alpha.registry.v1alpha1.RepositoryCommitService/GetRepositoryCommitByReference';

describe('modules/datasource/buf-module/index', () => {
  describe('getReleases', () => {
    it('returns null for malformed packageName', async () => {
      await expect(
        getPkgReleases({
          datasource: BufModuleDatasource.id,
          packageName: 'no-slash',
        }),
      ).resolves.toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock
        .scope(baseUrl)
        .post(listPath)
        .reply(404, Fixtures.get('not-found.json'));
      await expect(
        getPkgReleases({
          datasource: BufModuleDatasource.id,
          packageName: 'googleapis/nope',
        }),
      ).resolves.toBeNull();
    });

    it('returns null when there are no commits', async () => {
      httpMock
        .scope(baseUrl)
        .post(listPath)
        .reply(200, { repositoryCommits: [] });
      await expect(
        getPkgReleases({
          datasource: BufModuleDatasource.id,
          packageName: 'googleapis/empty',
        }),
      ).resolves.toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).post(listPath).reply(502);
      await expect(
        getPkgReleases({
          datasource: BufModuleDatasource.id,
          packageName: 'googleapis/googleapis',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    // Called on the datasource directly: BSR commits are opaque hashes, not
    // sortable versions, so `getPkgReleases` (which filters by the versioning
    // scheme) drops them. The commit history is carried for its `newDigest` /
    // `releaseTimestamp` metadata; the actual bump signal comes from getDigest.
    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .post(
          listPath,
          (body) =>
            body.repositoryOwner === 'googleapis' &&
            body.repositoryName === 'googleapis',
        )
        .reply(200, Fixtures.get('commits.json'));
      const res = await datasource.getReleases({
        packageName: 'googleapis/googleapis',
        registryUrl: 'https://buf.build',
      });
      expect(res).toEqual({
        homepage: 'https://buf.build/googleapis/googleapis',
        releases: [
          {
            version: '9a877cf260e1488d869a31fce3bea26d',
            releaseTimestamp: '2024-06-01T12:00:00.000Z',
            newDigest:
              'b5:4af5b88c9a1d9b36f7d3e2a1c0b9e8d7c6a5b4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6958473625140f3e2d1c0b9a8f7e6d5c4b3a2f1',
          },
          {
            version: '62f35d8aed1149c291d606d958a7ce32',
            releaseTimestamp: '2024-05-01T12:00:00.000Z',
            newDigest:
              'b5:1a2b3c4d5e6f70819283a4b5c6d7e8f9012a3b4c5d6e7f8091a2b3c4d5e6f70819283a4b5c6d7e8f9012a3b4c5d6e7f8091a2b3c4d5e6f708',
          },
        ],
      });
    });

    it('uses custom registryUrl', async () => {
      httpMock
        .scope('https://bsr.example.com')
        .post(listPath)
        .reply(200, Fixtures.get('commits.json'));
      const res = await getPkgReleases({
        datasource: BufModuleDatasource.id,
        packageName: 'googleapis/googleapis',
        registryUrls: ['https://bsr.example.com'],
      });
      expect(res?.homepage).toBe(
        'https://bsr.example.com/googleapis/googleapis',
      );
    });
  });

  describe('getDigest', () => {
    it('resolves the default reference to its commit', async () => {
      httpMock
        .scope(baseUrl)
        .post(
          getPath,
          (body) =>
            body.repositoryOwner === 'googleapis' &&
            body.repositoryName === 'googleapis' &&
            body.reference === undefined,
        )
        .reply(200, Fixtures.get('commit.json'));
      const res = await datasource.getDigest({
        packageName: 'googleapis/googleapis',
      });
      expect(res).toBe('9a877cf260e1488d869a31fce3bea26d');
    });

    it('resolves an explicit reference to its commit', async () => {
      httpMock
        .scope('https://bsr.example.com')
        .post(getPath, (body) => body.reference === 'main')
        .reply(200, Fixtures.get('commit.json'));
      const res = await datasource.getDigest(
        {
          packageName: 'googleapis/googleapis',
          registryUrl: 'https://bsr.example.com',
        },
        'main',
      );
      expect(res).toBe('9a877cf260e1488d869a31fce3bea26d');
    });

    it('returns null for a malformed packageName', async () => {
      const res = await datasource.getDigest({ packageName: 'no-slash' });
      expect(res).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).post(getPath).reply(502);
      await expect(
        datasource.getDigest({ packageName: 'googleapis/googleapis' }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });
  });
});
