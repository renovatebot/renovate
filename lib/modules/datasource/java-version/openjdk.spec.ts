import { partial } from '~test/util.ts';
import type { Http } from '../../../util/http/index.ts';
import { getOpenjdkMetadataUrl, getOpenjdkReleases } from './openjdk.ts';
import type { PackageConfig } from './types.ts';

const baseConfig: PackageConfig = {
  vendor: 'openjdk',
  imageType: 'jdk',
  architecture: 'x86_64',
  os: 'linux',
};

describe('modules/datasource/java-version/openjdk', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOpenjdkMetadataUrl', () => {
    it('uses mise platform names and release type', () => {
      expect(
        getOpenjdkMetadataUrl({
          ...baseConfig,
          architecture: 'x64',
          os: 'mac',
          releaseType: 'ea',
        }),
      ).toBe('https://mise-java.jdx.dev/jvm/ea/macosx/x86_64.json');
    });

    it('uses the running system when OS and architecture are unspecified', () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      vi.spyOn(process, 'arch', 'get').mockReturnValue('x64');
      expect(
        getOpenjdkMetadataUrl({ ...baseConfig, architecture: null, os: null }),
      ).toBe('https://mise-java.jdx.dev/jvm/ga/linux/x86_64.json');
    });

    it('maps Windows and 32-bit system architecture', () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
      vi.spyOn(process, 'arch', 'get').mockReturnValue('ia32');
      expect(
        getOpenjdkMetadataUrl({ ...baseConfig, architecture: null, os: null }),
      ).toBe('https://mise-java.jdx.dev/jvm/ga/windows/i686.json');
    });

    it('maps macOS and ARM64 system architecture', () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
      vi.spyOn(process, 'arch', 'get').mockReturnValue('arm64');
      expect(
        getOpenjdkMetadataUrl({ ...baseConfig, architecture: null, os: null }),
      ).toBe('https://mise-java.jdx.dev/jvm/ga/macosx/aarch64.json');
    });

    it('maps ARM system architecture', () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      vi.spyOn(process, 'arch', 'get').mockReturnValue('arm');
      expect(
        getOpenjdkMetadataUrl({ ...baseConfig, architecture: null, os: null }),
      ).toBe('https://mise-java.jdx.dev/jvm/ga/linux/arm32.json');
    });

    it('maps explicit 32-bit architecture', () => {
      expect(
        getOpenjdkMetadataUrl({ ...baseConfig, architecture: 'x86' }),
      ).toBe('https://mise-java.jdx.dev/jvm/ga/linux/i686.json');
    });

    it('returns null when the system platform is unsupported', () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('aix');
      vi.spyOn(process, 'arch', 'get').mockReturnValue('riscv64');
      expect(
        getOpenjdkMetadataUrl({ ...baseConfig, architecture: null, os: null }),
      ).toBeNull();
    });
  });

  it('re-throws unexpected errors', async () => {
    const mockHttp = partial<Http>({
      getJson: vi.fn().mockRejectedValue(new Error('unexpected')),
    });
    await expect(getOpenjdkReleases(mockHttp, baseConfig)).rejects.toThrow(
      'unexpected',
    );
  });

  it('returns null when no JVM metadata platform is available', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('aix');
    vi.spyOn(process, 'arch', 'get').mockReturnValue('riscv64');
    const mockHttp = partial<Http>({ getJson: vi.fn() });
    await expect(
      getOpenjdkReleases(mockHttp, {
        ...baseConfig,
        architecture: null,
        os: null,
      }),
    ).resolves.toBeNull();
    expect(mockHttp.getJson).not.toHaveBeenCalled();
  });
});
