import * as datasource from '../../lib/datasource';
import * as gitlab from '../../lib/datasource/gitlab';
import { api } from '../../lib/platform/gitlab/gl-got-wrapper';

jest.mock('../../lib/platform/gitlab/gl-got-wrapper');
jest.mock('../../lib/util/got');

const glGot: any = api.get;

describe('datasource/gitlab', () => {
  beforeEach(() => {
    global.repoCache = {};
    return global.renovateCache.rmAll();
  });
  describe('getPreset()', () => {
    it('throws if non-default', async () => {
      await expect(
        gitlab.getPreset('some/repo', 'non-default')
      ).rejects.toThrow();
    });
    it('throws if no content', async () => {
      glGot.mockImplementationOnce(() => ({
        body: {},
      }));
      await expect(gitlab.getPreset('some/repo')).rejects.toThrow();
    });
    it('throws if fails to parse', async () => {
      glGot.mockImplementationOnce(() => ({
        body: {
          content: Buffer.from('not json').toString('base64'),
        },
      }));
      await expect(gitlab.getPreset('some/repo')).rejects.toThrow();
    });
    it('should return the preset', async () => {
      glGot.mockResolvedValueOnce({
        body: [
          {
            name: 'master',
            default: true,
          },
        ],
      });
      glGot.mockResolvedValueOnce({
        body: {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        },
      });
      const content = await gitlab.getPreset('some/repo');
      expect(content).toEqual({ foo: 'bar' });
    });
  });
  describe('getPkgReleases', () => {
    beforeAll(() => global.renovateCache.rmAll());
    it('returns releases', async () => {
      const body = [
        { tag_name: 'a' },
        { tag_name: 'v' },
        { tag_name: '1.0.0' },
        { tag_name: 'v1.1.0' },
      ];
      glGot.mockReturnValueOnce({ headers: {}, body });
      const res = await datasource.getPkgReleases({
        datasource: 'gitlab',
        depName: 'some/dep',
        lookupType: 'releases',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
      expect(
        res.releases.find(release => release.version === 'v1.1.0')
      ).toBeDefined();
    });
    it('returns tags', async () => {
      const body = [{ name: 'v1.0.0' }, { name: 'v1.1.0' }];
      glGot.mockReturnValueOnce({ headers: {}, body });
      const res = await datasource.getPkgReleases({
        registryUrls: ['https://gitlab.company.com/api/v4/'],
        datasource: 'gitlab',
        depName: 'some/dep2',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(2);
    });
  });
});
