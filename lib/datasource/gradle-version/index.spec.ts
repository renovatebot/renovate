import fs from 'fs';
import _got from '../../util/got';
import * as datasource from '..';
import { DATASOURCE_GRADLE_VERSION } from '../../constants/data-binary-source';

jest.mock('../../util/got');

const got: any = _got;

const allResponse: any = fs.readFileSync(
  'lib/datasource/gradle-version/__fixtures__/all.json'
);

let config: datasource.PkgReleaseConfig = {};

describe('datasource/gradle-version', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      config = {
        datasource: DATASOURCE_GRADLE_VERSION,
      };
      jest.clearAllMocks();
      global.repoCache = {};
      return global.renovateCache.rmAll();
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
