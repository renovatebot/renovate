import fs from 'fs';
import { getPkgReleases } from '..';
import * as httpMock from '../../../test/httpMock';
import { getName } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { id as versioning } from '../../versioning/loose';
import { RepologyPackage, id as datasource } from '.';

const repologyApiHost = 'https://repology.org/';

type ResponseMock = { status: number; body?: string };

const mockProjectBy = (
  repo: string,
  name: string,
  binary: ResponseMock,
  source: ResponseMock
) => {
  const endpoint = '/tools/project-by';
  const defaultParams = {
    target_page: 'api_v1_project',
    noautoresolve: 'on',
  };

  if (binary) {
    httpMock
      .scope(repologyApiHost)
      .get(endpoint)
      .query({ ...defaultParams, repo, name, name_type: 'binname' })
      .reply(binary.status, binary.body);
  }

  if (source) {
    httpMock
      .scope(repologyApiHost)
      .get(endpoint)
      .query({ ...defaultParams, repo, name, name_type: 'srcname' })
      .reply(source.status, source.body);
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

describe(getName(__filename), () => {
  describe('getReleases', () => {
    beforeEach(() => {
      httpMock.setup();
    });

    afterEach(() => httpMock.reset());

    it('returns null for empty result', async () => {
      mockProjectBy(
        'debian_stable',
        'nginx',
        { status: 200, body: '[]' },
        { status: 200, body: '[]' }
      );

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
      mockProjectBy(
        'this_should',
        'never-exist',
        { status: 404 },
        { status: 404 }
      );

      expect(
        await getPkgReleases({
          datasource,
          versioning,
          depName: 'this_should/never-exist',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for unsupported repository', async () => {
      mockProjectBy(
        'unsupported_repo',
        'nginx',
        { status: 403 },
        { status: 403 }
      );

      expect(
        await getPkgReleases({
          datasource,
          versioning,
          depName: 'unsupported_repo/nginx',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws error on unexpected response during binary package lookup', async () => {
      mockProjectBy('debian_stable', 'nginx', { status: 500 }, null);

      await expect(
        getPkgReleases({
          datasource,
          versioning,
          depName: 'debian_stable/nginx',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws error on unexpected response during source package lookup', async () => {
      mockProjectBy('debian_stable', 'nginx', { status: 404 }, { status: 500 });

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
      mockProjectBy(
        'debian_stable',
        'nginx',
        { status: 200, body: fixtureNginx },
        null
      );

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
      mockProjectBy(
        'debian_stable',
        'gcc-defaults',
        { status: 404 },
        { status: 200, body: fixtureGccDefaults }
      );

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
      mockProjectBy(
        'alpine_3_12',
        'gcc',
        { status: 200, body: fixtureGcc },
        null
      );

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
      mockProjectBy(
        'debian_stable',
        'pulseaudio-utils',
        { status: 200, body: fixturePulseaudio },
        null
      );

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

    it('returns null for ambiguous package results', async () => {
      const pkgs: RepologyPackage[] = [
        { repo: 'dummy', version: '1.0.0', visiblename: 'example' },
        { repo: 'dummy', version: '2.0.0', visiblename: 'example' },
      ];
      const pkgsJSON = JSON.stringify(pkgs);

      mockProjectBy(
        'dummy',
        'example',
        { status: 200, body: pkgsJSON },
        { status: 200, body: pkgsJSON }
      );

      expect(
        await getPkgReleases({
          datasource,
          versioning,
          depName: 'dummy/example',
        })
      ).toBeNull();
    });
  });
});
