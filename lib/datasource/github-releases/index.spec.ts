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
        { tag_name: 'a' },
        { tag_name: 'v' },
        { tag_name: '1.0.0' },
        { tag_name: 'v1.1.0' },
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
