import fs from 'fs';
import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { id as versioning } from '../../versioning/loose';
import { RepologyPackage, id as datasource } from '.';

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
  response: ResponseMock
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

const fixtureNginx = fs.readFileSync(
  `${__dirname}/__fixtures__/nginx.json`,
  'utf8'
);
const fixtureGccDefaults = fs.readFileSync(
  `${__dirname}/__fixtures__/gcc-defaults.json`,
  'utf8'
);
const fixtureGcc = fs.readFileSync(
  `${__dirname}/__fixtures__/gcc.json`,
  'utf8'
);
const fixturePulseaudio = fs.readFileSync(
  `${__dirname}/__fixtures__/pulseaudio.json`,
  'utf8'
);
const fixtureJdk = fs.readFileSync(
  `${__dirname}/__fixtures__/openjdk.json`,
  'utf8'
);

describe(getName(__filename), () => {
  describe('getReleases', () => {
    beforeEach(() => {
      httpMock.setup();
    });

    afterEach(() => httpMock.reset());

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
          depName: 'debian_stable/nginx',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
          depName: 'this_should/never-exist',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
          depName: 'debian_stable/nginx',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws error on unexpected Resolver response with binary package', async () => {
      mockResolverCall('debian_stable', 'nginx', 'binname', {
        status: 500,
      });

      await expect(
        getPkgReleases({
          datasource,
          versioning,
          depName: 'debian_stable/nginx',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
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
          depName: 'debian_stable/nginx',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
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
          depName: 'debian_stable/nginx',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws error on Resolver request timeout', async () => {
      mockResolverCall('debian_stable', 'nginx', 'binname', {
        code: 'ETIMEDOUT',
      });

      await expect(
        getPkgReleases({
          datasource,
          versioning,
          depName: 'debian_stable/nginx',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws without repository and package name', async () => {
      await expect(
        getPkgReleases({
          datasource,
          versioning,
          depName: 'invalid-lookup-name',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns correct version for binary package', async () => {
      mockResolverCall('debian_stable', 'nginx', 'binname', {
        status: 200,
        body: fixtureNginx,
      });

      const res = await getPkgReleases({
        datasource,
        versioning,
        depName: 'debian_stable/nginx',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(1);
      expect(res.releases[0].version).toEqual('1.14.2-2+deb10u1');
      expect(httpMock.getTrace()).toMatchSnapshot();
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
        depName: 'debian_stable/gcc-defaults',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(1);
      expect(res.releases[0].version).toEqual('1.181');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns correct version for api package', async () => {
      mockResolverCall('debian_stable', 'gcc-defaults', 'binname', {
        status: 403,
      });
      mockApiCall('gcc-defaults', { status: 200, body: fixtureGccDefaults });

      const res = await getPkgReleases({
        datasource,
        versioning,
        depName: 'debian_stable/gcc-defaults',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(1);
      expect(res.releases[0].version).toEqual('1.181');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns correct version for multi-package project with same name', async () => {
      mockResolverCall('alpine_3_12', 'gcc', 'binname', {
        status: 200,
        body: fixtureGcc,
      });

      const res = await getPkgReleases({
        datasource,
        versioning,
        depName: 'alpine_3_12/gcc',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(1);
      expect(res.releases[0].version).toEqual('9.3.0-r2');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns correct version for multi-package project with different name', async () => {
      mockResolverCall('debian_stable', 'pulseaudio-utils', 'binname', {
        status: 200,
        body: fixturePulseaudio,
      });

      const res = await getPkgReleases({
        datasource,
        versioning,
        depName: 'debian_stable/pulseaudio-utils',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(1);
      expect(res.releases[0].version).toEqual('12.2-4+deb10u1');
      expect(httpMock.getTrace()).toMatchSnapshot();
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
        depName: 'centos_8/java-11-openjdk',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(6);
      expect(res.releases[0].version).toEqual('1:11.0.7.10-1.el8_1');
      expect(res.releases[5].version).toEqual('1:11.0.9.11-3.el8_3');
      expect(httpMock.getTrace()).toMatchSnapshot();
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
        depName: 'dummy/example',
      });

      expect(release).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
