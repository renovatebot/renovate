import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import { AzurePipelinesTasksDatasource } from '../../datasource/azure-pipelines-tasks';
import {
  extractAzurePipelinesTasks,
  extractContainer,
  extractRepository,
  parseAzurePipelines,
} from './extract';
import { extractPackageFile } from '.';

const azurePipelinesFilename = 'azure-pipelines.yaml';

const azurePipelines = Fixtures.get('azure-pipelines.yaml');
const azurePipelinesNoDependency = Fixtures.get(
  'azure-pipelines-no-dependency.yaml',
);

describe('modules/manager/azure-pipelines/extract', () => {
  afterEach(() => {
    GlobalConfig.reset();
  });

  it('should parse a valid azure-pipelines file', () => {
    const file = parseAzurePipelines(azurePipelines, azurePipelinesFilename);
    expect(file).not.toBeNull();
  });

  it('return null on an invalid file', () => {
    const file = parseAzurePipelines('}', azurePipelinesFilename);
    expect(file).toBeNull();
  });

  describe('extractRepository()', () => {
    it('should extract repository information', () => {
      expect(
        extractRepository(
          {
            type: 'github',
            name: 'user/repo',
            ref: 'refs/tags/v1.0.0',
          },
          'user',
        ),
      ).toMatchObject({
        depName: 'user/repo',
        packageName: 'https://github.com/user/repo.git',
      });
    });

    it('should return null when repository type is not github', () => {
      expect(
        extractRepository(
          {
            type: 'bitbucket',
            name: 'user/repo',
            ref: 'refs/tags/v1.0.0',
          },
          'user/repo',
        ),
      ).toBeNull();
    });

    it('should return null when reference is not defined specified', () => {
      expect(
        extractRepository(
          {
            type: 'github',
            name: 'user/repo',
          },
          'user/repo',
        ),
      ).toBeNull();
    });

    it('should return null when reference is invalid tag format', () => {
      expect(
        extractRepository(
          {
            type: 'github',
            name: 'user/repo',
            ref: 'refs/head/master',
          },
          'user/repo',
        ),
      ).toBeNull();
    });

    it('should extract Azure repository information if project in name', () => {
      GlobalConfig.set({
        platform: 'azure',
        endpoint: 'https://dev.azure.com/renovate-org',
      });

      expect(
        extractRepository(
          {
            type: 'git',
            name: 'project/repo',
            ref: 'refs/tags/v1.0.0',
          },
          'otherProject/otherRepo',
        ),
      ).toMatchObject({
        depName: 'project/repo',
        packageName: 'https://dev.azure.com/renovate-org/project/_git/repo',
      });
    });

    it('should extract Azure repository information if project is not in name but is in the config repository', () => {
      GlobalConfig.set({
        platform: 'azure',
        endpoint: 'https://dev.azure.com/renovate-org',
      });

      expect(
        extractRepository(
          {
            type: 'git',
            name: 'repo',
            ref: 'refs/tags/v1.0.0',
          },
          'project/otherrepo',
        ),
      ).toMatchObject({
        depName: 'project/repo',
        packageName: 'https://dev.azure.com/renovate-org/project/_git/repo',
      });
    });

    it('should return null if repository type is git and project not in name nor in config repository name', () => {
      GlobalConfig.set({
        platform: 'azure',
        endpoint: 'https://dev.azure.com/renovate-org',
      });

      expect(
        extractRepository(
          {
            type: 'git',
            name: 'repo',
            ref: 'refs/tags/v1.0.0',
          },
          '',
        ),
      ).toBeNull();
    });

    it('should return null if repository type is git and currentRepository is undefined', () => {
      GlobalConfig.set({
        platform: 'azure',
        endpoint: 'https://dev.azure.com/renovate-org',
      });

      expect(
        extractRepository(
          {
            type: 'git',
            name: 'repo',
            ref: 'refs/tags/v1.0.0',
          },
          undefined,
        ),
      ).toBeNull();
    });

    it('should return null for git repo type if platform not Azure', () => {
      GlobalConfig.set({
        platform: 'github',
      });

      expect(
        extractRepository(
          {
            type: 'git',
            name: 'project/repo',
            ref: 'refs/tags/v1.0.0',
          },
          '',
        ),
      ).toBeNull();
    });
  });

  describe('extractContainer()', () => {
    it('should extract container information', () => {
      expect(
        extractContainer({
          image: 'ubuntu:16.04',
        }),
      ).toMatchObject({
        depName: 'ubuntu',
        currentValue: '16.04',
        datasource: 'docker',
      });
    });
  });

  describe('extractAzurePipelinesTasks()', () => {
    it('should extract azure-pipelines task information', () => {
      expect(extractAzurePipelinesTasks('Bash@3')).toEqual({
        depName: 'Bash',
        currentValue: '3',
        datasource: AzurePipelinesTasksDatasource.id,
      });
    });

    it('should return null for invalid task format', () => {
      expect(extractAzurePipelinesTasks('Bash_3')).toBeNull();
    });
  });

  describe('extractPackageFile()', () => {
    it('returns null for invalid azure pipelines files', () => {
      expect(
        extractPackageFile('}', azurePipelinesFilename, { repository: 'repo' }),
      ).toBeNull();
    });

    it('extracts dependencies', () => {
      const res = extractPackageFile(azurePipelines, azurePipelinesFilename, {
        repository: 'repo',
      });
      expect(res?.deps).toMatchObject([
        {
          depName: 'user/repo',
          currentValue: 'v0.5.1',
          datasource: 'git-tags',
        },
        {
          depName: 'ubuntu',
          currentValue: '16.04',
          datasource: 'docker',
        },
        {
          depName: 'python',
          currentValue: '3.7',
          datasource: 'docker',
        },
      ]);
      expect(res?.deps).toHaveLength(3);
    });

    it('should return null when there is no dependency found', () => {
      expect(
        extractPackageFile(azurePipelinesNoDependency, azurePipelinesFilename, {
          repository: 'repo',
        }),
      ).toBeNull();
    });

    it('should extract deployment jobs runonce', () => {
      const packageFile = codeBlock`
        jobs:
        - deployment: deployment_one
          strategy:
            runOnce:
              deploy:
                steps:
                  - task: Bash@3
                    inputs:
                      script: 'echo Hello World'
      `;
      const res = extractPackageFile(packageFile, azurePipelinesFilename, {
        repository: 'repo',
      });
      expect(res?.deps).toEqual([
        {
          depName: 'Bash',
          currentValue: '3',
          datasource: AzurePipelinesTasksDatasource.id,
        },
      ]);
    });

    it('should extract deployment jobs on failure', () => {
      const packageFile = codeBlock`
        jobs:
        - deployment: deployment_one
          strategy:
            runOnce:
              on:
                failure:
                  steps:
                    - task: Bash@3
                      inputs:
                        script: 'echo Hello World'
      `;
      const res = extractPackageFile(packageFile, azurePipelinesFilename, {
        repository: 'repo',
      });
      expect(res?.deps).toEqual([
        {
          depName: 'Bash',
          currentValue: '3',
          datasource: AzurePipelinesTasksDatasource.id,
        },
      ]);
    });

    it('should extract deployment jobs on success', () => {
      const packageFile = codeBlock`
        jobs:
        - deployment: deployment_one
          strategy:
            runOnce:
              on:
                success:
                  steps:
                    - task: Bash@3
                      inputs:
                        script: 'echo Hello World'
      `;
      const res = extractPackageFile(packageFile, azurePipelinesFilename, {
        repository: 'repo',
      });
      expect(res?.deps).toEqual([
        {
          depName: 'Bash',
          currentValue: '3',
          datasource: AzurePipelinesTasksDatasource.id,
        },
      ]);
    });

    it('should extract deployment jobs postroute', () => {
      const packageFile = codeBlock`
        jobs:
        - deployment: deployment_one
          strategy:
            runOnce:
              postRouteTraffic:
                steps:
                  - task: Bash@3
                    inputs:
                      script: 'echo Hello World'
      `;
      const res = extractPackageFile(packageFile, azurePipelinesFilename, {
        repository: 'repo',
      });
      expect(res?.deps).toEqual([
        {
          depName: 'Bash',
          currentValue: '3',
          datasource: AzurePipelinesTasksDatasource.id,
        },
      ]);
    });

    it('should extract deployment jobs predeploy', () => {
      const packageFile = codeBlock`
        jobs:
        - deployment: deployment_one
          strategy:
            runOnce:
              preDeploy:
                steps:
                  - task: Bash@3
                    inputs:
                      script: 'echo Hello World'
      `;
      const res = extractPackageFile(packageFile, azurePipelinesFilename, {
        repository: 'repo',
      });
      expect(res?.deps).toEqual([
        {
          depName: 'Bash',
          currentValue: '3',
          datasource: AzurePipelinesTasksDatasource.id,
        },
      ]);
    });

    it('should extract deployment jobs route', () => {
      const packageFile = codeBlock`
        jobs:
        - deployment: deployment_one
          strategy:
            runOnce:
              routeTraffic:
                steps:
                  - task: Bash@3
                    inputs:
                      script: 'echo Hello World'
      `;
      const res = extractPackageFile(packageFile, azurePipelinesFilename, {
        repository: 'repo',
      });
      expect(res?.deps).toEqual([
        {
          depName: 'Bash',
          currentValue: '3',
          datasource: AzurePipelinesTasksDatasource.id,
        },
      ]);
    });

    it('should extract deployment jobs rolling', () => {
      const packageFile = codeBlock`
        jobs:
        - deployment: deployment_one
          strategy:
            rolling:
              deploy:
                steps:
                  - task: Bash@3
                    inputs:
                      script: 'echo Hello World'
      `;
      const res = extractPackageFile(packageFile, azurePipelinesFilename, {
        repository: 'repo',
      });
      expect(res?.deps).toEqual([
        {
          depName: 'Bash',
          currentValue: '3',
          datasource: AzurePipelinesTasksDatasource.id,
        },
      ]);
    });

    it('should extract deployment jobs canary', () => {
      const packageFile = codeBlock`
        jobs:
        - deployment: deployment_one
          strategy:
            canary:
              deploy:
                steps:
                  - task: Bash@3
                    inputs:
                      script: 'echo Hello World'
      `;
      const res = extractPackageFile(packageFile, azurePipelinesFilename, {
        repository: 'repo',
      });
      expect(res?.deps).toEqual([
        {
          depName: 'Bash',
          currentValue: '3',
          datasource: AzurePipelinesTasksDatasource.id,
        },
      ]);
    });

    it('should extract stages', () => {
      const packageFile = codeBlock`
        stages:
        - stage: stage_one
          jobs:
            - job: job_one
              steps:
                - task: Bash@3
                  inputs:
                    script: 'echo Hello World'
      `;
      const res = extractPackageFile(packageFile, azurePipelinesFilename, {
        repository: 'repo',
      });
      expect(res?.deps).toEqual([
        {
          depName: 'Bash',
          currentValue: '3',
          datasource: AzurePipelinesTasksDatasource.id,
        },
      ]);
    });

    it('should extract jobs', () => {
      const packageFile = codeBlock`
        jobs:
        - job: job_one
          steps:
            - task: Bash@3
              inputs:
                script: 'echo Hello World'
      `;
      const res = extractPackageFile(packageFile, azurePipelinesFilename, {
        repository: 'repo',
      });
      expect(res?.deps).toEqual([
        {
          depName: 'Bash',
          currentValue: '3',
          datasource: AzurePipelinesTasksDatasource.id,
        },
      ]);
    });

    it('should extract steps', () => {
      const packageFile = codeBlock`
        steps:
        - task: Bash@3
          inputs:
            script: 'echo Hello World'
      `;
      const res = extractPackageFile(packageFile, azurePipelinesFilename, {
        repository: 'repo',
      });
      expect(res?.deps).toEqual([
        {
          depName: 'Bash',
          currentValue: '3',
          datasource: AzurePipelinesTasksDatasource.id,
        },
      ]);
    });

    it('should return null when task alias used', () => {
      const packageFile = codeBlock`
        steps:
        - bash: 'echo Hello World';
      `;
      const res = extractPackageFile(packageFile, azurePipelinesFilename, {
        repository: 'repo',
      });
      expect(res).toBeNull();
    });
  });
});
