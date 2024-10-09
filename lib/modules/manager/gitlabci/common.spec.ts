import { codeBlock } from 'common-tags';
import { parseSingleYaml } from '../../../util/yaml';
import type { GitlabPipeline } from '../gitlabci/types';
import {
  filterIncludeFromGitlabPipeline,
  isGitlabIncludeComponent,
  isGitlabIncludeLocal,
  isGitlabIncludeProject,
  isNonEmptyObject,
} from './common';

// TODO: use schema (#9610)
const pipeline = parseSingleYaml<GitlabPipeline>(
  codeBlock`
    include:
    - project: mikebryant/include-source-example
      file: /template.yaml
      ref: 1.0.0
    -   project: mikebryant/include-source-example2
        file: /template.yaml
        ref: master
    - {"project":"mikebryant/include-source-example3", "file": "/template.yaml",}
    - {}

    script:
    - !reference [.setup, script]
    - !reference [arbitrary job name with space and no starting dot, nested1, nested2, nested3]`,
);
const includeLocal = { local: 'something' };
const includeProject = { project: 'something' };

describe('modules/manager/gitlabci/common', () => {
  describe('filterIncludeFromGitlabPipeline()', () => {
    it('returns GitlabPipeline without top level include key', () => {
      expect(pipeline).toHaveProperty('include');
      const filtered_pipeline = filterIncludeFromGitlabPipeline(pipeline);
      expect(filtered_pipeline).not.toHaveProperty('include');
      expect(filtered_pipeline).toEqual({
        script: [
          ['.setup', 'script'],
          [
            'arbitrary job name with space and no starting dot',
            'nested1',
            'nested2',
            'nested3',
          ],
        ],
      });
    });
  });

  describe('isGitlabIncludeLocal()', () => {
    it('returns true if GitlabInclude is GitlabIncludeLocal', () => {
      expect(isGitlabIncludeLocal(includeLocal)).toBe(true);
    });

    it('returns false if GitlabInclude is not GitlabIncludeLocal', () => {
      expect(isGitlabIncludeLocal(includeProject)).toBe(false);
    });
  });

  describe('isGitlabIncludeProject()', () => {
    it('returns true if GitlabInclude is GitlabIncludeProject', () => {
      expect(isGitlabIncludeProject(includeProject)).toBe(true);
    });

    it('returns false if GitlabInclude is not GitlabIncludeProject', () => {
      expect(isGitlabIncludeProject(includeLocal)).toBe(false);
    });
  });

  describe('isGitlabIncludeComponent()', () => {
    it('returns true if GitlabInclude is GitlabIncludeComponent', () => {
      expect(isGitlabIncludeComponent({ component: 'something' })).toBe(true);
    });

    it('returns false if GitlabInclude is not GitlabIncludeComponent', () => {
      expect(isGitlabIncludeComponent(includeLocal)).toBe(false);
    });
  });

  describe('isNonEmptyObject()', () => {
    it('returns true if not empty', () => {
      expect(isNonEmptyObject({ attribute1: 1 })).toBe(true);
    });

    it('returns false if empty', () => {
      expect(isNonEmptyObject({})).toBe(false);
    });
  });
});
