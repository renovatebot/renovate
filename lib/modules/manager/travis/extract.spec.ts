import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const invalidYAML = Fixtures.get('invalid.yml');
const matrixYAMLwithNodeSyntaxString = Fixtures.get('matrix_jobs.yml');
const matrixYAMLwithNodeSyntaxArray = Fixtures.get('matrix_jobs_array.yml');
const matrixYAMLwithNodeSyntaxArray2 = Fixtures.get('matrix_jobs_array2.yml');
const matrixYAMLwithNodeSyntaxAlias = Fixtures.get('matrix_alias.yml');
const invalidMatrixYAML = Fixtures.get('matrix_invalid.yml');

describe('modules/manager/travis/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n');
      expect(res).toBeNull();
    });

    it('returns results', () => {
      const res = extractPackageFile('node_js:\n  - 6\n  - 8\n');
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(2);
    });

    it('should handle invalid YAML', () => {
      const res = extractPackageFile(invalidYAML);
      expect(res).toBeNull();
    });

    it('handles matrix node_js syntax with node_js string', () => {
      const res = extractPackageFile(matrixYAMLwithNodeSyntaxString);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '11.10.1',
            datasource: 'github-tags',
            depName: 'node',
            packageName: 'nodejs/node',
          },
        ],
      });
    });

    it('handles matrix node_js syntax with node_js array', () => {
      const res = extractPackageFile(matrixYAMLwithNodeSyntaxArray);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '11.10.1',
            datasource: 'github-tags',
            depName: 'node',
            packageName: 'nodejs/node',
          },
          {
            currentValue: '11.10.2',
            datasource: 'github-tags',
            depName: 'node',
            packageName: 'nodejs/node',
          },
        ],
      });
    });

    it('handles matrix node_js syntax with node_js array 2', () => {
      const res = extractPackageFile(matrixYAMLwithNodeSyntaxArray2);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '11.10.1',
            datasource: 'github-tags',
            depName: 'node',
            packageName: 'nodejs/node',
          },
          {
            currentValue: '11.10.2',
            datasource: 'github-tags',
            depName: 'node',
            packageName: 'nodejs/node',
          },
        ],
      });
    });

    it('handles matrix node_js syntax with alias', () => {
      const res = extractPackageFile(matrixYAMLwithNodeSyntaxAlias);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '11.10.1',
            datasource: 'github-tags',
            depName: 'node',
            packageName: 'nodejs/node',
          },
        ],
      });
    });

    it('handles invalid matrix node_js syntax', () => {
      const res = extractPackageFile(invalidMatrixYAML);
      expect(res).toBeNull();
    });
  });
});
