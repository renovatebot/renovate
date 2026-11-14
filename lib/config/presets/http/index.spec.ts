import { hostRules } from '~test/host-rules.ts';
import * as httpMock from '~test/http-mock.ts';
import { HOST_BLOCKED } from '../../../constants/error-messages.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { GlobalConfig } from '../../global.ts';
import { PRESET_DEP_NOT_FOUND, PRESET_INVALID_JSON } from '../util.ts';
import * as http from './index.ts';

const host = 'https://my.server/';
const filePath = '/test-preset.json';
const repo = 'https://my.server/test-preset.json';

describe('config/presets/http/index', () => {
  describe('getPreset()', () => {
    it('should return parsed JSON', async () => {
      httpMock.scope(host).get(filePath).reply(200, { foo: 'bar' });

      await expect(http.getPreset({ repo })).resolves.toEqual({ foo: 'bar' });
    });

    it('should return parsed JSON5', async () => {
      httpMock
        .scope('https://my.server/')
        .get('/test-preset.json5')
        .reply(200, '{ foo: "bar" } // comment');

      const repo = 'https://my.server/test-preset.json5';

      await expect(http.getPreset({ repo })).resolves.toEqual({ foo: 'bar' });
    });

    it('should return parsed JSONC', async () => {
      httpMock
        .scope('https://my.server/')
        .get('/test-preset.jsonc')
        .reply(200, '{ "foo": "bar" } // comment');

      const repo = 'https://my.server/test-preset.jsonc';

      await expect(http.getPreset({ repo })).resolves.toEqual({ foo: 'bar' });
    });

    describe('internal hosts', () => {
      beforeEach(() => {
        GlobalConfig.set({ internalHostAccess: 'block' });
      });

      afterEach(() => {
        GlobalConfig.reset();
      });

      it('throws a distinct error for a blocked host', async () => {
        // no mocked response: the request is blocked before it is ever made
        await expect(
          http.getPreset({ repo: 'http://10.1.2.3/test-preset.json' }),
        ).rejects.toThrow(HOST_BLOCKED);
      });

      it('stays blocked when the admin only named the host', async () => {
        hostRules.add({ matchHost: '10.1.2.3' }, { trusted: true });

        await expect(
          http.getPreset({ repo: 'http://10.1.2.3/test-preset.json' }),
        ).rejects.toThrow(HOST_BLOCKED);
      });

      it('is fetched under a scoped grant', async () => {
        hostRules.add(
          { hostType: 'preset', matchHost: '10.1.2.3', allowInternal: true },
          { trusted: true },
        );
        httpMock
          .scope('http://10.1.2.3')
          .get('/test-preset.json')
          .reply(200, { foo: 'bar' });

        await expect(
          http.getPreset({ repo: 'http://10.1.2.3/test-preset.json' }),
        ).resolves.toEqual({ foo: 'bar' });
      });
    });

    it('throws if fails to parse', async () => {
      httpMock.scope(host).get(filePath).reply(200, 'not json');

      await expect(http.getPreset({ repo })).rejects.toThrow(
        PRESET_INVALID_JSON,
      );
    });

    it('throws if file not found', async () => {
      httpMock.scope(host).get(filePath).reply(404);

      await expect(http.getPreset({ repo })).rejects.toThrow(
        PRESET_DEP_NOT_FOUND,
      );
    });

    it('throws on malformed URL', async () => {
      await expect(http.getPreset({ repo: 'malformed!' })).rejects.toThrow(
        PRESET_DEP_NOT_FOUND,
      );
    });
    it('throws external host error', async () => {
      httpMock.scope(host).get(filePath).reply(404, {});

      hostRules.add({ abortOnError: true });

      await expect(http.getPreset({ repo })).rejects.toThrow(ExternalHostError);
    });
  });
});
