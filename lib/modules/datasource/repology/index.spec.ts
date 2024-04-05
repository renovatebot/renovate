import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import * as hostRules from '../../../util/host-rules';
import { id as versioning } from '../../versioning/loose';
import type { RepologyPackage } from './types';
import { RepologyDatasource } from './index';

const datasource = RepologyDatasource.id;

const repologyHost = 'https://repology.org/';

type ResponseMock = { status?: number; body?: string; code?: string };

const mockApiCall = (name: string, response: ResponseMock) => {
  const interceptor = httpMock
    .scope(repologyHost)
    .get(`/api/v1/project/${name}`);
  if (response.status) {
    interceptor.reply(response.status, response.body);
  } else {
    interceptor.replyWithError({ code: response.code });
  }
};

const mockResolverCall = (
  repo: string,
  name: string,
  name_type: string,
  response: ResponseMock,
) => {
  const query = {
    repo,
    name_type,
    target_page: 'api_v1_project',
    noautoresolve: 'on',
    name,
  };

  const interceptor = httpMock
    .scope(repologyHost)
    .get('/tools/project-by')
    .query(query);
  if (response.status) {
    interceptor.reply(response.status, response.body);
  } else {
    interceptor.replyWithError({ code: response.code });
  }
};

const fixtureNginx = Fixtures.get(`nginx.json`);
const fixtureGccDefaults = Fixtures.get(`gcc-defaults.json`);
const fixtureGcc = Fixtures.get(`gcc.json`);
const fixturePulseaudio = Fixtures.get(`pulseaudio.json`);
const fixtureJdk = Fixtures.get(`openjdk.json`);
const fixturePython = Fixtures.get(`python.json`);

