import * as httpMock from '../../../test/httpMock';
import { clear } from '../../util/cache/run';
import * as _hostRules from '../../util/host-rules';
import * as github from '.';

jest.mock('../../util/host-rules');
const hostRules: any = _hostRules;

const githubApiHost = 'https://api.github.com';

describe('datasource/github-releases', () => {
  beforeEach(async () => {
    await global.renovateCache.rmAll();
    hostRules.hosts = jest.fn(() => []);
    hostRules.find.mockReturnValue({
      token: 'some-token',
    });
    httpMock.setup();
  });

  afterEach(() => {
    httpMock.reset();
    clear();
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
        ]);

      const res = await github.getReleases({
        lookupName: 'some/dep',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(4);
      expect(
        res.releases.find((release) => release.version === 'v1.1.0')
      ).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
