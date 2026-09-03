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
      const deps = result?.deps;
      expect(deps).toHaveLength(40);
      expect(deps?.filter((e) => e.depType === 'tekton-bundle')).toHaveLength(
        20,
      );
      expect(
        deps?.filter((e) => e.depType === 'tekton-step-image'),
      ).toHaveLength(20);
      expect(deps?.filter((e) => e.skipReason)).toHaveLength(3);

      // first entry: bundle pinned by tag and digest
      expect(deps?.[0]).toEqual({
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
      });

      // bundle without a tag or digest
      expect(deps?.[3]).toEqual({
        depName: 'gcr.io/tekton-releases/catalog/upstream/list-pipeline',
        packageName: 'gcr.io/tekton-releases/catalog/upstream/list-pipeline',
        replaceString: 'gcr.io/tekton-releases/catalog/upstream/list-pipeline',
        autoReplaceStringTemplate,
        datasource: 'docker',
        depType: 'tekton-bundle',
      });

      // bundle reference that cannot be parsed
      expect(deps?.[15]).toEqual({
        skipReason: 'invalid-value',
        depType: 'tekton-bundle',
      });

      // bundle declared through a resolver parameter
      expect(deps?.[19]).toEqual({
        depName: 'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver',
        packageName:
          'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver',
        currentValue: '1.0',
        currentDigest:
          'sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
        replaceString:
          'gcr.io/tekton-releases/catalog/upstream/pipeline-resolver:1.0@sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
        autoReplaceStringTemplate,
        datasource: 'docker',
        depType: 'tekton-bundle',
      });

      // first step image
      expect(deps?.[20]).toEqual({
        depName: 'example.io/taskrun/spec/taskSpec/steps/0/image',
        packageName: 'example.io/taskrun/spec/taskSpec/steps/0/image',
        replaceString: 'example.io/taskrun/spec/taskSpec/steps/0/image',
        autoReplaceStringTemplate,
        datasource: 'docker',
        depType: 'tekton-step-image',
      });

      // last entry: step image nested in a trigger template
      expect(deps?.[39]).toEqual({
        depName:
          'example.com/triggertemplate/spec/resourcetemplates/0/taskrun/spec/taskSpec/steps/0/image',
        packageName:
          'example.com/triggertemplate/spec/resourcetemplates/0/taskrun/spec/taskSpec/steps/0/image',
        replaceString:
          'example.com/triggertemplate/spec/resourcetemplates/0/taskrun/spec/taskSpec/steps/0/image',
        autoReplaceStringTemplate,
        datasource: 'docker',
        depType: 'tekton-step-image',
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
