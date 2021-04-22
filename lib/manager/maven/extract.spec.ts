/* eslint-disable no-template-curly-in-string */
import { getName, loadFixture } from '../../../test/util';
import { extractPackage } from './extract';

const minimumContent = loadFixture(__filename, `minimum.pom.xml`);
const simpleContent = loadFixture(__filename, `simple.pom.xml`);

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
