import type { FetchPresetConfig, Preset } from './types.ts';
import { PRESET_DEP_NOT_FOUND, PRESET_NOT_FOUND, fetchPreset } from './util.ts';

const config: FetchPresetConfig = {
  repo: 'some/repo',
  filePreset: 'default',
  endpoint: 'endpoint',
  fetch: undefined as never,
};

const fetch = vi.fn(() => Promise.resolve<Preset | null>({}));

describe('config/presets/util', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('works', async () => {
    fetch.mockResolvedValueOnce({ sub: { preset: { foo: true } } });
    expect(await fetchPreset({ ...config, fetch })).toEqual({
      sub: { preset: { foo: true } },
    });

    fetch.mockRejectedValueOnce(new Error(PRESET_DEP_NOT_FOUND));
    fetch.mockResolvedValueOnce({ sub: { preset: { foo: true } } });
    expect(await fetchPreset({ ...config, fetch })).toEqual({
      sub: { preset: { foo: true } },
    });

    fetch.mockResolvedValueOnce({ sub: { preset: { foo: true } } });
    expect(
      await fetchPreset({ ...config, filePreset: 'some/sub', fetch }),
    ).toEqual({ preset: { foo: true } });

    fetch.mockResolvedValueOnce({ sub: { preset: { foo: true } } });
    expect(
      await fetchPreset({ ...config, filePreset: 'some/sub/preset', fetch }),
    ).toEqual({ foo: true });
  });

  describe('handles different filenames', () => {
    it.each([
      ['default', 'default.json'],
      ['default.json', 'default.json'],
      ['renovate.json', 'renovate.json'],
      ['renovate.json5', 'renovate.json5'],
      ['renovate.jsonc', 'renovate.jsonc'],

      // the .json suffix is added if there is no `.json` or `.json5` suffix
      ['some-path', 'some-path.json'],
      ['some-path.', 'some-path..json'],
      ['some-path.js', 'some-path.js.json'],
    ])('when filename is %s, %s is fetched', async (input, expected) => {
      fetch.mockResolvedValueOnce({});

      await fetchPreset({ ...config, filePreset: input, fetch });

      expect(fetch).toHaveBeenCalledWith(
        config.repo,
        expected,
        'endpoint/',
        undefined,
      );
    });
  });

  it('fails', async () => {
    fetch.mockRejectedValueOnce(new Error('fails'));
    await expect(fetchPreset({ ...config, fetch })).rejects.toThrow('fails');
  });

  it('dep not found', async () => {
    fetch.mockResolvedValueOnce(null);
    await expect(fetchPreset({ ...config, fetch })).rejects.toThrow(
      PRESET_DEP_NOT_FOUND,
    );

    fetch.mockRejectedValueOnce(new Error(PRESET_DEP_NOT_FOUND));
    fetch.mockRejectedValueOnce(new Error(PRESET_DEP_NOT_FOUND));
    await expect(fetchPreset({ ...config, fetch })).rejects.toThrow(
      PRESET_DEP_NOT_FOUND,
    );
  });

  it('preset not found', async () => {
    fetch.mockResolvedValueOnce({});
    await expect(
      fetchPreset({ ...config, filePreset: 'some/sub/preset', fetch }),
    ).rejects.toThrow(PRESET_NOT_FOUND);

    fetch.mockResolvedValueOnce({ sub: {} });
    await expect(
      fetchPreset({ ...config, filePreset: 'some/sub/preset', fetch }),
    ).rejects.toThrow(PRESET_NOT_FOUND);
  });
});
