import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

describe('modules/manager/velaci/extract', () => {
  describe('extractPackageFile()', () => {
    it('should handle invalid YAML', () => {
      const res = extractPackageFile('foo: bar: invalid');
      expect(res).toBeNull();
    });

    it('should handle YAML without pipeline/images', () => {
      const res = extractPackageFile('no: pipeline');
      expect(res).toBeNull();
    });

    it('extracts multiple step pipeline image lines', () => {
      const res = extractPackageFile(Fixtures?.get('.vela-steps.yml'));
      expect(res?.deps).toMatchObject([
        {
          currentValue: '1.13',
          depName: 'golang',
        },
        {
          currentValue: '10.0.0',
          depName: 'node',
        },
      ]);
    });

    it('extracts multiple services pipeline image lines', () => {
      const res = extractPackageFile(Fixtures?.get('.vela-services.yml'));
      expect(res?.deps).toMatchObject([
        {
          currentValue: '10.0.0',
          depName: 'node',
        },
        {
          currentValue: '5.7.24',
          depName: 'mysql',
        },
        {
          currentValue: 'alpine',
          depName: 'redis',
        },
      ]);
    });

    it('extracts multiple stages pipeline image lines', () => {
      const res = extractPackageFile(Fixtures?.get('.vela-stages.yaml'));
      expect(res?.deps).toMatchObject([
        {
          currentValue: '1.13',
          depName: 'golang',
        },
        {
          currentValue: '10.0.0',
          depName: 'node',
        },
      ]);
    });

    it('extracts multiple secrets pipeline image lines', () => {
      const res = extractPackageFile(Fixtures?.get('.vela-secrets.yml'));
      expect(res?.deps).toMatchObject([
        {
          currentValue: '10.0.0',
          depName: 'node',
        },
        {
          currentValue: 'v0.1.0',
          depName: 'target/secret-vault',
        },
      ]);
    });
  });
});
