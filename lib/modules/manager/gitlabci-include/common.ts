import is from '@sindresorhus/is';
import type {
  GitlabInclude,
  GitlabIncludeLocal,
  GitlabIncludeProject,
  GitlabPipeline,
} from '../gitlabci/types';

export function isNonEmptyObject(obj: any): boolean {
  return is.object(obj) && Object.keys(obj).length !== 0;
}

export function filterIncludeFromGitlabPipeline(
  pipeline: GitlabPipeline
): GitlabPipeline {
  const pipeline_without_include = {} as GitlabPipeline;
  for (const key of Object.keys(pipeline).filter((key) => key !== 'include')) {
    const pipeline_key = key as keyof typeof pipeline;
    pipeline_without_include[pipeline_key] = pipeline[pipeline_key];
  }
  return pipeline_without_include;
}

export function isGitlabIncludeProject(
  include: GitlabInclude
): include is GitlabIncludeProject {
  return !is.undefined((include as GitlabIncludeProject).project);
}

export function isGitlabIncludeLocal(
  include: GitlabInclude
): include is GitlabIncludeLocal {
  return !is.undefined((include as GitlabIncludeLocal).local);
}
