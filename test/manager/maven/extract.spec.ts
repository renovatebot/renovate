/* eslint-disable no-template-curly-in-string */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackage } from '../../../lib/manager/maven/extract';

const simpleContent = readFileSync(
  resolve(__dirname, `./_fixtures/simple.pom.xml`),
  'utf8'
);

describe('manager/maven/extract', () => {
  describe('extractDependencies', () => {
    it('returns null for invalid XML', async () => {
      expect(await extractPackage(undefined)).toBeNull();
      expect(await extractPackage('invalid xml content')).toBeNull();
      expect(await extractPackage('<foobar></foobar>')).toBeNull();
      expect(await extractPackage('<project></project>')).toBeNull();
    });

    it('extract dependencies from any XML position', async () => {
      const res = await extractPackage(simpleContent);
      expect(res).toMatchSnapshot();
    });
  });
});
