import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const multiDepFile = Fixtures.get('validHelmsfile.yaml');
const otherYamlFile = Fixtures.get('empty.yaml');

describe('modules/manager/helmsman/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null if empty', () => {
      const content = ``;
      const fileName = 'desired_state.yaml';
      const result = extractPackageFile(content, fileName, {});
      expect(result).toBeNull();
    });

    it('returns null if extracting non helmsman yaml file', () => {
      const content = otherYamlFile;
      const fileName = 'requirements.yaml';
      const result = extractPackageFile(content, fileName, {});
      expect(result).toBeNull();
    });

    it('extract deps', () => {
      const fileName = 'helmsman.yaml';
      const result = extractPackageFile(multiDepFile, fileName, {});
      expect(result).not.toBeNull();
      expect(result?.deps).toHaveLength(10);
      expect(result?.deps.filter((value) => value.skipReason)).toHaveLength(5);
      expect(result).toMatchSnapshot();
    });
  });
});
