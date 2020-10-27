import { getPkgReleases } from '..';
import * as httpMock from '../../../test/httpMock';
import * as _hostRules from '../../util/host-rules';
import { id as datasource } from '.';

jest.mock('../../util/host-rules');
const hostRules: any = _hostRules;

const githubApiHost = 'https://api.github.com';

describe('datasource/github-releases', () => {
  beforeEach(() => {
    hostRules.hosts = jest.fn(() => []);
    hostRules.find.mockReturnValue({
      token: 'some-token',
    });
    httpMock.setup();
  });

  afterEach(() => {
    httpMock.reset();
  });

  describe('getReleases', () => {
    it('returns releases', async () => {
      httpMock
        .scope(githubApiHost)
        .get('/repos/some/dep/releases?per_page=100')
        .reply(200, [
          { tag_name: 'a', published_at: '2020-03-09T13:00:00Z' },
          { tag_name: 'v', published_at: '2020-03-09T12:00:00Z' },
          { tag_name: '1.0.0', published_at: '2020-03-09T11:00:00Z' },
          { tag_name: 'v1.1.0', published_at: '2020-03-09T10:00:00Z' },
          {
            tag_name: '2.0.0',
            published_at: '2020-04-09T10:00:00Z',
            prerelease: true,
          },
        ]);

      const res = await getPkgReleases({
        datasource,
        depName: 'some/dep',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(3);
      expect(
        res.releases.find((release) => release.version === 'v1.1.0')
      ).toBeDefined();
      expect(
        res.releases.find((release) => release.version === '2.0.0').isStable
      ).toBe(false);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
