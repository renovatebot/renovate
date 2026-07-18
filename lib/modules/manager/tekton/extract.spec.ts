import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/tekton/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts deps from a file', () => {
      const result = extractPackageFile(
        Fixtures.get('multi-doc.yaml'),
        'test-file.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest:
              'sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
            currentValue: '1.0',
            datasource: 'docker',
            depName: 'gcr.io/tekton-releases/catalog/upstream/pipeline',
            depType: 'tekton-bundle',
            packageName: 'gcr.io/tekton-releases/catalog/upstream/pipeline',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/pipeline:1.0@sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest:
              'sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
            currentValue: '1.0',
            datasource: 'docker',
            depName: 'gcr.io/tekton-releases/catalog/upstream/pipeline-finally',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-finally',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-finally:1.0@sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest:
              'sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
            currentValue: '1.0',
            datasource: 'docker',
            depName:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver:1.0@sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName: 'gcr.io/tekton-releases/catalog/upstream/list-pipeline',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/list-pipeline',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/list-pipeline',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'gcr.io/tekton-releases/catalog/upstream/list-pipeline-run',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/list-pipeline-run',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/list-pipeline-run',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName: 'gcr.io/tekton-releases/catalog/upstream/list-task-run',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/list-task-run',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/list-task-run',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-task-run',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-task-run',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-task-run',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-task-run-resolver',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-task-run-resolver',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-task-run-resolver',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-pipeline-run',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-pipeline-run',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-pipeline-run',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-pipeline-run-resolver',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-pipeline-run-resolver',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/trigger-template-pipeline-run-resolver',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName: 'gcr.io/tekton-releases/catalog/upstream/task-run',
            depType: 'tekton-bundle',
            packageName: 'gcr.io/tekton-releases/catalog/upstream/task-run',
            replaceString: 'gcr.io/tekton-releases/catalog/upstream/task-run',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'gcr.io/tekton-releases/catalog/upstream/task-run-resolver',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/task-run-resolver',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/task-run-resolver',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName: 'gcr.io/tekton-releases/catalog/upstream/pipeline-run',
            depType: 'tekton-bundle',
            packageName: 'gcr.io/tekton-releases/catalog/upstream/pipeline-run',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-run',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-run-resolver',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-run-resolver',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-run-resolver',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName: 'gcr.io/tekton-releases/catalog/upstream/inline-pipeline',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/inline-pipeline',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/inline-pipeline',
          },
          {
            depType: 'tekton-bundle',
            skipReason: 'invalid-value',
          },
          {
            depType: 'tekton-bundle',
            skipReason: 'invalid-value',
          },
          {
            depType: 'tekton-bundle',
            skipReason: 'invalid-value',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest:
              'sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
            currentValue: '1.0',
            datasource: 'docker',
            depName:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver:1.0@sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest:
              'sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
            currentValue: '1.0',
            datasource: 'docker',
            depName:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver',
            depType: 'tekton-bundle',
            packageName:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver',
            replaceString:
              'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver:1.0@sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName: 'example.io/taskrun/spec/taskSpec/steps/0/image',
            depType: 'tekton-step-image',
            packageName: 'example.io/taskrun/spec/taskSpec/steps/0/image',
            replaceString: 'example.io/taskrun/spec/taskSpec/steps/0/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName: 'example.io/taskrun/spec/taskSpec/sidecars/0/image',
            depType: 'tekton-step-image',
            packageName: 'example.io/taskrun/spec/taskSpec/sidecars/0/image',
            replaceString: 'example.io/taskrun/spec/taskSpec/sidecars/0/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName: 'example.io/taskrun/spec/taskSpec/stepTemplate/image',
            depType: 'tekton-step-image',
            packageName: 'example.io/taskrun/spec/taskSpec/stepTemplate/image',
            replaceString:
              'example.io/taskrun/spec/taskSpec/stepTemplate/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName: 'example.io/task/spec/steps/0/image',
            depType: 'tekton-step-image',
            packageName: 'example.io/task/spec/steps/0/image',
            replaceString: 'example.io/task/spec/steps/0/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName: 'example.io/task/spec/sidecars/0/image',
            depType: 'tekton-step-image',
            packageName: 'example.io/task/spec/sidecars/0/image',
            replaceString: 'example.io/task/spec/sidecars/0/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName: 'example.io/task/spec/stepTemplate/image',
            depType: 'tekton-step-image',
            packageName: 'example.io/task/spec/stepTemplate/image',
            replaceString: 'example.io/task/spec/stepTemplate/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName: 'example.com/pipeline/spec/tasks/0/taskSpec/steps/0/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/pipeline/spec/tasks/0/taskSpec/steps/0/image',
            replaceString:
              'example.com/pipeline/spec/tasks/0/taskSpec/steps/0/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'example.com/pipeline/spec/tasks/0/taskSpec/sidecars/0/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/pipeline/spec/tasks/0/taskSpec/sidecars/0/image',
            replaceString:
              'example.com/pipeline/spec/tasks/0/taskSpec/sidecars/0/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'example.com/pipeline/spec/tasks/0/taskSpec/stepTemplate/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/pipeline/spec/tasks/0/taskSpec/stepTemplate/image',
            replaceString:
              'example.com/pipeline/spec/tasks/0/taskSpec/stepTemplate/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'example.com/pipeline/spec/finally/0/taskSpec/steps/0/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/pipeline/spec/finally/0/taskSpec/steps/0/image',
            replaceString:
              'example.com/pipeline/spec/finally/0/taskSpec/steps/0/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'example.com/pipeline/spec/finally/0/taskSpec/sidecars/0/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/pipeline/spec/finally/0/taskSpec/sidecars/0/image',
            replaceString:
              'example.com/pipeline/spec/finally/0/taskSpec/sidecars/0/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'example.com/pipeline/spec/finally/0/taskSpec/stepTemplate/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/pipeline/spec/finally/0/taskSpec/stepTemplate/image',
            replaceString:
              'example.com/pipeline/spec/finally/0/taskSpec/stepTemplate/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'example.com/pipelinerun/spec/pipelineSpec/tasks/0/taskSpec/steps/0/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/pipelinerun/spec/pipelineSpec/tasks/0/taskSpec/steps/0/image',
            replaceString:
              'example.com/pipelinerun/spec/pipelineSpec/tasks/0/taskSpec/steps/0/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'example.com/pipelinerun/spec/pipelineSpec/tasks/0/taskSpec/sidecars/0/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/pipelinerun/spec/pipelineSpec/tasks/0/taskSpec/sidecars/0/image',
            replaceString:
              'example.com/pipelinerun/spec/pipelineSpec/tasks/0/taskSpec/sidecars/0/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'example.com/pipelinerun/spec/pipelineSpec/tasks/0/taskSpec/stepTemplate/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/pipelinerun/spec/pipelineSpec/tasks/0/taskSpec/stepTemplate/image',
            replaceString:
              'example.com/pipelinerun/spec/pipelineSpec/tasks/0/taskSpec/stepTemplate/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'example.com/pipelinerun/spec/pipelineSpec/finally/0/taskSpec/steps/0/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/pipelinerun/spec/pipelineSpec/finally/0/taskSpec/steps/0/image',
            replaceString:
              'example.com/pipelinerun/spec/pipelineSpec/finally/0/taskSpec/steps/0/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'example.com/pipelinerun/spec/pipelineSpec/finally/0/taskSpec/sidecars/0/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/pipelinerun/spec/pipelineSpec/finally/0/taskSpec/sidecars/0/image',
            replaceString:
              'example.com/pipelinerun/spec/pipelineSpec/finally/0/taskSpec/sidecars/0/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'example.com/pipelinerun/spec/pipelineSpec/finally/0/taskSpec/stepTemplate/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/pipelinerun/spec/pipelineSpec/finally/0/taskSpec/stepTemplate/image',
            replaceString:
              'example.com/pipelinerun/spec/pipelineSpec/finally/0/taskSpec/stepTemplate/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'example.com/triggertemplate/spec/resourcetemplates/0/taskrun/spec/taskSpec/steps/0/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/triggertemplate/spec/resourcetemplates/0/taskrun/spec/taskSpec/steps/0/image',
            replaceString:
              'example.com/triggertemplate/spec/resourcetemplates/0/taskrun/spec/taskSpec/steps/0/image',
          },
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: undefined,
            datasource: 'docker',
            depName:
              'example.com/triggertemplate/spec/resourcetemplates/0/taskrun/spec/taskSpec/steps/0/image',
            depType: 'tekton-step-image',
            packageName:
              'example.com/triggertemplate/spec/resourcetemplates/0/taskrun/spec/taskSpec/steps/0/image',
            replaceString:
              'example.com/triggertemplate/spec/resourcetemplates/0/taskrun/spec/taskSpec/steps/0/image',
          },
        ],
      });
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
