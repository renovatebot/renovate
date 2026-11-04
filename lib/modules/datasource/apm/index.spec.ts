import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod/v4';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { ApmDatasource } from './index.ts';

const registryUrl =
  'https://artifactory.example.com/artifactory/api/agentpackages/apm-local';
const basePath = '/artifactory/api/agentpackages/apm-local';

describe('modules/datasource/apm/index', () => {
  describe('getReleases', () => {
    it('returns the published versions', async () => {
      httpMock
        .scope('https://artifactory.example.com')
        .get(`${basePath}/v1/packages/acme/web-skills/versions`)
        .reply(200, {
          package: 'acme/web-skills',
          versions: [
            {
              version: '1.2.0',
              digest: 'sha256:abc',
              published_at: '2026-03-01T12:00:00Z',
              size_bytes: 24576,
            },
            {
              version: '1.1.0',
              digest: 'sha256:def',
              published_at: 'not-a-date',
            },
            { version: '1.0.0', digest: 'sha256:ghi' },
            { digest: 'sha256:missing-version' },
          ],
        });

      const res = await getPkgReleases({
        datasource: ApmDatasource.id,
        packageName: 'acme/web-skills',
        registryUrls: [registryUrl],
      });

      expect(res).toEqual({
        registryUrl,
        releases: [
          { version: '1.0.0' },
          { version: '1.1.0' },
          {
            version: '1.2.0',
            releaseTimestamp: '2026-03-01T12:00:00.000Z',
          },
        ],
      });
    });

    it('percent-encodes a non-GitHub identity into the owner segment', async () => {
      httpMock
        .scope('https://artifactory.example.com')
        .get(`${basePath}/v1/packages/gitlab.com%2Facme/web-skills/versions`)
        .reply(200, { package: 'x', versions: [{ version: '2.0.0' }] });

      const res = await getPkgReleases({
        datasource: ApmDatasource.id,
        packageName: 'gitlab.com/acme/web-skills',
        registryUrls: [registryUrl],
      });

      expect(res).toMatchObject({ releases: [{ version: '2.0.0' }] });
    });

    it('returns null for a package without versions', async () => {
      httpMock
        .scope('https://artifactory.example.com')
        .get(`${basePath}/v1/packages/acme/empty/versions`)
        .reply(200, { package: 'acme/empty', versions: [] });

      const res = await getPkgReleases({
        datasource: ApmDatasource.id,
        packageName: 'acme/empty',
        registryUrls: [registryUrl],
      });

      expect(res).toBeNull();
    });

    it('returns null for an unknown package', async () => {
      httpMock
        .scope('https://artifactory.example.com')
        .get(`${basePath}/v1/packages/acme/missing/versions`)
        .reply(404, { title: 'Package not found', status: 404 });

      const res = await getPkgReleases({
        datasource: ApmDatasource.id,
        packageName: 'acme/missing',
        registryUrls: [registryUrl],
      });

      expect(res).toBeNull();
    });

    it('throws for a registry error', async () => {
      httpMock
        .scope('https://artifactory.example.com')
        .get(`${basePath}/v1/packages/acme/web-skills/versions`)
        .reply(502);

      await expect(
        getPkgReleases({
          datasource: ApmDatasource.id,
          packageName: 'acme/web-skills',
          registryUrls: [registryUrl],
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('rejects a malformed response', async () => {
      httpMock
        .scope('https://artifactory.example.com')
        .get(`${basePath}/v1/packages/acme/web-skills/versions`)
        .reply(200, { package: 'acme/web-skills' });

      await expect(
        new ApmDatasource().getReleases({
          packageName: 'acme/web-skills',
          registryUrl,
        }),
      ).rejects.toThrow(ZodError);
    });

    it('returns null for a package name without owner', async () => {
      const res = await getPkgReleases({
        datasource: ApmDatasource.id,
        packageName: 'web-skills',
        registryUrls: [registryUrl],
      });

      expect(res).toBeNull();
    });

    it('returns null without a registryUrl', async () => {
      const res = await new ApmDatasource().getReleases({
        packageName: 'acme/web-skills',
      });

      expect(res).toBeNull();
    });
  });
});
