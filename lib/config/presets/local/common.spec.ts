import { platform } from '~test/util.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { PRESET_DEP_NOT_FOUND } from '../util.ts';
import { fetchJSONFile, getPresetFromEndpoint } from './common.ts';

describe('config/presets/local/common', () => {
  describe('fetchJSONFile', () => {
    it('throws for null', async () => {
      platform.getRawFile.mockResolvedValueOnce(null);

      await expect(fetchJSONFile('some/repo', 'default.json')).rejects.toThrow(
        PRESET_DEP_NOT_FOUND,
      );
    });

    it('throws for ExternalHostError', async () => {
      platform.getRawFile.mockRejectedValueOnce(
        new ExternalHostError(new Error()),
      );

      await expect(fetchJSONFile('some/repo', 'default.json')).rejects.toThrow(
        ExternalHostError,
      );
    });

    it('throws for Error', async () => {
      platform.getRawFile.mockRejectedValueOnce(new Error());

      await expect(fetchJSONFile('some/repo', 'default.json')).rejects.toThrow(
        PRESET_DEP_NOT_FOUND,
      );
    });
  });

  describe('getPresetFromEndpoint', () => {
    it('works', async () => {
      platform.getRawFile.mockResolvedValueOnce('{}');
      expect(
        await getPresetFromEndpoint(
          'some/repo',
          'default.json',
          undefined,
          'dummy',
        ),
      ).toEqual({});
    });
  });
});
