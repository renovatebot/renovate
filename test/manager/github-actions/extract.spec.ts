import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/github-actions/extract';

const workflow1 = readFileSync(
  'test/manager/github-actions/_fixtures/main.workflow.1',
  'utf8'
);

const workflow2 = readFileSync(
  'test/manager/github-actions/_fixtures/workflow.yml.1',
  'utf8'
);

describe('lib/manager/github-actions/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple image lines from docker_container', () => {
      const res = extractPackageFile(workflow1);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });
    it('extracts multiple image lines from yaml configuration file', () => {
      const res = extractPackageFile(workflow2);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });
  });
});
