import { loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const concourseDefaultPipelineInitValues = loadFixture(
  'default_pipeline_init_pipeline.yaml'
);

describe('manager/concourse-pipeline/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('returns null for invalid yaml file content', () => {
      const result = extractPackageFile('nothing here: [');
      expect(result).toBeNull();
    });
    it('returns null for empty yaml file content', () => {
      const result = extractPackageFile('');
      expect(result).toBeNull();
    });
    it('returns null for no file content', () => {
      const result = extractPackageFile(null);
      expect(result).toBeNull();
    });
    it('extracts from pipeline.yaml correctly', () => {
      const result = extractPackageFile(concourseDefaultPipelineInitValues);
      expect(result).toMatchSnapshot({
        deps: [
          {
            currentValue: 'v0.19.1',
            depName: 'teliaoss/github-pr-resource',
          },
        ],
      });
    });
  });
});
