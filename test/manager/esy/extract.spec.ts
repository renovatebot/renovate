import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/esy/extract';

const package1json = readFileSync(
  'test/manager/esy/_fixtures/package.1.json',
  'utf8'
);
const package2json = readFileSync(
  'test/manager/esy/_fixtures/package.2.json',
  'utf8'
);

describe('lib/manager/esy/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      const content = '';
      const fileName = '';
      expect(await extractPackageFile(content, fileName)).toBeNull();
    });
    it('parses a simple JSON object', async () => {
      const content = package1json;
      const fileName = 'package.json';
      expect(await extractPackageFile(content, fileName)).not.toBeNull();
      expect(await extractPackageFile(content, fileName)).toMatchSnapshot();
    });
    it('parses a simple JSON object', async () => {
      const content = package2json;
      const fileName = 'package.json';
      expect(await extractPackageFile(content, fileName)).not.toBeNull();
      expect(await extractPackageFile(content, fileName)).toMatchSnapshot();
    });
    it('returns null if there are no dependencies', async () => {
      const content = `{
  "name": "hello-reason",
  "version": "0.1.0",
  "description": "Example Reason Esy Project",
  "license": "MIT" }`;
      const fileName = 'package.json';
      const res = await extractPackageFile(content, fileName);
      expect(res).toBeNull();
    });
    it('fails if there are invalid depNames', async () => {
      const content = `{
  "name": "hello-reason",
  "version": "0.1.0",
  "description": "Example Reason Esy Project",
  "license": "MIT",
  "dependencies": {
    "@opam/foo/bar": "1.2.3"
  }
}`;
      const fileName = 'package.json';
      const res = await extractPackageFile(content, fileName);
      expect(res).toBeNull();
    });
    it('fails if there are invalid depNames', async () => {
      const content = `{
  "name": "hello-reason",
  "version": "0.1.0",
  "description": "Example Reason Esy Project",
  "license": "MIT",
  "dependencies": {
    "opam/foo": "1.2.3"
  }
}`;
      const fileName = 'package.json';
      const res = await extractPackageFile(content, fileName);
      expect(res).toBeNull();
    });
  });
});
