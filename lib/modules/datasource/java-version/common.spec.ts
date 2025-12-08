import { parsePackage } from './common';
import type { PackageConfig } from './types';
import { logger } from '~test/util';

describe('modules/datasource/java-version/common', () => {
  const archMock = vi.spyOn(process, 'arch', 'get');
  const osMock = vi.spyOn(process, 'platform', 'get');

  describe('parsePackage', () => {
    it('no os and architecture', () => {
      expect(parsePackage('java-jre')).toEqual({
        imageType: 'jre',
        os: null,
        architecture: null,
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
            imageType: 'jdk',
            os: 'windows',
            architecture: 'x86',
          },
        ],
        [
          'x64',
          'win32',
          {
            imageType: 'jdk',
            os: 'windows',
            architecture: 'x64',
          },
        ],
        [
          'arm64',
          'darwin',
          {
            imageType: 'jdk',
            os: 'mac',
            architecture: 'aarch64',
          },
        ],
        [
          'arm',
          'aix',
          {
            imageType: 'jdk',
            os: 'aix',
            architecture: 'arm',
          },
        ],
        [
          'riscv64',
          'linux',
          {
            imageType: 'jdk',
            os: 'linux',
            architecture: 'riscv64',
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
          imageType: 'jdk',
          os: null,
          architecture: null,
        });
        expect(logger.logger.warn).toBeCalledTimes(2);
      });
    });
  });
});
