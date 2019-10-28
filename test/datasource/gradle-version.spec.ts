import fs from 'fs';
import _got from '../../lib/util/got';
import * as datasource from '../../lib/datasource';

jest.mock('../../lib/util/got');

const got: any = _got;

const allResponse: any = fs.readFileSync(
  'test/datasource/gradle-wrapper/_fixtures/all.json'
);

let config: datasource.PkgReleaseConfig = {};

describe('datasource/gradle', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      config = {
        datasource: 'gradleVersion',
      };
      jest.clearAllMocks();
      global.repoCache = {};
      return global.renovateCache.rmAll();
    });

    it('throws for empty result', async () => {
      got.mockReturnValueOnce({ body: {} });
      await expect(
        datasource.getPkgReleases({
          ...config,
        })
      ).rejects.toThrow();
    });

    it('throws for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      await expect(
        datasource.getPkgReleases({
          ...config,
        })
      ).rejects.toThrow();
    });

    it('throws for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      await expect(
        datasource.getPkgReleases({
          ...config,
        })
      ).rejects.toThrow();
    });

    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(allResponse),
      });
      const res = await datasource.getPkgReleases(config);
      expect(got).toHaveBeenCalledTimes(1);
      expect(got.mock.calls[0][0]).toEqual(
        'https://services.gradle.org/versions/all'
      );
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });

    it('calls configured registryUrls', async () => {
      got.mockReturnValue({
        body: JSON.parse(allResponse),
      });
      const res = await datasource.getPkgReleases({
        ...config,
        registryUrls: ['https://foo.bar', 'http://baz.qux'],
      });
      expect(got).toHaveBeenCalledTimes(2);
      expect(got.mock.calls[0][0]).toEqual('https://foo.bar');
      expect(got.mock.calls[1][0]).toEqual('http://baz.qux');
      // This will have every release duplicated, because we used the same
      // mocked data for both responses.
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });
  });
});
