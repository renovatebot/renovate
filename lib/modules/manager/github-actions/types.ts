/**
 * Container describes a Docker container used within a {@link Job}.
 * {@link https://docs.github.com/en/actions/using-containerized-services}
 *
 * @param image - The Docker image to use as the container to run the action. The value can be the Docker Hub image name or a registry name.
 */
export interface Container {
  image: string;
}

/**
 * Job describes a single job within a {@link Workflow}.
 * {@link https://docs.github.com/en/actions/using-jobs}
 *
 * @param container - {@link https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idcontainer}
 * @param services - {@link https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idservices}
 */
export interface Job {
  container?: string | Container;
  services?: Record<string, string | Container>;
  'runs-on'?: string | string[];
}

/**
 * Workflow describes a GitHub Actions Workflow.
 * {@link https://docs.github.com/en/actions/using-workflows}
 *
 * @param jobs - {@link https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobs}
 */
export interface Workflow {
  jobs: Record<string, Job>;
}
