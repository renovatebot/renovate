import { extractPackageFile } from '../../../lib/manager/esy/extract';

describe('lib/manager/esy/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      const content = '';
      const fileName = '';
      expect(await extractPackageFile(content, fileName)).toBeNull();
    });
    it('parses a simple JSON object', async () => {
      const contentObject = {
        dependencies: {
          '@opam/dune': '*',
          '@reason-native/console': '*',
          '@reason-native/pastel': '*',
          '@reason-native/rely': '*',
          '@esy-ocaml/reason': '>= 3.4.0 < 3.5.0',
          refmterr: '*',
          ocaml: '~4.6.0',
        },
        devDependencies: {
          '@opam/merlin': '*',
          ocaml: '~4.6.0',
          '@opam/odoc': '*',
        },
      };
      const content = JSON.stringify(contentObject);
      const fileName = 'package.json';
      expect(await extractPackageFile(content, fileName)).not.toBeNull();
      expect(await extractPackageFile(content, fileName)).toMatchSnapshot();
    });
  });
});
