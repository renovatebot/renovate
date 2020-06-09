import fs from 'fs';
import * as httpMock from '../../../test/httpMock';
import { getName } from '../../../test/util';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';
import * as ds from '.';

const repologyApiHost = 'https://repology.org/';

type mockResponse = { status: number; body?: string };

const mockProjectBy = (
  repo: string,
  name: string,
  binary: mockResponse,
  source: mockResponse
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
        await ds.getReleases({ lookupName: 'debian_stable/nginx' })
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
        await ds.getReleases({ lookupName: 'this_should/never-exist' })
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
        await ds.getReleases({ lookupName: 'unsupported_repo/nginx' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws error on unexpected response during binary package lookup', async () => {
      mockProjectBy('debian_stable', 'nginx', { status: 500 }, null);

      await expect(
        ds.getReleases({ lookupName: 'debian_stable/nginx' })
      ).rejects.toThrow(DATASOURCE_FAILURE);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws error on unexpected response during source package lookup', async () => {
      mockProjectBy('debian_stable', 'nginx', { status: 404 }, { status: 500 });

      await expect(
        ds.getReleases({ lookupName: 'debian_stable/nginx' })
      ).rejects.toThrow(DATASOURCE_FAILURE);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws without repository and package name', async () => {
      await expect(
        ds.getReleases({ lookupName: 'invalid-lookup-name' })
      ).rejects.toThrow(DATASOURCE_FAILURE);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns correct version for binary package', async () => {
      mockProjectBy(
        'debian_stable',
        'nginx',
        { status: 200, body: fixtureNginx },
        null
      );

      const res = await ds.getReleases({ lookupName: 'debian_stable/nginx' });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(1);
      expect(res.releases[0].version).toBeString();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns correct version for source package', async () => {
      mockProjectBy(
        'debian_stable',
        'gcc-defaults',
        { status: 404 },
        { status: 200, body: fixtureGccDefaults }
      );

      const res = await ds.getReleases({
        lookupName: 'debian_stable/gcc-defaults',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(1);
      expect(res.releases[0].version).toBeString();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
