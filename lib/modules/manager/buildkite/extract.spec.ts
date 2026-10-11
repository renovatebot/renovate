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
  });
});