describe('modules/datasource/repology/index', () => {
  beforeEach(() => {
    hostRules.clear();
  });

  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      mockResolverCall('debian_stable', 'nginx', 'binname', {
        status: 200,
        body: '[]',
      });
      mockResolverCall('debian_stable', 'nginx', 'srcname', {
        status: 200,
        body: '[]',
      });

      expect(
        await getPkgReleases({
          datasource,
          versioning,
          packageName: 'debian_stable/nginx',
        }),
      ).toBeNull();
    });

    it('returns null for missing repository or package', async () => {
      mockResolverCall('this_should', 'never-exist', 'binname', {
        status: 404,
      });
      mockResolverCall('this_should', 'never-exist', 'srcname', {
        status: 404,
      });

      expect(
        await getPkgReleases({
          datasource,
          versioning,
          packageName: 'this_should/never-exist',
        }),
      ).toBeNull();
    });

    it('throws error on unexpected API response', async () => {
      mockResolverCall('debian_stable', 'nginx', 'binname', {
        status: 200,
        body: '[]',
      });
      mockResolverCall('debian_stable', 'nginx', 'srcname', {
        status: 403,
      });
      mockApiCall('nginx', { status: 500 });

      await expect(
        getPkgReleases({
          datasource,
          versioning,
          packageName: 'debian_stable/nginx',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws error on unexpected Resolver response with binary package', async () => {
      mockResolverCall('debian_stable', 'nginx', 'binname', {
        status: 500,
      });

      await expect(
        getPkgReleases({
          datasource,
          versioning,
          packageName: 'debian_stable/nginx',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws error on unexpected Resolver response with source package', async () => {
      mockResolverCall('debian_stable', 'nginx', 'binname', {
        status: 200,
        body: '[]',
      });
      mockResolverCall('debian_stable', 'nginx', 'srcname', {
        status: 500,
      });

      await expect(
        getPkgReleases({
          datasource,
          versioning,
          packageName: 'debian_stable/nginx',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws error on API request timeout', async () => {
      mockResolverCall('debian_stable', 'nginx', 'binname', {
        status: 200,
        body: '[]',
      });
      mockResolverCall('debian_stable', 'nginx', 'srcname', {
        status: 403,
      });
      mockApiCall('nginx', { code: 'ETIMEDOUT' });

      await expect(
        getPkgReleases({
          datasource,
          versioning,
          packageName: 'debian_stable/nginx',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws error on Resolver request timeout', async () => {
      mockResolverCall('debian_stable', 'nginx', 'binname', {
        code: 'ETIMEDOUT',
      });

      await expect(
        getPkgReleases({
          datasource,
          versioning,
          packageName: 'debian_stable/nginx',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null on Resolver ambiguous binary package', async () => {
      mockResolverCall('ubuntu_20_04', 'git', 'binname', {
        status: 300,
        body: '[]',
      });

      expect(
        await getPkgReleases({
          datasource,
          versioning,
          packageName: 'ubuntu_20_04/git',
        }),
      ).toBeNull();
    });

    it('throws without repository and package name', async () => {
      await expect(
        getPkgReleases({
          datasource,
          versioning,
          packageName: 'invalid-lookup-name',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws on disabled host', async () => {
      hostRules.add({ matchHost: repologyHost, enabled: false });
      expect(
        await getPkgReleases({
          datasource,
          versioning,
          packageName: 'debian_stable/nginx',
        }),
      ).toBeNull();
    });

    it('returns correct version for binary package', async () => {
      mockResolverCall('debian_stable', 'nginx', 'binname', {
        status: 200,
        body: fixtureNginx,
      });

      const res = await getPkgReleases({
        datasource,
        versioning,
        packageName: 'debian_stable/nginx',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(1);
      expect(res?.releases[0].version).toBe('1.14.2-2+deb10u1');
    });

    it('returns correct version for source package', async () => {
      mockResolverCall('debian_stable', 'gcc-defaults', 'binname', {
        status: 404,
      });
      mockResolverCall('debian_stable', 'gcc-defaults', 'srcname', {
        status: 200,
        body: fixtureGccDefaults,
      });

      const res = await getPkgReleases({
        datasource,
        versioning,
        packageName: 'debian_stable/gcc-defaults',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(1);
      expect(res?.releases[0].version).toBe('1.181');
    });

    it('returns correct version for api package', async () => {
      mockResolverCall('debian_stable', 'gcc-defaults', 'binname', {
        status: 403,
      });
      mockApiCall('gcc-defaults', { status: 200, body: fixtureGccDefaults });

      const res = await getPkgReleases({
        datasource,
        versioning,
        packageName: 'debian_stable/gcc-defaults',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(1);
      expect(res?.releases[0].version).toBe('1.181');
    });

    it('returns correct version for multi-package project with same name', async () => {
      mockResolverCall('alpine_3_12', 'gcc', 'binname', {
        status: 200,
        body: fixtureGcc,
      });

      const res = await getPkgReleases({
        datasource,
        versioning,
        packageName: 'alpine_3_12/gcc',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(1);
      expect(res?.releases[0].version).toBe('9.3.0-r2');
    });

    it('returns correct version for multi-package project with different name', async () => {
      mockResolverCall('debian_stable', 'pulseaudio-utils', 'binname', {
        status: 200,
        body: fixturePulseaudio,
      });

      const res = await getPkgReleases({
        datasource,
        versioning,
        packageName: 'debian_stable/pulseaudio-utils',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(1);
      expect(res?.releases[0].version).toBe('12.2-4+deb10u1');
    });

    it('returns multiple versions if they are present in repository', async () => {
      mockResolverCall('centos_8', 'java-11-openjdk', 'binname', {
        status: 404,
      });
      mockResolverCall('centos_8', 'java-11-openjdk', 'srcname', {
        status: 200,
        body: fixtureJdk,
      });

      const res = await getPkgReleases({
        datasource,
        versioning,
        packageName: 'centos_8/java-11-openjdk',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(6);
      expect(res?.releases[0].version).toBe('1:11.0.7.10-1.el8_1');
      expect(res?.releases[5].version).toBe('1:11.0.9.11-3.el8_3');
    });

    it('returns null for scenario when repo is not in package results', async () => {
      const pkgs: RepologyPackage[] = [
        { repo: 'not-dummy', version: '1.0.0', visiblename: 'example' },
        { repo: 'not-dummy', version: '2.0.0', visiblename: 'example' },
      ];
      const pkgsJSON = JSON.stringify(pkgs);

      mockResolverCall('dummy', 'example', 'binname', {
        status: 200,
        body: pkgsJSON,
      });

      mockResolverCall('dummy', 'example', 'srcname', {
        status: 200,
        body: pkgsJSON,
      });

      const release = await getPkgReleases({
        datasource,
        versioning,
        packageName: 'dummy/example',
      });

      expect(release).toBeNull();
    });

    it('returns correct package types for api_call', async () => {
      const pkgs: RepologyPackage[] = [
        {
          repo: 'some_repo',
          version: '1.0.0',
          visiblename: 'some-package',
          srcname: 'some-package',
        },
        {
          repo: 'some_repo',
          version: '2.0.0',
          visiblename: 'not-some-package',
          srcname: 'not-some-package',
        },
        {
          repo: 'some_repo',
          version: '3.0.0',
          visiblename: 'some-package',
          srcname: 'not-some-package',
        },
        {
          repo: 'some_repo',
          version: '4.0.0',
          visiblename: 'some-package',
          binname: 'some-package',
        },
        {
          repo: 'some_repo',
          version: '5.0.0',
          visiblename: 'not-some-package',
          binname: 'not-some-package',
        },
        {
          repo: 'some_repo',
          version: '6.0.0',
          visiblename: 'some-package',
          binname: 'not-some-package',
        },
        { repo: 'some_repo', version: '7.0.0', visiblename: 'some-package' },
        {
          repo: 'some_repo',
          version: '8.0.0',
          visiblename: 'not-some-package',
        },
        {
          repo: 'not_some_repo',
          version: '9.0.0',
          visiblename: 'some-package',
        },
        {
          repo: 'not_some_repo',
          version: '10.0.0',
          visiblename: 'some-package',
          srcname: 'some-package',
        },
        {
          repo: 'not_some_repo',
          version: '11.0.0',
          visiblename: 'some-package',
          binname: 'some-package',
        },
      ];
      const pkgsJSON = JSON.stringify(pkgs);

      mockResolverCall('some_repo', 'some-package', 'binname', {
        status: 403,
      });

      mockApiCall('some-package', {
        status: 200,
        body: pkgsJSON,
      });

      const res = await getPkgReleases({
        datasource,
        versioning,
        packageName: 'some_repo/some-package',
      });
      expect(res).toEqual({
        registryUrl: 'https://repology.org',
        releases: [
          { version: '1.0.0' },
          {
            version: '4.0.0',
          },
        ],
      });
    });

    it('returns correct package versions for multi-package project', async () => {
      mockResolverCall('ubuntu_20_04', 'python3.8', 'binname', {
        status: 200,
        body: fixturePython,
      });

      mockResolverCall('ubuntu_20_04', 'python3.8', 'srcname', {
        status: 200,
        body: fixturePython,
      });

      const res = await getPkgReleases({
        datasource,
        versioning,
        packageName: 'ubuntu_20_04/python3.8',
      });
      expect(res).toEqual({
        registryUrl: 'https://repology.org',
        releases: [
          { version: '3.8.2-1ubuntu1' },
          {
            version: '3.8.10-0ubuntu1~20.04.2',
          },
        ],
      });
    });
  });
});
