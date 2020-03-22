import * as gitlab from '.';
import { api } from '../../platform/gitlab/gl-got-wrapper';

jest.mock('../../platform/gitlab/gl-got-wrapper');
jest.mock('../../util/got');

const glGot: any = api.get;

describe('datasource/gitlab-tags', () => {
  beforeEach(() => {
    global.repoCache = {};
    return global.renovateCache.rmAll();
  });
  describe('getPkgReleases', () => {
    beforeAll(() => global.renovateCache.rmAll());
    it('returns tags', async () => {
      const body = [
        {
          name: 'v1.0.0',
          commit: {
            created_at: '2020-03-04T12:01:37.000-06:00',
          },
        },
        {
          name: 'v1.1.0',
          commit: {},
        },
        {
          name: 'v1.1.1',
        },
      ];
      glGot.mockReturnValueOnce({ headers: {}, body });
      const res = await gitlab.getPkgReleases({
        registryUrls: ['https://gitlab.company.com/api/v4/'],
        lookupName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(3);
    });

    it('returns tags with default registry', async () => {
      const body = [{ name: 'v1.0.0' }, { name: 'v1.1.0' }];
      glGot.mockReturnValueOnce({ headers: {}, body });
      const res = await gitlab.getPkgReleases({
        lookupName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
    });
  });
});
