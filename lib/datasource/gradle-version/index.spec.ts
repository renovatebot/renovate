import fs from 'fs';
import { GetPkgReleasesConfig, GetReleasesConfig, getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName, partial } from '../../../test/util';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { id as versioning } from '../../versioning/gradle';
import { id as datasource, getReleases } from '.';

const allResponse: any = fs.readFileSync(
  'lib/datasource/gradle-version/__fixtures__/all.json'
);

let config: GetPkgReleasesConfig;

describe(getName(__filename), () => {
  describe('getReleases', () => {
    beforeEach(() => {
      config = {
        datasource,
        versioning,
        depName: 'abc',
      };
      jest.clearAllMocks();
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    it('processes real data', async () => {
      httpMock
        .scope('https://services.gradle.org/')
        .get('/versions/all')
        .reply(200, JSON.parse(allResponse));
      const res = await getPkgReleases(config);
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res.releases).toHaveLength(300);
      expect(
        res.releases.filter(({ isDeprecated }) => isDeprecated)
      ).toHaveLength(1);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('calls configured registryUrls', async () => {
      httpMock
        .scope('https://foo.bar')
        .get('/')
        .reply(200, JSON.parse(allResponse));

      httpMock
        .scope('http://baz.qux')
        .get('/')
        .reply(200, [
          { version: '1.0.1' },
          { version: '1.0.2', buildTime: 'abc' },
        ]);

      const res = await getPkgReleases({
        ...config,
        registryUrls: ['https://foo.bar', 'http://baz.qux'],
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('handles empty releases', async () => {
      httpMock
        .scope('https://services.gradle.org/')
        .get('/versions/all')
        .reply(200, []);

      const res = await getPkgReleases(config);
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('handles errors', async () => {
      expect.assertions(3);
      httpMock
        .scope('https://services.gradle.org/')
        .get('/versions/all')
        .reply(404);

      httpMock.scope('http://baz.qux').get('/').reply(404);

      await expect(
        getReleases(
          partial<GetReleasesConfig>({
            registryUrl: 'https://services.gradle.org/versions/all',
          })
        )
      ).rejects.toThrow(ExternalHostError);

      await expect(
        getReleases(
          partial<GetReleasesConfig>({
            registryUrl: 'http://baz.qux',
          })
        )
      ).rejects.toThrow('Response code 404 (Not Found)');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
