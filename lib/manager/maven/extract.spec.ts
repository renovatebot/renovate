/* eslint-disable no-template-curly-in-string */
import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { getName } from '../../../test/util';
import { extractPackage } from './extract';

const minimumContent = readFileSync(
  resolve(__dirname, `./__fixtures__/minimum.pom.xml`),
  'utf8'
);

const simpleContent = readFileSync(
  resolve(__dirname, `./__fixtures__/simple.pom.xml`),
  'utf8'
);

describe(getName(__filename), () => {
  describe('extractDependencies', () => {
    it('returns null for invalid XML', () => {
      expect(extractPackage(undefined)).toBeNull();
      expect(extractPackage('invalid xml content')).toBeNull();
      expect(extractPackage('<foobar></foobar>')).toBeNull();
      expect(extractPackage('<project></project>')).toBeNull();
    });

    it('extract dependencies from any XML position', () => {
      const res = extractPackage(simpleContent);
      expect(res).toMatchSnapshot();
    });
    it('tries minimum manifests', () => {
      const res = extractPackage(minimumContent);
      expect(res).toMatchSnapshot();
    });
  });
});
