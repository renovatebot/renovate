import { api } from '../../platform/github/gh-got-wrapper';

import * as github from '.';

jest.mock('../../platform/github/gh-got-wrapper');
jest.mock('../../util/got');
jest.mock('../../util/host-rules');

const ghGot: any = api.get;

describe('datasource/github-releases', () => {
  beforeEach(() => global.renovateCache.rmAll());
  describe('getPkgReleases', () => {
    beforeAll(() => global.renovateCache.rmAll());
    it('returns releases', async () => {
      const body = [
        { tag_name: 'a', published_at: '2020-03-09T13:00:00Z' },
        { tag_name: 'v', published_at: '2020-03-09T12:00:00Z' },
        { tag_name: '1.0.0', published_at: '2020-03-09T11:00:00Z' },
        { tag_name: 'v1.1.0', published_at: '2020-03-09T10:00:00Z' },
      ];
      ghGot.mockReturnValueOnce({ headers: {}, body });
      const res = await github.getPkgReleases({
        lookupName: 'some/dep',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(4);
      expect(
        res.releases.find(release => release.version === 'v1.1.0')
      ).toBeDefined();
    });
  });
});
