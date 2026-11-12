import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/tekton/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts deps from a file', () => {
      const autoReplaceStringTemplate =
        '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}';
      const result = extractPackageFile(
        Fixtures.get('multi-doc.yaml'),
        'test-file.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'gcr.io/tekton-releases/catalog/upstream/pipeline',
            packageName: 'gcr.io/tekton-releases/catalog/upstream/pipeline',
            currentValue: '1.0',
            currentDigest:
              'sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/pipeline:1.0@sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
            autoReplaceStringTemplate,
            datasource: 'docker',
            depType: 'tekton-bundle',
          },
          {
            depName: 'gcr.io/tekton-releases/catalog/upstream/pipeline-finally',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-finally',
            currentValue: '1.0',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-finally:1.0',
            autoReplaceStringTemplate,
            datasource: 'docker',
            depType: 'tekton-bundle',
          },
          {
            depName: 'gcr.io/tekton-releases/catalog/upstream/list-task-run',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/list-task-run',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/list-task-run',
            autoReplaceStringTemplate,
            datasource: 'docker',
            depType: 'tekton-bundle',
          },
          {
            depName: 'example.io/taskrun/spec/taskSpec/steps/0/image',
            packageName: 'example.io/taskrun/spec/taskSpec/steps/0/image',
            replaceString: 'example.io/taskrun/spec/taskSpec/steps/0/image',
            autoReplaceStringTemplate,
            datasource: 'docker',
            depType: 'tekton-step-image',
          },
          {
            depName: 'example.io/taskrun/spec/taskSpec/sidecars/0/image',
            packageName: 'example.io/taskrun/spec/taskSpec/sidecars/0/image',
            replaceString: 'example.io/taskrun/spec/taskSpec/sidecars/0/image',
            autoReplaceStringTemplate,
            datasource: 'docker',
            depType: 'tekton-step-image',
          },
          {
            depName: 'example.io/taskrun/spec/taskSpec/stepTemplate/image',
            packageName: 'example.io/taskrun/spec/taskSpec/stepTemplate/image',
            replaceString:
              'example.io/taskrun/spec/taskSpec/stepTemplate/image',
            autoReplaceStringTemplate,
            datasource: 'docker',
            depType: 'tekton-step-image',
          },
          {
            depName: 'example.io/task/spec/steps/0/image',
            packageName: 'example.io/task/spec/steps/0/image',
            currentValue: 'v1.2.3',
            replaceString: 'example.io/task/spec/steps/0/image:v1.2.3',
            autoReplaceStringTemplate,
            datasource: 'docker',
            depType: 'tekton-step-image',
          },
          {
            depName:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-run-resolver',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-run-resolver',
            currentValue: '1.0',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-run-resolver:1.0',
            autoReplaceStringTemplate,
            datasource: 'docker',
            depType: 'tekton-bundle',
          },
          {
            skipReason: 'invalid-value',
            depType: 'tekton-bundle',
          },
          {
            depName:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-task-run',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-task-run',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-task-run',
            autoReplaceStringTemplate,
            datasource: 'docker',
            depType: 'tekton-bundle',
          },
          {
            depName: 'example.io/stepaction/spec/image',
            packageName: 'example.io/stepaction/spec/image',
            replaceString: 'example.io/stepaction/spec/image',
            autoReplaceStringTemplate,
            datasource: 'docker',
            depType: 'tekton-step-image',
          },
        ],
      });
    });

    it('extracts deps from a file in annotations', () => {
      const result = extractPackageFile(
        Fixtures.get('multi-doc-annotations.yaml'),
        'test-file.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v0.0.4',
            datasource: 'github-releases',
            depName: 'github.com/foo/bar',
            depType: 'tekton-annotation',
            packageName: 'foo/bar',
          },
          {
            currentValue: 'v0.0.12',
            datasource: 'git-tags',
            depName: 'github.com/foo/baz',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/baz',
          },
          {
            currentValue: 'v0.0.6',
            datasource: 'git-tags',
            depName: 'github.com/foo/bar',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/bar',
          },
          {
            currentValue: 'v0.0.12',
            datasource: 'git-tags',
            depName: 'github.com/foo/baz',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/baz',
          },
          {
            currentValue: 'v0.0.8',
            datasource: 'git-tags',
            depName: 'github.com/foo/bar',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/bar',
          },
          {
            currentValue: 'v0.0.14',
            datasource: 'git-tags',
            depName: 'github.com/foo/baz',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/baz',
          },
          {
            currentValue: 'v0.0.9',
            datasource: 'github-releases',
            depName: 'github.com/foo/bar',
            depType: 'tekton-annotation',
            packageName: 'foo/bar',
          },
          {
            currentValue: 'v0.0.7',
            datasource: 'git-tags',
            depName: 'github.com/foo/bar',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/bar',
          },
          {
            currentValue: 'v0.0.5',
            datasource: 'git-tags',
            depName: 'github.com/foo/bar',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/bar',
          },
          {
            currentValue: 'v0.0.25',
            datasource: 'git-tags',
            depName: 'github.com/foo/baz',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/baz',
          },
        ],
      });
    });

    it('ignores file without any deps', () => {
      expect(extractPackageFile('foo: bar', 'test-file.yaml')).toBeNull();
    });

    it('ignores invalid YAML', () => {
      expect(
        extractPackageFile(
          `
        ---
        bundle: registry.com/repo
      `,
          'test-file.yaml',
        ),
      ).toBeNull();
    });

    it('ignores empty file', () => {
      expect(extractPackageFile('', 'test-file.yaml')).toBeNull();
    });
  });
});
