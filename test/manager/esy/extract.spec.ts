import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/esy/extract';

const esy1json = readFileSync('test/manager/esy/_fixtures/esy.1.json', 'utf8');
const esy2json = readFileSync('test/manager/esy/_fixtures/esy.2.json', 'utf8');

describe('lib/manager/esy/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      const content = '';
      const fileName = '';
      expect(await extractPackageFile(content, fileName)).toBeNull();
    });
    it('parses a simple JSON object', async () => {
      const content = esy1json;
      const fileName = 'esy.json';
      expect(await extractPackageFile(content, fileName)).not.toBeNull();
      expect(await extractPackageFile(content, fileName)).toMatchSnapshot();
    });
    it('parses a simple JSON object', async () => {
      const content = esy2json;
      const fileName = 'esy.json';
      expect(await extractPackageFile(content, fileName)).not.toBeNull();
      expect(await extractPackageFile(content, fileName)).toMatchSnapshot();
    });
    it('returns null if there are no dependencies', async () => {
      const content = `{
  "name": "hello-reason",
  "version": "0.1.0",
  "description": "Example Reason Esy Project",
  "license": "MIT" }`;
      const fileName = 'esy.json';
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
      const fileName = 'esy.json';
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
      const fileName = 'esy.json';
      const res = await extractPackageFile(content, fileName);
      expect(res).toBeNull();
    });
  });
});
