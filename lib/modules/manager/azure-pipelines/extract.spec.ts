import { Fixtures } from '../../../../test/fixtures';
import {
  extractContainer,
  extractRepository,
  parseAzurePipelines,
} from './extract';
import { extractPackageFile } from '.';

const azurePipelines = Fixtures.get('azure-pipelines.yaml');
const azurePipelinesInvalid = Fixtures.get('azure-pipelines-invalid.yaml');
const azurePipelinesNoDependency = Fixtures.get(
  'azure-pipelines-no-dependency.yaml'
);
const azurePipelinesStages = Fixtures.get('azure-pipelines-stages.yaml');
const azurePipelinesJobs = Fixtures.get('azure-pipelines-jobs.yaml');
const azurePipelinesSteps = Fixtures.get('azure-pipelines-steps.yaml');

describe('modules/manager/azure-pipelines/extract', () => {
  it('should parse a valid azure-pipelines file', () => {
    const file = parseAzurePipelines(azurePipelines, 'azure-pipelines.yaml');
    expect(file).not.toBeNull();
  });

  it('return null on an invalid file', () => {
    const file = parseAzurePipelines(
      azurePipelinesInvalid,
      'azure-pipelines.yaml'
    );
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
      ).toMatchSnapshot({
        depName: 'user/repo',
        packageName: 'https://github.com/user/repo.git',
      });
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
      ).toMatchSnapshot({
        depName: 'ubuntu',
        currentValue: '16.04',
        datasource: 'docker',
      });
    });

    it('should return null if image field is missing', () => {
      expect(extractContainer({ image: null })).toBeNull();
    });
  });

  describe('extractPackageFile()', () => {
    it('returns null for invalid azure pipelines files', () => {
      expect(extractPackageFile('', 'azure-pipelines.yaml')).toBeNull();
    });

    it('extracts dependencies', () => {
      const res = extractPackageFile(azurePipelines, 'azure-pipelines.yaml');
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
    });

    it('should return null when there is no dependency found', () => {
      expect(
        extractPackageFile(azurePipelinesNoDependency, 'azure-pipelines.yaml')
      ).toBeNull();
    });

    it('should extract stages', () => {
      const res = extractPackageFile(
        azurePipelinesStages,
        'azure-pipelines.yaml'
      );
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(1);
    });

    it('should extract jobs', () => {
      const res = extractPackageFile(
        azurePipelinesJobs,
        'azure-pipelines.yaml'
      );
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(1);
    });

    it('should extract steps', () => {
      const res = extractPackageFile(
        azurePipelinesSteps,
        'azure-pipelines.yaml'
      );
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(1);
    });
  });
});
