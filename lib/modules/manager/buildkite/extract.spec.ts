import { codeBlock } from 'common-tags';
import type { PackageDependency } from '../types';
import { extractPackageFile } from '.';

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
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
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
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
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
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
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
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(4);
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
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
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
  });
});
