import { codeBlock } from 'common-tags';
import { regexMatches } from '../../../../test/util';
import { extractPackageFile } from '../../../modules/manager/custom/regex';
import { presets } from './regex-managers';

describe('config/presets/internal/regex-managers', () => {
  describe('Update `_VERSION` variables in Dockerfiles', () => {
    const customManager = presets['dockerfileVersions'].customManagers?.[0];

    it(`find dependencies in file`, async () => {
      const fileContent = codeBlock`
        # renovate: datasource=docker depName=node versioning=docker
        ARG NODE_VERSION=18

        FROM node:\${NODE_VERSION}

        # renovate: datasource=npm depName=pnpm
        ENV PNPM_VERSION="7.25.1"

        # renovate: datasource=npm depName=yarn
        ENV YARN_VERSION 3.3.1

        # renovate: datasource=custom.hashicorp depName=consul
        ENV CONSUL_VERSION 1.3.1

        # renovate: datasource=github-releases depName=kubernetes-sigs/kustomize versioning=regex:^(?<compatibility>.+)/v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$ extractVersion=^kustomize/(?<version>.+)$
        ENV KUSTOMIZE_VERSION v5.2.1

        RUN echo "FOO"
      `;

      const res = await extractPackageFile(
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
        expect(regexMatches(path, customManager!.fileMatch)).toBe(expected);
      });
    });
  });

  describe('Update `_VERSION` environment variables in GitHub Action files', () => {
    const customManager = presets['githubActionsVersions'].customManagers?.[0];

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
        expect(regexMatches(path, customManager!.fileMatch)).toBe(expected);
      });
    });
  });

  describe('Update `_VERSION` environment variables in GitLab pipeline file', () => {
    const customManager = presets['gitlabPipelineVersions'].customManagers?.[0];

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
        expect(regexMatches(path, customManager!.fileMatch)).toBe(expected);
      });
    });
  });

  describe('Update `appVersion` value in Helm chart Chart.yaml', () => {
    const customManager =
      presets['helmChartYamlAppVersions'].customManagers?.[0];

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
        expect(regexMatches(path, customManager!.fileMatch)).toBe(expected);
      });
    });
  });

  describe('finds dependencies in pom.xml properties', () => {
    const customManager = presets['mavenPropertyVersions'].customManagers?.[0];

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
