import { logger } from '~test/util.ts';
import { parsePackage } from './common.ts';
import type { PackageConfig } from './types.ts';

describe('modules/datasource/java-version/common', () => {
  const archMock = vi.spyOn(process, 'arch', 'get');
  const osMock = vi.spyOn(process, 'platform', 'get');

  describe('parsePackage', () => {
    describe('vendor detection', () => {
      it('detects oracle-graalvm vendor', () => {
        const config = parsePackage('oracle-graalvm-jdk');
        expect(config.vendor).toBe('oracle-graalvm');
      });

      it('detects oracle-graalvm vendor from JRE package', () => {
        const config = parsePackage('oracle-graalvm-jre');
        expect(config.vendor).toBe('oracle-graalvm');
      });

      it('defaults to adoptium for java', () => {
        const config = parsePackage('java');
        expect(config.vendor).toBe('adoptium');
      });

      it('defaults to adoptium for java-jdk', () => {
        const config = parsePackage('java-jdk');
        expect(config.vendor).toBe('adoptium');
      });

      it('defaults to adoptium for java-jre', () => {
        const config = parsePackage('java-jre');
        expect(config.vendor).toBe('adoptium');
      });

      it('defaults to adoptium for adoptium-jdk', () => {
        const config = parsePackage('adoptium-jdk');
        expect(config.vendor).toBe('adoptium');
      });

      it('defaults to adoptium for adoptium-jre', () => {
        const config = parsePackage('adoptium-jre');
        expect(config.vendor).toBe('adoptium');
      });
    });

    describe('image type detection', () => {
      it('detects jdk image type', () => {
        const config = parsePackage('adoptium-jdk');
        expect(config.imageType).toBe('jdk');
      });

      it('detects jre image type', () => {
        const config = parsePackage('adoptium-jre');
        expect(config.imageType).toBe('jre');
      });

      it('detects jre for java-jre', () => {
        const config = parsePackage('java-jre');
        expect(config.imageType).toBe('jre');
      });

      it('defaults to jdk for java', () => {
        const config = parsePackage('java');
        expect(config.imageType).toBe('jdk');
      });

      it('detects jdk for oracle-graalvm-jdk', () => {
        const config = parsePackage('oracle-graalvm-jdk');
        expect(config.imageType).toBe('jdk');
      });

      it('detects jre for oracle-graalvm-jre', () => {
        const config = parsePackage('oracle-graalvm-jre');
        expect(config.imageType).toBe('jre');
      });
    });

    it('no os and architecture', () => {
      expect(parsePackage('java-jre')).toEqual({
        vendor: 'adoptium',
        imageType: 'jre',
        os: null,
        architecture: null,
        releaseType: undefined,
      });
      expect(logger.logger.warn).not.toBeCalled();
    });

    describe('uses system jdk', () => {
      const input = 'java?system=true';

      it.each<[NodeJS.Architecture, NodeJS.Platform, PackageConfig]>([
        [
          'ia32',
          'win32',
          {
            vendor: 'adoptium',
            imageType: 'jdk',
            os: 'windows',
            architecture: 'x86',
            releaseType: undefined,
          },
        ],
        [
          'x64',
          'win32',
          {
            vendor: 'adoptium',
            imageType: 'jdk',
            os: 'windows',
            architecture: 'x64',
            releaseType: undefined,
          },
        ],
        [
          'arm64',
          'darwin',
          {
            vendor: 'adoptium',
            imageType: 'jdk',
            os: 'mac',
            architecture: 'aarch64',
            releaseType: undefined,
          },
        ],
        [
          'arm',
          'aix',
          {
            vendor: 'adoptium',
            imageType: 'jdk',
            os: 'aix',
            architecture: 'arm',
            releaseType: undefined,
          },
        ],
        [
          'riscv64',
          'linux',
          {
            vendor: 'adoptium',
            imageType: 'jdk',
            os: 'linux',
            architecture: 'riscv64',
            releaseType: undefined,
          },
        ],
      ])('system jdk -> (%s, %s, %s) => %o', (arch, os, expected) => {
        archMock.mockReturnValue(arch);
        osMock.mockReturnValue(os);
        expect(parsePackage(input)).toEqual(expected);
      });

      it('logs for unsupported os and architecture', () => {
        // @ts-expect-error - test unsupported
        archMock.mockReturnValue('unsupported');
        // @ts-expect-error - test unsupported
        osMock.mockReturnValue('unsupported');
        expect(parsePackage(input)).toEqual({
          vendor: 'adoptium',
          imageType: 'jdk',
          os: null,
          architecture: null,
          releaseType: undefined,
        });
        expect(logger.logger.warn).toBeCalledTimes(2);
      });
    });

    describe('system detection - GraalVM', () => {
      it('maps ia32 to i686 for graalvm', () => {
        archMock.mockReturnValue('ia32');
        osMock.mockReturnValue('linux');
        const config = parsePackage('oracle-graalvm-jdk?system=true');
        expect(config.architecture).toBe('i686');
        expect(config.os).toBe('linux');
      });

      it('maps arm64 to aarch64 for graalvm', () => {
        archMock.mockReturnValue('arm64');
        osMock.mockReturnValue('linux');
        const config = parsePackage('oracle-graalvm-jdk?system=true');
        expect(config.architecture).toBe('aarch64');
        expect(config.os).toBe('linux');
      });

      it('maps arm to arm32 for graalvm', () => {
        archMock.mockReturnValue('arm');
        osMock.mockReturnValue('linux');
        const config = parsePackage('oracle-graalvm-jdk?system=true');
        expect(config.architecture).toBe('arm32');
        expect(config.os).toBe('linux');
      });

      it('maps x64 to x86_64 for graalvm', () => {
        archMock.mockReturnValue('x64');
        osMock.mockReturnValue('linux');
        const config = parsePackage('oracle-graalvm-jdk?system=true');
        expect(config.architecture).toBe('x86_64');
        expect(config.os).toBe('linux');
      });

      it('maps darwin to macosx for graalvm', () => {
        archMock.mockReturnValue('x64');
        osMock.mockReturnValue('darwin');
        const config = parsePackage('oracle-graalvm-jdk?system=true');
        expect(config.architecture).toBe('x86_64');
        expect(config.os).toBe('macosx');
      });

      it('maps win32 to windows for graalvm', () => {
        archMock.mockReturnValue('x64');
        osMock.mockReturnValue('win32');
        const config = parsePackage('oracle-graalvm-jdk?system=true');
        expect(config.architecture).toBe('x86_64');
        expect(config.os).toBe('windows');
      });

      it('returns null for unsupported architecture for graalvm', () => {
        // @ts-expect-error - test unsupported
        archMock.mockReturnValue('unsupported');
        osMock.mockReturnValue('linux');
        const config = parsePackage('oracle-graalvm-jdk?system=true');
        expect(config.architecture).toBeNull();
      });

      it('returns null for unsupported os for graalvm', () => {
        archMock.mockReturnValue('x64');
        // @ts-expect-error - test unsupported
        osMock.mockReturnValue('unsupported');
        const config = parsePackage('oracle-graalvm-jdk?system=true');
        expect(config.os).toBeNull();
      });
    });

    describe('query parameters', () => {
      it('parses architecture from query params', () => {
        const config = parsePackage('adoptium-jdk?architecture=x64');
        expect(config.architecture).toBe('x64');
      });

      it('parses os from query params', () => {
        const config = parsePackage('adoptium-jdk?os=windows');
        expect(config.os).toBe('windows');
      });

      it('parses release-type from query params', () => {
        const config = parsePackage(
          'oracle-graalvm-jdk?release-type=ea&os=linux&architecture=x86_64',
        );
        expect(config.releaseType).toBe('ea');
      });

      it('defaults releaseType to undefined when not specified', () => {
        const config = parsePackage('oracle-graalvm-jdk?os=linux');
        expect(config.releaseType).toBeUndefined();
      });

      it('prefers explicit params over system detection', () => {
        archMock.mockReturnValue('arm64');
        osMock.mockReturnValue('darwin');
        const config = parsePackage(
          'adoptium-jdk?system=true&architecture=x86&os=linux',
        );
        expect(config.architecture).toBe('x86');
        expect(config.os).toBe('linux');
      });
    });
  });
});
