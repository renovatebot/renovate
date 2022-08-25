import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

describe('modules/manager/tekton/index', () => {
  describe('extractPackageFile()', () => {
    it('extracts deps from a file', () => {
      expect(
        extractPackageFile(Fixtures.get('multi-doc.yaml'), 'test-file.yaml')
      ).toMatchSnapshot();
    });

    it('ignores file without any deps', () => {
      expect(extractPackageFile('foo: bar', 'test-file.yaml')).toBeNull();
    });

    it('ignores invalid YAML', () => {
      expect(
        extractPackageFile(
          `
        ---
        bundle: registry.com/repo
      `,
          'test-file.yaml'
        )
      ).toBeNull();
    });
    it('ignores empty file', () => {
      expect(extractPackageFile('', 'test-file.yaml')).toBeNull();
    });
  });
});
