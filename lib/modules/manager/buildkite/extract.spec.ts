import { codeBlock } from 'common-tags';
import type { PackageDependency } from '../types.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/buildkite/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts simple single plugin', () => {
      const fileContent = codeBlock`
        steps:
          - plugins:
              abc/detect-clowns#v2.0.0: ~
      `;
      const res = extractPackageFile(fileContent)?.deps;
      expect(res).toEqual([
        {
          currentValue: 'v2.0.0',
          datasource: 'github-tags',
          depName: 'abc/detect-clowns',
          packageName: 'abc/detect-clowns-buildkite-plugin',
        },
      ]);
    });

    it('extracts multiple plugins in same file', () => {
      const fileContent = codeBlock`
        steps:
          # Prebuild the app image, upload it to a registry for later steps
          - name: "Docker Build"
            plugins:
              docker-compose#v1.3.2: # Comment at the end....
                build: app
                image-repository: index.docker.io/org/repo

          - wait

          # Use the app image built above to run concurrent tests
          - name: "Docker Test %n"
            command: test.sh
            parallelism: 25
            plugins:
              docker-compose#v1.3.2:
                run: app
      `;
      const res = extractPackageFile(fileContent)?.deps;
      expect(res).toEqual([
        {
          currentValue: 'v1.3.2',
          datasource: 'github-tags',
          depName: 'docker-compose',
          packageName: 'buildkite-plugins/docker-compose-buildkite-plugin',
        },
        {
          currentValue: 'v1.3.2',
          datasource: 'github-tags',
          depName: 'docker-compose',
          packageName: 'buildkite-plugins/docker-compose-buildkite-plugin',
        },
      ]);
    });

    it('adds skipReason', () => {
      const fileContent = codeBlock`
        steps:
          - name: "Docker Build"
            plugins:
              namespace/docker-compose#v1.3.2.5:
                build: app
                image-repository: index.docker.io/org/repo

          - wait

          - name: "wrong"
            command: test.sh
            parallelism: 25
            plugins:
              github.com/buildkite/plugin-docker-compose#v1.3.2:
                run: app
      `;
      const res = extractPackageFile(fileContent)?.deps;
      expect(res).toEqual([
        {
          currentValue: 'v1.3.2.5',
          depName: 'namespace/docker-compose',
          skipReason: 'invalid-version',
        },
        {
          currentValue: 'v1.3.2',
          depName: 'github.com/buildkite/plugin-docker-compose',
          skipReason: 'invalid-dependency-specification',
        },
      ]);
    });

    it('extracts arrays of plugins', () => {
      const fileContent = codeBlock`
        steps:
          - plugins:
              - docker-login#v2.0.1:
                  username: xyz
              - docker-compose#v2.5.1:
                  build: app
                  image-repository: index.docker.io/myorg/myrepo
          - wait
          - command: test.sh
            plugins:
              - docker-login#v2.0.1:
                  username: xyz
              - docker-compose#v2.5.1:
                  run: app
      `;
      const res = extractPackageFile(fileContent)?.deps;
      expect(res).toEqual([
        {
          currentValue: 'v2.0.1',
          datasource: 'github-tags',
          depName: 'docker-login',
          packageName: 'buildkite-plugins/docker-login-buildkite-plugin',
        },
        {
          currentValue: 'v2.5.1',
          datasource: 'github-tags',
          depName: 'docker-compose',
          packageName: 'buildkite-plugins/docker-compose-buildkite-plugin',
        },
        {
          currentValue: 'v2.0.1',
          datasource: 'github-tags',
          depName: 'docker-login',
          packageName: 'buildkite-plugins/docker-login-buildkite-plugin',
        },
        {
          currentValue: 'v2.5.1',
          datasource: 'github-tags',
          depName: 'docker-compose',
          packageName: 'buildkite-plugins/docker-compose-buildkite-plugin',
        },
      ]);
    });

    it('extracts git-based plugins', () => {
      const fileContent = codeBlock`
        steps:
              - ssh://git@github.company.com/some-org/some-plugin#v3.2.7:
                  username: abc
              - https://github.company.com/some-third-org/some-third-plugin#v0.0.1:
                  build: app
      `;
      const res = extractPackageFile(fileContent)?.deps;
      expect(res).toEqual([
        {
          currentValue: 'v3.2.7',
          datasource: 'github-tags',
          depName: 'some-org/some-plugin',
          registryUrls: ['https://github.company.com'],
        },
        {
          currentValue: 'v0.0.1',
          datasource: 'github-tags',
          depName: 'some-third-org/some-third-plugin',
          registryUrls: ['https://github.company.com'],
        },
      ]);
    });

    it('extracts git-based plugin with .git at the end of its name', () => {
      const expectedPackageDependency: PackageDependency = {
        currentValue: 'v3.2.7',
        datasource: 'github-tags',
        depName: 'some-org/some-plugin',
        registryUrls: ['https://github.company.com'],
      };
      const fileContent = codeBlock`
        steps:
              - ssh://git@github.company.com/some-org/some-plugin.git#v3.2.7:
      `;
      const res = extractPackageFile(fileContent)?.deps;
      expect(res).toHaveLength(1);
      expect(res).toEqual([expectedPackageDependency]);
    });

    it('extracts plugins outside plugins sections', () => {
      const fileContent = codeBlock`
        .docker-options: &some-options
          copy-checkout: true
        .python3-container: &python3-container
          ssh://git@github.some-domain.com/some-org/some-plugin#v3.2.7:
            some-config: some-value
            <<: *some-options
      `;
      const res = extractPackageFile(fileContent)?.deps;
      const expectedPackageDependency: PackageDependency = {
        currentValue: 'v3.2.7',
        datasource: 'github-tags',
        depName: 'some-org/some-plugin',
        registryUrls: ['https://github.some-domain.com'],
      };
      expect(res).toEqual([expectedPackageDependency]);
    });

    it('extracts plugin with preceding ?', () => {
      const fileContent = codeBlock`
        steps:
              - ? ssh://git@github.company.com/some-org/some-plugin.git#v3.2.7
      `;
      const res = extractPackageFile(fileContent)?.deps;
      const expectedPackageDependency: PackageDependency = {
        currentValue: 'v3.2.7',
        datasource: 'github-tags',
        depName: 'some-org/some-plugin',
        registryUrls: ['https://github.company.com'],
      };
      expect(res).toEqual([expectedPackageDependency]);
    });

    it('extracts plugin tags from bitbucket', () => {
      const fileContent = codeBlock`
        steps:
          - plugins:
              - ssh://git@bitbucket.org/some-org/some-plugin.git#v3.2.7:
              - docker-compose#v1.3.2:
      `;
      const res = extractPackageFile(fileContent)?.deps;
      const githubDependency: PackageDependency = {
        currentValue: 'v1.3.2',
        datasource: 'github-tags',
        depName: 'docker-compose',
        packageName: 'buildkite-plugins/docker-compose-buildkite-plugin',
      };
      const bitbucketDependency: PackageDependency = {
        currentValue: 'v3.2.7',
        datasource: 'bitbucket-tags',
        depName: 'some-org/some-plugin',
        registryUrls: ['https://bitbucket.org'],
      };
      expect(res).toEqual([bitbucketDependency, githubDependency]);
    });

    it('extracts plugin tags with quotes', () => {
      const fileContent = codeBlock`
        steps:
          - name: "When single quoted"
            command: true
            plugins:
              - 'test-collector#v1.8.0':
                  files: junit.xml
                  format: junit

          - name: "Docker Test %n"
            command: test.sh
            parallelism: 25
            plugins:
              "docker-compose#v1.3.2":
                run: app
      `;
      const res = extractPackageFile(fileContent)?.deps;
      const singleQuotesDependency: PackageDependency = {
        currentValue: 'v1.8.0',
        datasource: 'github-tags',
        depName: 'test-collector',
        packageName: 'buildkite-plugins/test-collector-buildkite-plugin',
      };
      const doubleQuotesDependency: PackageDependency = {
        currentValue: 'v1.3.2',
        datasource: 'github-tags',
        depName: 'docker-compose',
        packageName: 'buildkite-plugins/docker-compose-buildkite-plugin',
      };
      expect(res).toEqual([singleQuotesDependency, doubleQuotesDependency]);
    });

    it('extracts image from pipeline-level agents', () => {
      const fileContent = codeBlock`
        agents:
          image: "docker.elastic.co/ci-agent-images/thumbnails4j-buildkite-agent"
          ephemeralStorage: "20G"
      `;
      const res = extractPackageFile(fileContent)?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          datasource: 'docker',
          depName:
            'docker.elastic.co/ci-agent-images/thumbnails4j-buildkite-agent',
          packageName:
            'docker.elastic.co/ci-agent-images/thumbnails4j-buildkite-agent',
          depType: 'docker',
          replaceString:
            'docker.elastic.co/ci-agent-images/thumbnails4j-buildkite-agent',
        },
      ]);
    });

    it('extracts image from step-level agents', () => {
      const fileContent = codeBlock`
        steps:
          - command: .buildkite/scripts/trigger-if-java-ea-new-build.sh
            agents:
              image: "docker.elastic.co/ci-agent-images/eck-region/buildkite-agent:1.15"
              memory: "4G"
      `;
      const res = extractPackageFile(fileContent)?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '1.15',
          datasource: 'docker',
          depName:
            'docker.elastic.co/ci-agent-images/eck-region/buildkite-agent',
          packageName:
            'docker.elastic.co/ci-agent-images/eck-region/buildkite-agent',
          depType: 'docker',
          replaceString:
            'docker.elastic.co/ci-agent-images/eck-region/buildkite-agent:1.15',
        },
      ]);
    });

    it('extracts image from agents given as an array of key=value tags', () => {
      const fileContent = codeBlock`
        agents:
          - "queue=default"
          - "image=some/image:1.0"
        steps:
          - command: test.sh
            agents:
              - "image=other/image:2.0"
              - "queue=deploy"
      `;
      const res = extractPackageFile(fileContent)?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '1.0',
          datasource: 'docker',
          depName: 'some/image',
          packageName: 'some/image',
          depType: 'docker',
          replaceString: 'some/image:1.0',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '2.0',
          datasource: 'docker',
          depName: 'other/image',
          packageName: 'other/image',
          depType: 'docker',
          replaceString: 'other/image:2.0',
        },
      ]);
    });

    it('extracts image from pipeline-level and step-level image fields', () => {
      const fileContent = codeBlock`
        image: "node:18-alpine"
        steps:
          - command: npm test
            image: "python:3.11"
      `;
      const res = extractPackageFile(fileContent)?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '18-alpine',
          datasource: 'docker',
          depName: 'node',
          packageName: 'node',
          depType: 'docker',
          replaceString: 'node:18-alpine',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '3.11',
          datasource: 'docker',
          depName: 'python',
          packageName: 'python',
          depType: 'docker',
          replaceString: 'python:3.11',
        },
      ]);
    });

    it('extracts image from agents nested inside a group step', () => {
      const fileContent = codeBlock`
        steps:
          - group: "Build"
            steps:
              - command: build.sh
                agents:
                  image: "golang:1.21"
      `;
      const res = extractPackageFile(fileContent)?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '1.21',
          datasource: 'docker',
          depName: 'golang',
          packageName: 'golang',
          depType: 'docker',
          replaceString: 'golang:1.21',
        },
      ]);
    });

    it('does not extract an image when agents has no image tag', () => {
      const fileContent = codeBlock`
        agents:
          queue: "default"
        steps:
          - command: test.sh
            agents:
              queue: "deploy"
      `;
      expect(extractPackageFile(fileContent)).toBeNull();
    });

    it('does not extract an image from an agents array with no image tag', () => {
      const fileContent = codeBlock`
        agents:
          - "solo-tag"
          - "queue=default"
      `;
      expect(extractPackageFile(fileContent)).toBeNull();
    });

    it('does not re-extract a plugin reachable via more than one YAML alias', () => {
      const fileContent = codeBlock`
        plugins: &shared
          docker-compose#v1.3.2:
            run: app
        steps:
          - plugins: *shared
          - plugins: *shared
      `;
      const res = extractPackageFile(fileContent)?.deps;
      expect(res).toEqual([
        {
          currentValue: 'v1.3.2',
          datasource: 'github-tags',
          depName: 'docker-compose',
          packageName: 'buildkite-plugins/docker-compose-buildkite-plugin',
        },
      ]);
    });

    it('does not throw on invalid YAML', () => {
      const fileContent = codeBlock`
        steps: []
        steps: []
      `;
      expect(extractPackageFile(fileContent)).toBeNull();
    });

    it('extracts both images and plugins from the same file, images first', () => {
      const fileContent = codeBlock`
        agents:
          image: "node:18"
        steps:
          - plugins:
              docker-compose#v1.3.2:
                run: app
      `;
      const res = extractPackageFile(fileContent)?.deps;
      expect(res).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '18',
          datasource: 'docker',
          depName: 'node',
          packageName: 'node',
          depType: 'docker',
          replaceString: 'node:18',
        },
        {
          currentValue: 'v1.3.2',
          datasource: 'github-tags',
          depName: 'docker-compose',
          packageName: 'buildkite-plugins/docker-compose-buildkite-plugin',
        },
      ]);
    });
  });
});
