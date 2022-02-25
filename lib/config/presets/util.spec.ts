import { mockFn } from 'jest-mock-extended';
import type { FetchPresetConfig } from './types';
import { PRESET_DEP_NOT_FOUND, PRESET_NOT_FOUND, fetchPreset } from './util';

const fetch = mockFn();

const config: FetchPresetConfig = {
  pkgName: 'some/repo',
  filePreset: 'default',
  endpoint: 'endpoint',
  fetch,
};

describe('config/presets/util', () => {
  beforeEach(() => {
    fetch.mockReset();
  });
  it('works', async () => {
    fetch.mockResolvedValue({ sub: { preset: { foo: true } } });
    expect(await fetchPreset({ ...config })).toEqual({
      sub: { preset: { foo: true } },
    });

    expect(await fetchPreset({ ...config, filePreset: 'some/sub' })).toEqual({
      preset: { foo: true },
    });

    expect(
      await fetchPreset({ ...config, filePreset: 'some/sub/preset' })
    ).toEqual({ foo: true });
  });

  it('fails', async () => {
    fetch.mockRejectedValueOnce(new Error('fails'));
    await expect(fetchPreset({ ...config })).rejects.toThrow('fails');
  });

  it(PRESET_DEP_NOT_FOUND, async () => {
    fetch.mockResolvedValueOnce(null as never);
    await expect(fetchPreset({ ...config })).rejects.toThrow(
      PRESET_DEP_NOT_FOUND
    );

    fetch.mockRejectedValueOnce(new Error(PRESET_DEP_NOT_FOUND));
    fetch.mockRejectedValueOnce(new Error(PRESET_DEP_NOT_FOUND));
    await expect(fetchPreset({ ...config })).rejects.toThrow(
      PRESET_DEP_NOT_FOUND
    );
  });

  it(PRESET_NOT_FOUND, async () => {
    fetch.mockResolvedValueOnce({});
    await expect(
      fetchPreset({ ...config, filePreset: 'some/sub/preset' })
    ).rejects.toThrow(PRESET_NOT_FOUND);

    fetch.mockResolvedValueOnce({ sub: {} });
    await expect(
      fetchPreset({ ...config, filePreset: 'some/sub/preset' })
    ).rejects.toThrow(PRESET_NOT_FOUND);
  });
});
