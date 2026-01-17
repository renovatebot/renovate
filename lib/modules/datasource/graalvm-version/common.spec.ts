import { parsePackage } from './common';
import { logger } from '~test/util';

describe('modules/datasource/graalvm-version/common', () => {
  const archMock = vi.spyOn(process, 'arch', 'get');
  const osMock = vi.spyOn(process, 'platform', 'get');

  describe('parsePackage', () => {
    it('parses JDK package name', () => {
      expect(parsePackage('oracle-graalvm-jdk')).toEqual({
        vendor: 'oracle-graalvm',
        imageType: 'jdk',
        os: null,
        architecture: null,
        releaseType: 'ga',
      });
    });

    it('parses JRE package name', () => {
      expect(parsePackage('oracle-graalvm-jre')).toEqual({
        vendor: 'oracle-graalvm',
        imageType: 'jre',
        os: null,
        architecture: null,
        releaseType: 'ga',
      });
    });

    it('uses explicit os and architecture', () => {
      expect(
        parsePackage('oracle-graalvm-jdk?os=macosx&architecture=aarch64'),
      ).toEqual({
        vendor: 'oracle-graalvm',
        imageType: 'jdk',
        os: 'macosx',
        architecture: 'aarch64',
        releaseType: 'ga',
      });
    });

    it('uses explicit release type', () => {
      expect(parsePackage('oracle-graalvm-jdk?releaseType=ea')).toEqual({
        vendor: 'oracle-graalvm',
        imageType: 'jdk',
        os: null,
        architecture: null,
        releaseType: 'ea',
      });
    });

    describe('system detection', () => {
      const input = 'oracle-graalvm-jdk?system=true';

      it.each`
        arch       | os          | expected
        ${'ia32'}  | ${'win32'}  | ${{ vendor: 'oracle-graalvm', imageType: 'jdk', os: 'windows', architecture: 'i686', releaseType: 'ga' }}
        ${'x64'}   | ${'linux'}  | ${{ vendor: 'oracle-graalvm', imageType: 'jdk', os: 'linux', architecture: 'x86_64', releaseType: 'ga' }}
        ${'arm64'} | ${'darwin'} | ${{ vendor: 'oracle-graalvm', imageType: 'jdk', os: 'macosx', architecture: 'aarch64', releaseType: 'ga' }}
        ${'arm'}   | ${'linux'}  | ${{ vendor: 'oracle-graalvm', imageType: 'jdk', os: 'linux', architecture: 'arm32', releaseType: 'ga' }}
      `('($arch, $os) => $expected', ({ arch, os, expected }) => {
        archMock.mockReturnValue(arch);
        osMock.mockReturnValue(os);
        expect(parsePackage(input)).toEqual(expected);
      });

      it('logs warning for unsupported architecture', () => {
        archMock.mockReturnValue('unsupported' as any);
        osMock.mockReturnValue('linux');
        const result = parsePackage(input);
        expect(result.architecture).toBeNull();
        expect(logger.logger.warn).toHaveBeenCalledWith(
          { arch: 'unsupported' },
          expect.stringContaining('Unknown system architecture'),
        );
      });

      it('logs warning for unsupported OS', () => {
        archMock.mockReturnValue('x64');
        osMock.mockReturnValue('unsupported' as any);
        const result = parsePackage(input);
        expect(result.os).toBeNull();
        expect(logger.logger.warn).toHaveBeenCalledWith(
          { os: 'unsupported' },
          expect.stringContaining('Unknown system OS'),
        );
      });
    });
  });
});
