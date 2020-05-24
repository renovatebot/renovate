import * as httpMock from '../../../../test/httpMock';
import * as globalCache from '../../../util/cache/global';
import * as gitlab from '.';

const gitlabApiHost = 'https://gitlab.com';

describe('config/presets/gitlab', () => {
  beforeEach(() => {
    httpMock.reset();
    httpMock.setup();
  });
  describe('getPreset()', () => {
    it('throws if non-default', async () => {
      await expect(
        gitlab.getPreset({
          packageName: 'some/repo',
          presetName: 'non-default',
        })
      ).rejects.toThrow();
    });
    it('throws if no content', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo/repository/branches')
        .reply(200, {});
      await expect(
        gitlab.getPreset({ packageName: 'some/repo' })
      ).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws if fails to parse', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo/repository/branches')
        .reply(200, {
          content: Buffer.from('not json').toString('base64'),
        });
      await expect(
        gitlab.getPreset({ packageName: 'some/repo' })
      ).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should return the preset', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get('/api/v4/projects/some%2Frepo/repository/branches')
        .reply(200, [
          {
            name: 'devel',
          },
          {
            name: 'master',
            default: true,
          },
        ])
        .get(
          '/api/v4/projects/some%2Frepo/repository/files/renovate.json?ref=master'
        )
        .reply(200, {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        });
      const content = await gitlab.getPreset({ packageName: 'some/repo' });
      expect(content).toEqual({ foo: 'bar' });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
  describe('getPresetFromEndpoint()', () => {
    it('uses custom endpoint', async () => {
      httpMock
        .scope('https://gitlab.example.org')
        .get('/api/v4/projects/some%2Frepo/repository/branches')
        .reply(200, [])
        .get(
          '/api/v4/projects/some%2Frepo/repository/files/renovate.json?ref=master'
        )
        .reply(200, '');
      await gitlab
        .getPresetFromEndpoint(
          'some/repo',
          'default',
          'https://gitlab.example.org/api/v4'
        )
        .catch((_) => {});
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
