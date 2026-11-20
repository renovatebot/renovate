import { parseCoordinate } from './coordinate.ts';

describe('modules/manager/kotlin-toolchain/coordinate', () => {
  describe('parseCoordinate()', () => {
    it('parses a coordinate with a version', () => {
      expect(parseCoordinate('io.ktor:ktor-client-core:2.2.0')).toEqual({
        depName: 'io.ktor:ktor-client-core',
        currentValue: '2.2.0',
      });
    });

    it('ignores surrounding whitespace', () => {
      expect(parseCoordinate('  io.ktor:ktor-client-core:2.2.0  ')).toEqual({
        depName: 'io.ktor:ktor-client-core',
        currentValue: '2.2.0',
      });
    });

    it('drops the classifier', () => {
      expect(parseCoordinate('org.example:lib:1.0:sources')).toEqual({
        depName: 'org.example:lib',
        currentValue: '1.0',
      });
    });

    it('drops the packaging', () => {
      expect(parseCoordinate('org.example:lib:1.0@aar')).toEqual({
        depName: 'org.example:lib',
        currentValue: '1.0',
      });
    });

    it('drops the bom prefix', () => {
      expect(parseCoordinate('bom:io.ktor:ktor-bom:2.2.0')).toEqual({
        depName: 'io.ktor:ktor-bom',
        currentValue: '2.2.0',
      });
    });

    it.each`
      value
      ${'$ktor.server.core'}
      ${'$libs.foo'}
      ${'$compose.bar'}
    `('marks $value as a catalog reference', ({ value }: { value: string }) => {
      expect(parseCoordinate(value)).toEqual({
        depName: value,
        skipReason: 'contains-variable',
      });
    });

    it.each`
      value                                       | depName
      ${'io.ktor:ktor-client-core:$ktor.version'} | ${'io.ktor:ktor-client-core'}
      ${'org.example:lib:$v'}                     | ${'org.example:lib'}
    `(
      'marks the version of $value as a catalog reference',
      ({ value, depName }: { value: string; depName: string }) => {
        expect(parseCoordinate(value)).toEqual({
          depName,
          skipReason: 'contains-variable',
        });
      },
    );

    it.each`
      value
      ${'//ui/utils'}
      ${'./mod'}
      ${'../mod'}
    `('marks $value as a local module', ({ value }: { value: string }) => {
      expect(parseCoordinate(value)).toEqual({
        depName: value,
        skipReason: 'local-dependency',
      });
    });

    it.each`
      value                                                   | depName
      ${'com.fasterxml.jackson.module:jackson-module-kotlin'} | ${'com.fasterxml.jackson.module:jackson-module-kotlin'}
      ${'com.h2database:h2@jar'}                              | ${'com.h2database:h2'}
      ${'org.example:lib:'}                                   | ${'org.example:lib'}
    `(
      'marks $value as missing a version',
      ({ value, depName }: { value: string; depName: string }) => {
        expect(parseCoordinate(value)).toEqual({
          depName,
          skipReason: 'unspecified-version',
        });
      },
    );

    it.each`
      value
      ${''}
      ${'   '}
      ${'just a string'}
      ${'https://example.com'}
      ${'bad group:lib:1.0'}
      ${'org.example:bad artifact:1.0'}
      ${'org.example:lib:1.0:sources:extra'}
      ${'bom:io.ktor:ktor-bom:2.2.0:sources:extra'}
    `('returns null for $value', ({ value }: { value: string }) => {
      expect(parseCoordinate(value)).toBeNull();
    });
  });
});
