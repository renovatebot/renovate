import { ExternalHostError } from '../../../types/errors/external-host-error';
import { PRESET_DEP_NOT_FOUND, PRESET_INVALID_JSON } from '../util';
import * as http from '.';
import { hostRules } from '~test/host-rules';
import * as httpMock from '~test/http-mock';

const host = 'https://my.server/';
const filePath = '/test-preset.json';
const repo = 'https://my.server/test-preset.json';

describe('config/presets/http/index', () => {
  describe('getPreset()', () => {
    it('should return parsed JSON', async () => {
      httpMock.scope(host).get(filePath).reply(200, { foo: 'bar' });

      expect(await http.getPreset({ repo })).toEqual({ foo: 'bar' });
    });

    it('should return parsed JSON5', async () => {
      httpMock
        .scope('https://my.server/')
        .get('/test-preset.json5')
        .reply(200, '{ foo: "bar" } // comment');

      const repo = 'https://my.server/test-preset.json5';

      expect(await http.getPreset({ repo })).toEqual({ foo: 'bar' });
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
