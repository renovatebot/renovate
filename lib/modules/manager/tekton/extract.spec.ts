import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/tekton/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts deps from a file', () => {
      const result = extractPackageFile(
        Fixtures.get('multi-doc.yaml'),
        'test-file.yaml',
      );
      expect(result?.deps).toMatchObject([
        {
          currentDigest:
            'sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
          currentValue: '1.0',
          depName: 'gcr.io/tekton-releases/catalog/upstream/pipeline',
          depType: 'tekton-bundle',
        },
        {
          currentDigest:
            'sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
          currentValue: '1.0',
          depName: 'gcr.io/tekton-releases/catalog/upstream/pipeline-finally',
          depType: 'tekton-bundle',
        },
        {
          currentDigest:
            'sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
          currentValue: '1.0',
          depName: 'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver',
          depType: 'tekton-bundle',
        },
        {
          depName: 'gcr.io/tekton-releases/catalog/upstream/list-pipeline',
          depType: 'tekton-bundle',
        },
        {
          depName: 'gcr.io/tekton-releases/catalog/upstream/list-pipeline-run',
          depType: 'tekton-bundle',
        },
        {
          depName: 'gcr.io/tekton-releases/catalog/upstream/list-task-run',
          depType: 'tekton-bundle',
        },
        {
          depName:
            'gcr.io/tekton-releases/catalog/upstream/trigger-template-task-run',
          depType: 'tekton-bundle',
        },
        {
          depName:
            'gcr.io/tekton-releases/catalog/upstream/trigger-template-task-run-resolver',
          depType: 'tekton-bundle',
        },
        {
          depName:
            'gcr.io/tekton-releases/catalog/upstream/trigger-template-pipeline-run',
          depType: 'tekton-bundle',
        },
        {
          depName:
            'gcr.io/tekton-releases/catalog/upstream/trigger-template-pipeline-run-resolver',
          depType: 'tekton-bundle',
        },
        {
          depName: 'gcr.io/tekton-releases/catalog/upstream/task-run',
          depType: 'tekton-bundle',
        },
        {
          depName: 'gcr.io/tekton-releases/catalog/upstream/task-run-resolver',
          depType: 'tekton-bundle',
        },
        {
          depName: 'gcr.io/tekton-releases/catalog/upstream/pipeline-run',
          depType: 'tekton-bundle',
        },
        {
          depName:
            'gcr.io/tekton-releases/catalog/upstream/pipeline-run-resolver',
          depType: 'tekton-bundle',
        },
        {
          depName: 'gcr.io/tekton-releases/catalog/upstream/inline-pipeline',
          depType: 'tekton-bundle',
        },
        { depType: 'tekton-bundle', skipReason: 'invalid-value' },
        { depType: 'tekton-bundle', skipReason: 'invalid-value' },
        { depType: 'tekton-bundle', skipReason: 'invalid-value' },
        {
          currentDigest:
            'sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
          currentValue: '1.0',
          depName: 'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver',
          depType: 'tekton-bundle',
        },
        {
          currentDigest:
            'sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
          currentValue: '1.0',
          depName: 'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver',
          depType: 'tekton-bundle',
        },
        {
          depName: 'example.io/taskrun/spec/taskSpec/steps/0/image',
          depType: 'tekton-step-image',
        },
        {
          depName: 'example.io/taskrun/spec/taskSpec/sidecars/0/image',
          depType: 'tekton-step-image',
        },
        {
          depName: 'example.io/taskrun/spec/taskSpec/stepTemplate/image',
          depType: 'tekton-step-image',
        },
        {
          depName: 'example.io/task/spec/steps/0/image',
          depType: 'tekton-step-image',
        },
        {
          depName: 'example.io/task/spec/sidecars/0/image',
          depType: 'tekton-step-image',
        },
        {
          depName: 'example.io/task/spec/stepTemplate/image',
          depType: 'tekton-step-image',
        },
        {
          depName: 'example.com/pipeline/spec/tasks/0/taskSpec/steps/0/image',
          depType: 'tekton-step-image',
        },
        {
          depName:
            'example.com/pipeline/spec/tasks/0/taskSpec/sidecars/0/image',
          depType: 'tekton-step-image',
        },
        {
          depName:
            'example.com/pipeline/spec/tasks/0/taskSpec/stepTemplate/image',
          depType: 'tekton-step-image',
        },
        {
          depName: 'example.com/pipeline/spec/finally/0/taskSpec/steps/0/image',
          depType: 'tekton-step-image',
        },
        {
          depName:
            'example.com/pipeline/spec/finally/0/taskSpec/sidecars/0/image',
          depType: 'tekton-step-image',
        },
        {
          depName:
            'example.com/pipeline/spec/finally/0/taskSpec/stepTemplate/image',
          depType: 'tekton-step-image',
        },
        {
          depName:
            'example.com/pipelinerun/spec/pipelineSpec/tasks/0/taskSpec/steps/0/image',
          depType: 'tekton-step-image',
        },
        {
          depName:
            'example.com/pipelinerun/spec/pipelineSpec/tasks/0/taskSpec/sidecars/0/image',
          depType: 'tekton-step-image',
        },
        {
          depName:
            'example.com/pipelinerun/spec/pipelineSpec/tasks/0/taskSpec/stepTemplate/image',
          depType: 'tekton-step-image',
        },
        {
          depName:
            'example.com/pipelinerun/spec/pipelineSpec/finally/0/taskSpec/steps/0/image',
          depType: 'tekton-step-image',
        },
        {
          depName:
            'example.com/pipelinerun/spec/pipelineSpec/finally/0/taskSpec/sidecars/0/image',
          depType: 'tekton-step-image',
        },
        {
          depName:
            'example.com/pipelinerun/spec/pipelineSpec/finally/0/taskSpec/stepTemplate/image',
          depType: 'tekton-step-image',
        },
        {
          depName:
            'example.com/triggertemplate/spec/resourcetemplates/0/taskrun/spec/taskSpec/steps/0/image',
          depType: 'tekton-step-image',
        },
        {
          depName:
            'example.com/triggertemplate/spec/resourcetemplates/0/taskrun/spec/taskSpec/steps/0/image',
          depType: 'tekton-step-image',
        },
      ]);
      expect(result?.deps).toHaveLength(40);
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
