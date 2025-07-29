import { codeBlock } from 'common-tags';
import { extractPackageFile } from '../../../modules/manager';
import { matchRegexOrGlobList } from '../../../util/string-match';
import { presets } from './custom-managers';

describe('config/presets/internal/custom-managers', () => {
  describe('Update `_VERSION` environment variables in Azure Pipelines files', () => {
    const customManager = presets.azurePipelinesVersions.customManagers?.[0];

    it(`find dependencies in file`, async () => {
      const fileContent = codeBlock`
        trigger:
          - main

        pool:
          vmImage: ubuntu-latest

        jobs:
          - job: Work
            steps:
              - script: echo Hello, world!
                displayName: 'Run a one-line script'
                env:
                  # renovate: datasource=node depName=node versioning=node
                  NODE_VERSION: 18.13.0
                  # renovate: datasource=npm depName=pnpm
                  PNPM_VERSION: "7.25.1"
                  # renovate: datasource=npm depName=yarn
                  YARN_VERSION: '3.3.1'
                  # renovate: datasource=custom.hashicorp depName=consul
                  CONSUL_VERSION: 1.3.1
                  # renovate: datasource=github-releases depName=hashicorp/terraform versioning=hashicorp extractVersion=^v(?<version>.+)$
                  TERRAFORM_VERSION: 1.5.7
                  # renovate: datasource=github-releases depName=kubernetes-sigs/kustomize versioning=regex:^(?<compatibility>.+)/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$
                  KUSTOMIZE_VERSION: kustomize/v5.2.1
              - script: echo Hello, world!
                displayName: 'Run a one-line script'
      `;

      const res = await extractPackageFile(
        'regex',
        fileContent,
        'azure-pipelines.yaml',
        customManager!,
      );

      expect(res?.deps).toMatchObject([
        {
          currentValue: '18.13.0',
          datasource: 'node-version',
          depName: 'node',
          replaceString:
            '# renovate: datasource=node depName=node versioning=node\n          NODE_VERSION: 18.13.0\n',
          versioning: 'node',
        },
        {
          currentValue: '7.25.1',
          datasource: 'npm',
          depName: 'pnpm',
          replaceString:
            '# renovate: datasource=npm depName=pnpm\n          PNPM_VERSION: "7.25.1"\n',
        },
        {
          currentValue: '3.3.1',
          datasource: 'npm',
          depName: 'yarn',
          replaceString:
            "# renovate: datasource=npm depName=yarn\n          YARN_VERSION: '3.3.1'\n",
        },
        {
          currentValue: '1.3.1',
          datasource: 'custom.hashicorp',
          depName: 'consul',
          replaceString:
            '# renovate: datasource=custom.hashicorp depName=consul\n          CONSUL_VERSION: 1.3.1\n',
        },
        {
          currentValue: '1.5.7',
          datasource: 'github-releases',
          depName: 'hashicorp/terraform',
          replaceString:
            '# renovate: datasource=github-releases depName=hashicorp/terraform versioning=hashicorp extractVersion=^v(?<version>.+)$\n          TERRAFORM_VERSION: 1.5.7\n',
          versioning: 'hashicorp',
          extractVersion: '^v(?<version>.+)$',
        },
        {
          currentValue: 'kustomize/v5.2.1',
          datasource: 'github-releases',
          depName: 'kubernetes-sigs/kustomize',
          replaceString:
            '# renovate: datasource=github-releases depName=kubernetes-sigs/kustomize versioning=regex:^(?<compatibility>.+)/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$\n          KUSTOMIZE_VERSION: kustomize/v5.2.1\n',
          versioning:
            'regex:^(?<compatibility>.+)/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$',
        },
      ]);
    });

    describe('matches regexes patterns', () => {
      it.each`
        path                               | expected
        ${'.azuredevops/bar.yml'}          | ${true}
        ${'.azuredevops/bar.yaml'}         | ${true}
        ${'.azuredevops/foo/bar.yml'}      | ${true}
        ${'.azuredevops/foo/bar.yaml'}     | ${true}
        ${'foo/.azuredevops/bar.yml'}      | ${true}
        ${'foo/.azuredevops/bar.yaml'}     | ${true}
        ${'foo/.azuredevops/foo/bar.yml'}  | ${true}
        ${'foo/.azuredevops/foo/bar.yaml'} | ${true}
        ${'azurepipelines.yml'}            | ${true}
        ${'azurepipelines.yaml'}           | ${true}
        ${'azure-pipelines.yml'}           | ${true}
        ${'azure-pipelines.yaml'}          | ${true}
        ${'azure-pipelines-foo.yml'}       | ${true}
        ${'azure-pipelines-foo.yaml'}      | ${true}
        ${'azure-foo-pipelines.yml'}       | ${true}
        ${'azure-foo-pipelines.yaml'}      | ${true}
        ${'azurepipelinesfoo.yml'}         | ${true}
        ${'azurepipelinesfoo.yaml'}        | ${true}
        ${'azurefoopipelines.yml'}         | ${true}
        ${'azurefoopipelines.yaml'}        | ${true}
        ${'foo.yml'}                       | ${false}
        ${'foo.yaml'}                      | ${false}
      `('$path', ({ path, expected }) => {
        expect(
          matchRegexOrGlobList(path, customManager!.managerFilePatterns),
        ).toBe(expected);
      });
    });
  });

  describe('Update `$schema` version in biome.json', () => {
    const customManager = presets.biomeVersions.customManagers?.[0];

    it(`find dependencies in file`, async () => {
      const fileContent = codeBlock`
        {
          "$schema": "https://biomejs.dev/schemas/1.7.3/schema.json",
        }
      `;

      const res = await extractPackageFile(
        'jsonata',
        fileContent,
        'biome.json',
        customManager!,
      );

      expect(res?.deps).toMatchObject([
        {
          currentValue: '1.7.3',
          datasource: 'npm',
          depName: '@biomejs/biome',
        },
      ]);
    });

    describe('matches regexes patterns', () => {
      it.each`
        path                 | expected
        ${'biome.json'}      | ${true}
        ${'biome.jsonc'}     | ${true}
        ${'foo/biome.json'}  | ${true}
        ${'foo/biome.jsonc'} | ${true}
        ${'biome.yml'}       | ${false}
      `('$path', ({ path, expected }) => {
        expect(
          matchRegexOrGlobList(path, customManager!.managerFilePatterns),
        ).toBe(expected);
      });
    });
  });

  describe('Update `_VERSION` variables in Bitbucket Pipelines', () => {
    const customManager =
      presets.bitbucketPipelinesVersions.customManagers?.[0];

    it(`find dependencies in file`, async () => {
      const fileContent = codeBlock`
        script:
          # renovate: datasource=docker depName=node versioning=docker
          - export NODE_VERSION=18

          # renovate: datasource=npm depName=pnpm
          - export PNPM_VERSION="7.25.1"

          # renovate: datasource=npm depName=yarn
          - export YARN_VERSION 3.3.1

          # renovate: datasource=custom.hashicorp depName=consul
          - export CONSUL_VERSION 1.3.1

          # renovate: datasource=github-releases depName=kubernetes-sigs/kustomize versioning=regex:^(?<compatibility>.+)/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$ extractVersion=^kustomize/(?<version>.+)$
          - export KUSTOMIZE_VERSION v5.2.1

          - pipe: something/cool:latest
            variables:
              # renovate: datasource=docker depName=node versioning=docker
              NODE_VERSION: 18
              # renovate: datasource=npm depName=pnpm
              PNPM_VERSION:"7.25.1"
              # renovate: datasource=npm depName=yarn
              YARN_VERSION: '3.3.1'

          - echo $NODE_VERSION
      `;

      const res = await extractPackageFile(
        'regex',
        fileContent,
        'bitbucket-pipelines.yml',
        customManager!,
      );

      expect(res?.deps).toMatchObject([
        {
          currentValue: '18',
          datasource: 'docker',
          depName: 'node',
          replaceString:
            '# renovate: datasource=docker depName=node versioning=docker\n  - export NODE_VERSION=18\n',
          versioning: 'docker',
        },
        {
          currentValue: '7.25.1',
          datasource: 'npm',
          depName: 'pnpm',
          replaceString:
            '# renovate: datasource=npm depName=pnpm\n  - export PNPM_VERSION="7.25.1"\n',
        },
        {
          currentValue: '3.3.1',
          datasource: 'npm',
          depName: 'yarn',
          replaceString:
            '# renovate: datasource=npm depName=yarn\n  - export YARN_VERSION 3.3.1\n',
        },
        {
          currentValue: '1.3.1',
          datasource: 'custom.hashicorp',
          depName: 'consul',
          replaceString:
            '# renovate: datasource=custom.hashicorp depName=consul\n  - export CONSUL_VERSION 1.3.1\n',
        },
        {
          currentValue: 'v5.2.1',
          datasource: 'github-releases',
          depName: 'kubernetes-sigs/kustomize',
          replaceString:
            '# renovate: datasource=github-releases depName=kubernetes-sigs/kustomize versioning=regex:^(?<compatibility>.+)/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$ extractVersion=^kustomize/(?<version>.+)$\n  - export KUSTOMIZE_VERSION v5.2.1\n',
          extractVersion: '^kustomize/(?<version>.+)$',
          versioning:
            'regex:^(?<compatibility>.+)/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$',
        },
        {
          currentValue: '18',
          datasource: 'docker',
          depName: 'node',
          replaceString:
            '# renovate: datasource=docker depName=node versioning=docker\n      NODE_VERSION: 18\n',
          versioning: 'docker',
        },
        {
          currentValue: '7.25.1',
          datasource: 'npm',
          depName: 'pnpm',
          replaceString:
            '# renovate: datasource=npm depName=pnpm\n      PNPM_VERSION:"7.25.1"\n',
        },
        {
          currentValue: '3.3.1',
          datasource: 'npm',
          depName: 'yarn',
          replaceString:
            "# renovate: datasource=npm depName=yarn\n      YARN_VERSION: '3.3.1'\n",
        },
      ]);
    });

    describe('matches regexes patterns', () => {
      it.each`
        path                                  | expected
        ${'bitbucket-pipelines.yml'}          | ${true}
        ${'bitbucket-pipelines.yaml'}         | ${true}
        ${'foo/bitbucket-pipelines.yml'}      | ${true}
        ${'foo/bitbucket-pipelines.yaml'}     | ${true}
        ${'foo/bar/bitbucket-pipelines.yml'}  | ${true}
        ${'foo/bar/bitbucket-pipelines.yaml'} | ${true}
        ${'bitbucket-pipelines'}              | ${false}
      `('$path', ({ path, expected }) => {
        expect(
          matchRegexOrGlobList(path, customManager!.managerFilePatterns),
        ).toBe(expected);
      });
    });
  });

  describe('Update `_VERSION` variables in Dockerfiles', () => {
    const customManager = presets.dockerfileVersions.customManagers?.[0];

    it(`find dependencies in file`, async () => {
      const fileContent = codeBlock`
        # renovate: datasource=docker depName=node versioning=docker
        ARG NODE_VERSION=18

        FROM node:\${NODE_VERSION}

        # renovate: datasource=npm depName=pnpm
        ENV PNPM_VERSION="7.25.1"

        # renovate: datasource=npm depName=pnpm
        ENV PNPM_VERSION='7.25.1'

        # renovate: datasource=npm depName=yarn
        ENV YARN_VERSION 3.3.1

        # renovate: datasource=custom.hashicorp depName=consul
        ENV CONSUL_VERSION 1.3.1

        # renovate: datasource=github-releases depName=kubernetes-sigs/kustomize versioning=regex:^(?<compatibility>.+)/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$ extractVersion=^kustomize/(?<version>.+)$
        ENV KUSTOMIZE_VERSION v5.2.1

        RUN echo "FOO"
      `;

      const res = await extractPackageFile(
        'regex',
        fileContent,
        'Dockerfile',
        customManager!,
      );

      expect(res?.deps).toMatchObject([
        {
          currentValue: '18',
          datasource: 'docker',
          depName: 'node',
          replaceString:
            '# renovate: datasource=docker depName=node versioning=docker\nARG NODE_VERSION=18\n',
          versioning: 'docker',
        },
        {
          currentValue: '7.25.1',
          datasource: 'npm',
          depName: 'pnpm',
          replaceString:
            '# renovate: datasource=npm depName=pnpm\nENV PNPM_VERSION="7.25.1"\n',
        },
        {
          currentValue: '7.25.1',
          datasource: 'npm',
          depName: 'pnpm',
          replaceString:
            "# renovate: datasource=npm depName=pnpm\nENV PNPM_VERSION='7.25.1'\n",
        },
        {
          currentValue: '3.3.1',
          datasource: 'npm',
          depName: 'yarn',
          replaceString:
            '# renovate: datasource=npm depName=yarn\nENV YARN_VERSION 3.3.1\n',
        },
        {
          currentValue: '1.3.1',
          datasource: 'custom.hashicorp',
          depName: 'consul',
          replaceString:
            '# renovate: datasource=custom.hashicorp depName=consul\nENV CONSUL_VERSION 1.3.1\n',
        },
        {
          currentValue: 'v5.2.1',
          datasource: 'github-releases',
          depName: 'kubernetes-sigs/kustomize',
          replaceString:
            '# renovate: datasource=github-releases depName=kubernetes-sigs/kustomize versioning=regex:^(?<compatibility>.+)/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$ extractVersion=^kustomize/(?<version>.+)$\nENV KUSTOMIZE_VERSION v5.2.1\n',
          extractVersion: '^kustomize/(?<version>.+)$',
          versioning:
            'regex:^(?<compatibility>.+)/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$',
        },
      ]);
    });

    describe('matches regexes patterns', () => {
      it.each`
        path                    | expected
        ${'Dockerfile'}         | ${true}
        ${'foo/Dockerfile'}     | ${true}
        ${'foo/bar/Dockerfile'} | ${true}
        ${'Dockerfile-foo'}     | ${true}
        ${'Dockerfilefoo'}      | ${true}
        ${'foo/Dockerfile-foo'} | ${true}
        ${'foo-Dockerfile'}     | ${false}
      `('$path', ({ path, expected }) => {
        expect(
          matchRegexOrGlobList(path, customManager!.managerFilePatterns),
        ).toBe(expected);
      });
    });
  });

  describe('Update `_VERSION` environment variables in GitHub Action files', () => {
    const customManager = presets.githubActionsVersions.customManagers?.[0];

    it(`find dependencies in file`, async () => {
      const fileContent = codeBlock`
        name: CI

        on:
          pull_request:

        env:
          # renovate: datasource=node depName=node versioning=node
          NODE_VERSION: 18.13.0
          # renovate: datasource=npm depName=pnpm
          PNPM_VERSION: "7.25.1"
          # renovate: datasource=npm depName=yarn
          YARN_VERSION: '3.3.1'
          # renovate: datasource=custom.hashicorp depName=consul
          CONSUL_VERSION: 1.3.1
          # renovate: datasource=github-releases depName=hashicorp/terraform versioning=hashicorp extractVersion=^v(?<version>.+)$
          TERRAFORM_VERSION: 1.5.7
          # renovate: datasource=github-releases depName=kubernetes-sigs/kustomize versioning=regex:^(?<compatibility>.+)/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$
          KUSTOMIZE_VERSION: kustomize/v5.2.1

        jobs:
          lint:
            runs-on: ubuntu-22.04
            steps:
              - uses: pnpm/action-setup@v2
                with:
                  version: \${{ env.PNPM_VERSION }}
              - uses: actions/setup-node@v3
                with:
                  node-version: \${{ env.NODE_VERSION }}
      `;

      const res = await extractPackageFile(
        'regex',
        fileContent,
        'github-workflow.yaml',
        customManager!,
      );

      expect(res?.deps).toMatchObject([
        {
          currentValue: '18.13.0',
          datasource: 'node-version',
          depName: 'node',
          replaceString:
            '# renovate: datasource=node depName=node versioning=node\n  NODE_VERSION: 18.13.0\n',
          versioning: 'node',
        },
        {
          currentValue: '7.25.1',
          datasource: 'npm',
          depName: 'pnpm',
          replaceString:
            '# renovate: datasource=npm depName=pnpm\n  PNPM_VERSION: "7.25.1"\n',
        },
        {
          currentValue: '3.3.1',
          datasource: 'npm',
          depName: 'yarn',
          replaceString:
            "# renovate: datasource=npm depName=yarn\n  YARN_VERSION: '3.3.1'\n",
        },
        {
          currentValue: '1.3.1',
          datasource: 'custom.hashicorp',
          depName: 'consul',
          replaceString:
            '# renovate: datasource=custom.hashicorp depName=consul\n  CONSUL_VERSION: 1.3.1\n',
        },
        {
          currentValue: '1.5.7',
          datasource: 'github-releases',
          depName: 'hashicorp/terraform',
          replaceString:
            '# renovate: datasource=github-releases depName=hashicorp/terraform versioning=hashicorp extractVersion=^v(?<version>.+)$\n  TERRAFORM_VERSION: 1.5.7\n',
          versioning: 'hashicorp',
          extractVersion: '^v(?<version>.+)$',
        },
        {
          currentValue: 'kustomize/v5.2.1',
          datasource: 'github-releases',
          depName: 'kubernetes-sigs/kustomize',
          replaceString:
            '# renovate: datasource=github-releases depName=kubernetes-sigs/kustomize versioning=regex:^(?<compatibility>.+)/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$\n  KUSTOMIZE_VERSION: kustomize/v5.2.1\n',
          versioning:
            'regex:^(?<compatibility>.+)/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$',
        },
      ]);
    });

    describe('matches regexes patterns', () => {
      it.each`
        path                                | expected
        ${'.github/workflows/foo.yaml'}     | ${true}
        ${'.github/workflows/bar.yml'}      | ${true}
        ${'.github/workflows/foo/bar.yaml'} | ${true}
        ${'.github/actions/foo.yaml'}       | ${true}
        ${'.github/actions/foo.yml'}        | ${true}
        ${'.github/actions/foo/bar.yaml'}   | ${true}
        ${'foo.yaml'}                       | ${false}
        ${'foo.yml'}                        | ${false}
        ${'.github/foo.yml'}                | ${false}
        ${'.github/workflowsa/foo.yml'}     | ${false}
        ${'.github/workflows/foo.json'}     | ${false}
        ${'.github/workflows/foo.yamlo'}    | ${false}
      `('$path', ({ path, expected }) => {
        expect(
          matchRegexOrGlobList(path, customManager!.managerFilePatterns),
        ).toBe(expected);
      });
    });
  });

  describe('Update `_VERSION` environment variables in GitLab pipeline file', () => {
    const customManager = presets.gitlabPipelineVersions.customManagers?.[0];

    it(`find dependencies in file`, async () => {
      const fileContent = codeBlock`
        variables:
          # renovate: datasource=node depName=node versioning=node
          NODE_VERSION: 18.13.0
          # renovate: datasource=npm depName=pnpm
          PNPM_VERSION: "7.25.1"
          # renovate: datasource=npm depName=yarn
          YARN_VERSION: '3.3.1'
          # renovate: datasource=custom.hashicorp depName=consul
          CONSUL_VERSION: 1.3.1

        lint:
          image: node:\${NODE_VERSION}
          script:
            - npm install -g pnpm@\${PNPM_VERSION}
      `;

      const res = await extractPackageFile(
        'regex',
        fileContent,
        'gitlab-ci.yml',
        customManager!,
      );

      expect(res?.deps).toMatchObject([
        {
          currentValue: '18.13.0',
          datasource: 'node-version',
          depName: 'node',
          replaceString:
            '# renovate: datasource=node depName=node versioning=node\n  NODE_VERSION: 18.13.0\n',
          versioning: 'node',
        },
        {
          currentValue: '7.25.1',
          datasource: 'npm',
          depName: 'pnpm',
          replaceString:
            '# renovate: datasource=npm depName=pnpm\n  PNPM_VERSION: "7.25.1"\n',
        },
        {
          currentValue: '3.3.1',
          datasource: 'npm',
          depName: 'yarn',
          replaceString:
            "# renovate: datasource=npm depName=yarn\n  YARN_VERSION: '3.3.1'\n",
        },
        {
          currentValue: '1.3.1',
          datasource: 'custom.hashicorp',
          depName: 'consul',
          replaceString:
            '# renovate: datasource=custom.hashicorp depName=consul\n  CONSUL_VERSION: 1.3.1\n',
        },
      ]);
    });

    describe('matches regexes patterns', () => {
      it.each`
        path                        | expected
        ${'.gitlab-ci.yaml'}        | ${true}
        ${'.gitlab-ci.yml'}         | ${true}
        ${'foo.yaml'}               | ${false}
        ${'foo.yml'}                | ${false}
        ${'.gitlab/ci.yml'}         | ${false}
        ${'includes/gitlab-ci.yml'} | ${false}
      `('$path', ({ path, expected }) => {
        expect(
          matchRegexOrGlobList(path, customManager!.managerFilePatterns),
        ).toBe(expected);
      });
    });
  });

  describe('Update `appVersion` value in Helm chart Chart.yaml', () => {
    const customManager = presets.helmChartYamlAppVersions.customManagers?.[0];

    it(`find dependencies in file`, async () => {
      const fileContent = codeBlock`
        apiVersion: v1
        name: a-chart
        version: "1"
        # renovate: image=node
        appVersion: 19.4.0
        # renovate: image=python
        appVersion: "3.11.1"
        # renovate: image=postgres
        appVersion: '15.1'
      `;

      const res = await extractPackageFile(
        'regex',
        fileContent,
        'Chart.yaml',
        customManager!,
      );

      expect(res?.deps).toMatchObject([
        {
          currentValue: '19.4.0',
          datasource: 'docker',
          depName: 'node',
          replaceString: '# renovate: image=node\nappVersion: 19.4.0',
        },
        {
          currentValue: '3.11.1',
          datasource: 'docker',
          depName: 'python',
          replaceString: '# renovate: image=python\nappVersion: "3.11.1',
        },
        {
          currentValue: '15.1',
          datasource: 'docker',
          depName: 'postgres',
          replaceString: "# renovate: image=postgres\nappVersion: '15.1",
        },
      ]);
    });

    describe('matches regexes patterns', () => {
      it.each`
        path                    | expected
        ${'Chart.yaml'}         | ${true}
        ${'foo/Chart.yaml'}     | ${true}
        ${'foo/bar/Chart.yaml'} | ${true}
        ${'Chart.yml'}          | ${false}
        ${'Chart.json'}         | ${false}
        ${'Chart.yamlo'}        | ${false}
        ${'Charto.yaml'}        | ${false}
      `('$path', ({ path, expected }) => {
        expect(
          matchRegexOrGlobList(path, customManager!.managerFilePatterns),
        ).toBe(expected);
      });
    });
  });

  describe('Update `_VERSION` variables in Makefiles', () => {
    const customManager = presets.makefileVersions.customManagers?.[0];

    it(`find dependencies in file`, async () => {
      const fileContent = codeBlock`
        # renovate: datasource=node depName=node versioning=node
        NODE_VERSION=18.13.0
        # renovate: datasource=npm depName=pnpm
        PNPM_VERSION = "7.25.1"
        # renovate: datasource=npm depName=yarn
        YARN_VERSION := '3.3.1'
        # renovate: datasource=custom.hashicorp depName=consul
        CONSUL_VERSION ?= 1.3.1

        lint:
        \tnpm install -g pnpm@$(PNPM_VERSION)
      `;

      const res = await extractPackageFile(
        'regex',
        fileContent,
        'gitlab-ci.yml',
        customManager!,
      );

      expect(res?.deps).toMatchObject([
        {
          currentValue: '18.13.0',
          datasource: 'node-version',
          depName: 'node',
          replaceString:
            '# renovate: datasource=node depName=node versioning=node\nNODE_VERSION=18.13.0\n',
          versioning: 'node',
        },
        {
          currentValue: '7.25.1',
          datasource: 'npm',
          depName: 'pnpm',
          replaceString:
            '# renovate: datasource=npm depName=pnpm\nPNPM_VERSION = "7.25.1"\n',
        },
        {
          currentValue: '3.3.1',
          datasource: 'npm',
          depName: 'yarn',
          replaceString:
            "# renovate: datasource=npm depName=yarn\nYARN_VERSION := '3.3.1'\n",
        },
        {
          currentValue: '1.3.1',
          datasource: 'custom.hashicorp',
          depName: 'consul',
          replaceString:
            '# renovate: datasource=custom.hashicorp depName=consul\nCONSUL_VERSION ?= 1.3.1\n',
        },
      ]);
    });

    describe('matches regexes patterns', () => {
      it.each`
        path                      | expected
        ${'Makefile'}             | ${true}
        ${'makefile'}             | ${true}
        ${'GNUMakefile'}          | ${true}
        ${'sub/dir/Makefile'}     | ${true}
        ${'versions.mk'}          | ${true}
        ${'Dockerfile'}           | ${false}
        ${'MakefileGenerator.ts'} | ${false}
      `('$path', ({ path, expected }) => {
        expect(
          matchRegexOrGlobList(path, customManager!.managerFilePatterns),
        ).toBe(expected);
      });
    });
  });

  describe('finds dependencies in pom.xml properties', () => {
    const customManager = presets.mavenPropertyVersions.customManagers?.[0];

    it(`find dependencies in file`, async () => {
      const fileContent = codeBlock`
        <!-- renovate: depName=org.ow2.asm:asm -->
        <asm.version>9.3</asm.version>

        <!--renovate: depName=org.codehaus.groovy:groovy versioning=semver -->
        <groovy.version>4.0.10</groovy.version>

        <!-- renovate: datasource=docker depName=mongo -->
        <mongo.container.version>4.4.6</mongo.container.version>
      `;

      const res = await extractPackageFile(
        'regex',
        fileContent,
        'pom.xml',
        customManager!,
      );

      expect(res?.deps).toMatchObject([
        {
          currentValue: '9.3',
          datasource: 'maven',
          depName: 'org.ow2.asm:asm',
          replaceString:
            '<!-- renovate: depName=org.ow2.asm:asm -->\n<asm.version>9.3</asm.version>',
        },
        {
          currentValue: '4.0.10',
          datasource: 'maven',
          depName: 'org.codehaus.groovy:groovy',
          replaceString:
            '<!--renovate: depName=org.codehaus.groovy:groovy versioning=semver -->\n<groovy.version>4.0.10</groovy.version>',
          versioning: 'semver',
        },
        {
          currentValue: '4.4.6',
          datasource: 'docker',
          depName: 'mongo',
          replaceString:
            '<!-- renovate: datasource=docker depName=mongo -->\n<mongo.container.version>4.4.6</mongo.container.version>',
        },
      ]);
    });
  });
});
