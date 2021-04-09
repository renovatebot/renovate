import { getName } from '../../../test/util';
import type { Preset } from './types';
import {
  FetchPresetConfig,
  PRESET_DEP_NOT_FOUND,
  PRESET_NOT_FOUND,
  fetchPreset,
} from './util';

const config: FetchPresetConfig = {
  pkgName: 'some/repo',
  filePreset: 'default',
  endpoint: 'endpoint',
  fetch: undefined,
};

const fetch = jest.fn(() => Promise.resolve<Preset>({}));

describe(getName(__filename), () => {
  beforeEach(() => {
    fetch.mockReset();
  });
  it('works', async () => {
    fetch.mockResolvedValue({ sub: { preset: { foo: true } } });
    expect(await fetchPreset({ ...config, fetch })).toEqual({
      sub: { preset: { foo: true } },
    });

    expect(
      await fetchPreset({ ...config, filePreset: 'some/sub', fetch })
    ).toEqual({ preset: { foo: true } });

    expect(
      await fetchPreset({ ...config, filePreset: 'some/sub/preset', fetch })
    ).toEqual({ foo: true });
  });

  it('fails', async () => {
    fetch.mockRejectedValueOnce(new Error('fails'));
    await expect(fetchPreset({ ...config, fetch })).rejects.toThrow('fails');
  });

  it(PRESET_DEP_NOT_FOUND, async () => {
    fetch.mockResolvedValueOnce(null);
    await expect(fetchPreset({ ...config, fetch })).rejects.toThrow(
      PRESET_DEP_NOT_FOUND
    );

    fetch.mockRejectedValueOnce(new Error(PRESET_DEP_NOT_FOUND));
    fetch.mockRejectedValueOnce(new Error(PRESET_DEP_NOT_FOUND));
    await expect(fetchPreset({ ...config, fetch })).rejects.toThrow(
      PRESET_DEP_NOT_FOUND
    );
  });

  it(PRESET_NOT_FOUND, async () => {
    fetch.mockResolvedValueOnce({});
    await expect(
      fetchPreset({ ...config, filePreset: 'some/sub/preset', fetch })
    ).rejects.toThrow(PRESET_NOT_FOUND);

    fetch.mockResolvedValueOnce({ sub: {} });
    await expect(
      fetchPreset({ ...config, filePreset: 'some/sub/preset', fetch })
    ).rejects.toThrow(PRESET_NOT_FOUND);
  });
});
