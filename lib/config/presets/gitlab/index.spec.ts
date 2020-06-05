import * as httpMock from '../../../../test/httpMock';
import { getName } from '../../../../test/util';
import * as gitlab from '.';

const gitlabApiHost = 'https://gitlab.com';
const basePath = '/api/v4/projects/some%2Frepo/repository';

describe(getName(__filename), () => {
  beforeEach(() => {
    jest.resetAllMocks();
    httpMock.setup();
  });

  afterEach(() => {
    httpMock.reset();
  });

  describe('getPreset()', () => {
    it('throws if no content', async () => {
      httpMock.scope(gitlabApiHost).get(`${basePath}/branches`).reply(500, {});
      await expect(
        gitlab.getPreset({
          packageName: 'some/repo',
          presetName: 'default',
        })
      ).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws if not default', async () => {
      await expect(
        gitlab.getPreset({
          packageName: 'some/repo',
          presetName: 'non-default',
        })
      ).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws if fails to parse', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(`${basePath}/branches`)
        .reply(200, [])
        .get(`${basePath}/files/renovate.json?ref=master`)
        .reply(200, { content: Buffer.from('not json').toString('base64') });

      await expect(
        gitlab.getPreset({ packageName: 'some/repo' })
      ).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should return the preset', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(`${basePath}/branches`)
        .reply(200, [
          {
            name: 'devel',
          },
          {
            name: 'master',
            default: true,
          },
        ])
        .get(`${basePath}/files/renovate.json?ref=master`)
        .reply(
          200,
          {
            content: Buffer.from('{"foo":"bar"}').toString('base64'),
          },
          {}
        );

      const content = await gitlab.getPreset({ packageName: 'some/repo' });
      expect(content).toEqual({ foo: 'bar' });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses default endpoint', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(`${basePath}/branches`)
        .reply(200, [
          {
            name: 'devel',
            default: true,
          },
        ])
        .get(`${basePath}/files/renovate.json?ref=devel`)
        .reply(200, { content: Buffer.from('{}').toString('base64') });
      expect(
        await gitlab.getPresetFromEndpoint('some/repo', 'default')
      ).toEqual({});
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('uses custom endpoint', async () => {
      httpMock
        .scope('https://gitlab.example.org')
        .get(`${basePath}/branches`)
        .reply(200, [
          {
            name: 'devel',
            default: true,
          },
        ])
        .get(`${basePath}/files/renovate.json?ref=devel`)
        .reply(404);
      await expect(
        gitlab.getPresetFromEndpoint(
          'some/repo',
          'default',
          'https://gitlab.example.org/api/v4'
        )
      ).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
