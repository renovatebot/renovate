import { readFileSync } from 'fs';
import { getName } from '../../../test/util';
import {
  extractContainer,
  extractPackageFile,
  extractRepository,
  parseAzurePipelines,
} from './extract';

const azurePipelines = readFileSync(
  'lib/manager/azure-pipelines/__fixtures__/azure-pipelines.yaml',
  'utf8'
);

const azurePipelinesInvalid = readFileSync(
  'lib/manager/azure-pipelines/__fixtures__/azure-pipelines-invalid.yaml',
  'utf8'
);

const azurePipelinesNoDependency = readFileSync(
  'lib/manager/azure-pipelines/__fixtures__/azure-pipelines-no-dependency.yaml',
  'utf8'
);

describe(getName(__filename), () => {
  it('should parse a valid azure-pipelines file', () => {
    const file = parseAzurePipelines(azurePipelines, 'some-file');
    expect(file).not.toBeNull();
  });

  it('return null on an invalid file', () => {
    const file = parseAzurePipelines(azurePipelinesInvalid, 'some-file');
    expect(file).toBeNull();
  });

  describe('extractRepository()', () => {
    it('should extract repository information', () => {
      expect(
        extractRepository({
          type: 'github',
          name: 'user/repo',
          ref: 'refs/tags/v1.0.0',
        })
      ).toMatchSnapshot();
    });

    it('should return null when repository type is not github', () => {
      expect(
        extractRepository({
          type: 'bitbucket',
          name: 'user/repo',
          ref: 'refs/tags/v1.0.0',
        })
      ).toBeNull();
    });

    it('should return null when reference is not defined', () => {
      expect(
        extractRepository({
          type: 'github',
          name: 'user/repo',
          ref: null,
        })
      ).toBeNull();
    });

    it('should return null when reference is invalid tag format', () => {
      expect(
        extractRepository({
          type: 'github',
          name: 'user/repo',
          ref: 'refs/head/master',
        })
      ).toBeNull();
    });
  });

  describe('extractContainer()', () => {
    it('should extract container information', () => {
      expect(
        extractContainer({
          image: 'ubuntu:16.04',
        })
      ).toMatchSnapshot();
    });
    it('should return null if image field is missing', () => {
      expect(extractContainer({ image: null })).toBeNull();
    });
  });

  describe('extractPackageFile()', () => {
    it('returns null for invalid azure pipelines files', () => {
      expect(extractPackageFile('', 'some-file')).toBeNull();
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile(azurePipelines, 'some-file');
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
    it('should return null when there is no dependency found', () => {
      expect(
        extractPackageFile(azurePipelinesNoDependency, 'some-file')
      ).toBeNull();
    });
  });
});
