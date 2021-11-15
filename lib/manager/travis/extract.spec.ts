import { loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const invalidYAML = loadFixture('invalid.yml');
const matrixYAML = loadFixture('matrix.yml');
const matrixYAML2 = loadFixture('matrix2.yml');
const matrixYAML3 = loadFixture('matrix3.yml');
const invalidMatrixYAML = loadFixture('matrix_invalid.yml');

describe('manager/travis/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n');
      expect(res).toBeNull();
    });

    it('returns results', () => {
      const res = extractPackageFile('node_js:\n  - 6\n  - 8\n');
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });

    it('should handle invalid YAML', () => {
      const res = extractPackageFile(invalidYAML);
      expect(res).toBeNull();
    });

    it('handles matrix node_js syntax with node_js string', () => {
      const res = extractPackageFile(matrixYAML);
      expect(res).toMatchInlineSnapshot(`
        Object {
          "deps": Array [
            Object {
              "currentValue": "11.10.1",
              "datasource": "github-tags",
              "depName": "node",
              "lookupName": "nodejs/node",
            },
          ],
        }
      `);
    });

    it('handles matrix node_js syntax with node_js array', () => {
      const res = extractPackageFile(matrixYAML2);
      expect(res).toMatchInlineSnapshot(`
        Object {
          "deps": Array [
            Object {
              "currentValue": "11.10.1",
              "datasource": "github-tags",
              "depName": "node",
              "lookupName": "nodejs/node",
            },
            Object {
              "currentValue": "11.10.2",
              "datasource": "github-tags",
              "depName": "node",
              "lookupName": "nodejs/node",
            },
          ],
        }
      `);
    });

    it('handles matrix node_js syntax with alias', () => {
      const res = extractPackageFile(matrixYAML3);
      expect(res).toMatchInlineSnapshot(`
        Object {
          "deps": Array [
            Object {
              "currentValue": "11.10.1",
              "datasource": "github-tags",
              "depName": "node",
              "lookupName": "nodejs/node",
            },
          ],
        }
      `);
    });

    it('handles invalid matrix node_js syntax', () => {
      const res = extractPackageFile(invalidMatrixYAML);
      expect(res).toBeNull();
    });
  });
});
