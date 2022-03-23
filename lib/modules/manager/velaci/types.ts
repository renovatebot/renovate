export type VelaPipelineConfiguration = VelaPipelineConfiguration1 &
  VelaPipelineConfiguration2;
export type Step = Template | Image;
export type VelaPipelineConfiguration2 = Stages | Steps;

export interface VelaPipelineConfiguration1 {
  /**
   * Provide syntax version used to evaluate the pipeline.
   * Reference: https://go-vela.github.io/docs/reference/yaml/version/
   */
  version: string;
  /**
   * Pass extra information.
   * Reference: https://go-vela.github.io/docs/reference/yaml/metadata/
   */
  metadata?: {
    /**
     * Enables compiling the pipeline as a template.
     * Reference: https://go-vela.github.io/docs/reference/yaml/metadata/#the-template-tag
     */
    template?: boolean;
    /**
     * Enables injecting the default clone process.
     * Reference: https://go-vela.github.io/docs/reference/yaml/metadata/#the-clone-tag
     */
    clone?: boolean;
    /**
     * Controls which containers processes can have global env injected.
     * Reference: https://go-vela.github.io/docs/reference/yaml/metadata/#the-environment-tag
     */
    environment?: string[];
  };
  /**
   * Provide global environment variables injected into the container environment.
   * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-environment-tag
   */
  environment?:
    | {
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` ".*".
         */
        [k: string]: string;
      }
    | string[];
  /**
   * Limit the pipeline to certain types of workers.
   * Reference: https://go-vela.github.io/docs/reference/yaml/worker/
   */
  worker?: {
    /**
     * Flavor identifier for worker.
     * Reference: https://go-vela.github.io/docs/reference/yaml/worker/#the-flavor-tag
     */
    flavor?: string;
    /**
     * Platform identifier for the worker.
     * Reference: https://go-vela.github.io/docs/reference/yaml/worker/#the-platform-tag
     */
    platform?: string;
  };
  /**
   * Provide sensitive information.
   * Reference: https://go-vela.github.io/docs/reference/yaml/secrets/
   */
  secrets?: {
    /**
     * Name of secret to reference in the pipeline.
     * Reference: https://go-vela.github.io/docs/reference/yaml/secrets/#the-name-tag
     */
    name: string;
    /**
     * Path to secret to fetch from storage backend.
     * Reference: https://go-vela.github.io/docs/reference/yaml/secrets/#the-key-tag
     */
    key?: string;
    /**
     * Name of storage backend to fetch secret from.
     * Reference: https://go-vela.github.io/docs/reference/yaml/secrets/#the-engine-tag
     */
    engine?: 'native' | 'vault';
    /**
     * Type of secret to fetch from storage backend.
     * Reference: https://go-vela.github.io/docs/reference/yaml/secrets/#the-type-tag
     */
    type?: 'repo' | 'org' | 'shared';
    /**
     * Declaration to pull secrets from non-internal secret providers.
     * Reference: https://go-vela.github.io/docs/reference/yaml/secrets/#the-origin-tag
     */
    origin?: {
      /**
       * Variables to inject into the container environment.
       * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-environment-tag
       */
      environment?:
        | {
            /**
             * This interface was referenced by `undefined`'s JSON-Schema definition
             * via the `patternProperty` ".*".
             */
            [k: string]: string;
          }
        | string[];
      /**
       * Docker image to use to create the ephemeral container.
       * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-image-tag
       */
      image: string;
      /**
       * Unique name for the secret origin.
       * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-name-tag
       */
      name: string;
      /**
       * Extra configuration variables for the secret plugin.
       * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-parameters-tag
       */
      parameters?: {
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` ".*".
         */
        [k: string]: {
          [k: string]: unknown;
        };
      };
      /**
       * Secrets to inject that are necessary to retrieve the secrets.
       * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-secrets-tag
       */
      secrets?: string[] | StepSecret[];
      /**
       * Declaration to configure if and when the Docker image is pulled.
       * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-pull-tag
       */
      pull?: 'always' | 'not_present' | 'on_start' | 'never';
      /**
       * Conditions to limit the execution of the container.
       * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
       */
      ruleset?:
        | {
            /**
             * Limit execution to when all rules match.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            if?: {
              /**
               * Limits the execution of a step to matching build branches.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              branch?: string | string[];
              /**
               * Limits the execution of a step to matching a pull request comment.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              comment?: string | string[];
              /**
               * Limits the execution of a step to matching build events.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              event?:
                | ('push' | 'pull_request' | 'tag' | 'deployment' | 'comment')
                | (
                    | 'push'
                    | 'pull_request'
                    | 'tag'
                    | 'deployment'
                    | 'comment'
                  )[];
              /**
               * Limits the execution of a step to matching files changed in a repository.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              path?: string | string[];
              /**
               * Limits the execution of a step to matching repos.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              repo?: string | string[];
              /**
               * Limits the execution of a step to matching build statuses.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              status?: ('failure' | 'success') | ('failure' | 'success')[];
              /**
               * Limits the execution of a step to matching build tag references.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              tag?: string | string[];
              /**
               * Limits the execution of a step to matching build deployment targets.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              target?: string | string[];
            };
            /**
             * Limit execution to when all rules do not match.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            unless?: {
              /**
               * Limits the execution of a step to matching build branches.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              branch?: string | string[];
              /**
               * Limits the execution of a step to matching a pull request comment.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              comment?: string | string[];
              /**
               * Limits the execution of a step to matching build events.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              event?:
                | ('push' | 'pull_request' | 'tag' | 'deployment' | 'comment')
                | (
                    | 'push'
                    | 'pull_request'
                    | 'tag'
                    | 'deployment'
                    | 'comment'
                  )[];
              /**
               * Limits the execution of a step to matching files changed in a repository.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              path?: string | string[];
              /**
               * Limits the execution of a step to matching repos.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              repo?: string | string[];
              /**
               * Limits the execution of a step to matching build statuses.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              status?: ('failure' | 'success') | ('failure' | 'success')[];
              /**
               * Limits the execution of a step to matching build tag references.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              tag?: string | string[];
              /**
               * Limits the execution of a step to matching build deployment targets.
               * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
               */
              target?: string | string[];
            };
            /**
             * Use the defined matching method.
             * Reference: coming soon
             */
            matcher?: 'filepath' | 'regexp';
            /**
             * Whether all rule conditions must be met or just any one of them.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            operator?: 'or' | 'and';
            /**
             * Limits the execution of a step to continuing on any failure.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            continue?: boolean;
          }
        | {
            /**
             * Use the defined matching method.
             * Reference: coming soon
             */
            matcher?: 'filepath' | 'regexp';
            /**
             * Whether all rule conditions must be met or just any one of them.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            operator?: 'or' | 'and';
            /**
             * Limits the execution of a step to continuing on any failure.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            continue?: boolean;
            /**
             * Limits the execution of a step to matching build branches.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            branch?: string | string[];
            /**
             * Limits the execution of a step to matching a pull request comment.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            comment?: string | string[];
            /**
             * Limits the execution of a step to matching build events.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            event?:
              | ('push' | 'pull_request' | 'tag' | 'deployment' | 'comment')
              | ('push' | 'pull_request' | 'tag' | 'deployment' | 'comment')[];
            /**
             * Limits the execution of a step to matching files changed in a repository.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            path?: string | string[];
            /**
             * Limits the execution of a step to matching repos.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            repo?: string | string[];
            /**
             * Limits the execution of a step to matching build statuses.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            status?: ('failure' | 'success') | ('failure' | 'success')[];
            /**
             * Limits the execution of a step to matching build tag references.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            tag?: string | string[];
            /**
             * Limits the execution of a step to matching build deployment targets.
             * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ruleset-tag
             */
            target?: string | string[];
          };
    };
  }[];
  /**
   * Provide detached (headless) execution instructions.
   * Reference: https://go-vela.github.io/docs/reference/yaml/services/
   */
  services?: {
    /**
     * Docker image used to create ephemeral container.
     * Reference: https://go-vela.github.io/docs/reference/yaml/services/#the-image-tag
     */
    image: string;
    /**
     * Unique identifier for the container in the pipeline.
     * Reference: https://go-vela.github.io/docs/reference/yaml/services/#the-name-tag
     */
    name: string;
    /**
     * Commands to execute inside the container.
     * Reference: https://go-vela.github.io/docs/reference/yaml/services/#the-entrypoint-tag
     */
    entrypoint?: string | string[];
    /**
     * Variables to inject into the container environment.
     * Reference: https://go-vela.github.io/docs/reference/yaml/services/#the-environment-tag
     */
    environment?:
      | {
          /**
           * This interface was referenced by `undefined`'s JSON-Schema definition
           * via the `patternProperty` ".*".
           */
          [k: string]: string;
        }
      | string[];
    /**
     * List of ports to map for the container in the pipeline.
     * Reference: https://go-vela.github.io/docs/reference/yaml/services/#the-ports-tag
     */
    ports?: string | string[];
    /**
     * Declaration to configure if and when the Docker image is pulled.
     * Reference: https://go-vela.github.io/docs/reference/yaml/services/#the-pul-tag
     */
    pull?: 'always' | 'not_present' | 'on_start' | 'never';
    /**
     * Set the user limits for the container.
     * Reference: https://go-vela.github.io/docs/reference/yaml/services/#the-ulimits-tag
     */
    ulimits?: (
      | string
      | {
          /**
           * Unique name of the user limit.
           * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ulimits-tag
           */
          name: string;
          /**
           * Set the soft limit.
           * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ulimits-tag
           */
          soft?: number;
          /**
           * Set the hard limit.
           * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-ulimits-tag
           */
          hard?: number;
        }
    )[];
    /**
     * Set the user for the container.
     * Reference: https://go-vela.github.io/docs/reference/yaml/steps/#the-user-tag
     */
    user?: string;
  }[];
  /**
   * Provide parallel execution instructions.
   * Reference: https://go-vela.github.io/docs/reference/yaml/stages/
   */
  stages?: {
    [k: string]: Stage;
  };
  /**
   * Provide sequential execution instructions.
   * Reference: https://go-vela.github.io/docs/reference/yaml/steps/
   */
  steps?: Step[];
  /**
   * Provide the name of templates to expand.
   * Reference: https://go-vela.github.io/docs/reference/yaml/templates/
   */
  templates?: {
    /**
     * Unique identifier for the template.
     * Reference: https://go-vela.github.io/docs/reference/yaml/templates/#the-name-tag
     */
    name: string;
    /**
     * Path to template in remote system.
     * Reference: https://go-vela.github.io/docs/reference/yaml/templates/#the-source-tag
     */
    source: string;
    /**
     * language used within the template file
     * Reference: https://go-vela.github.io/docs/reference/yaml/templates/#the-format-tag
     */
    format?: 'starlark' | 'golang' | 'go';
    /**
     * Type of template provided from the remote system.
     * Reference: https://go-vela.github.io/docs/reference/yaml/templates/#the-type-tag
     */
    type?: string;
  }[];
  [k: string]: unknown;
}
export interface StepSecret {
  source?: string;
  target?: string;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` ".*".
 */
export interface Stage {
  /**
   * Unique identifier for the stage in the pipeline.
   * Reference: https://go-vela.github.io/docs/reference/yaml/stages/#the-name-tag
   */
  name?: string;
  /**
   * Stages that must complete before starting the current one.
   * Reference: https://go-vela.github.io/docs/reference/yaml/stages/#the-needs-tag
   */
  needs?: string | string[];
  /**
   * Sequential execution instructions for the stage.
   * Reference: https://go-vela.github.io/docs/reference/yaml/stages/#the-steps-tag
   */
  steps: (Template | Image)[];
}
export interface Template {
  [k: string]: unknown;
}
export interface Image {
  [k: string]: unknown;
}
export interface Stages {
  [k: string]: unknown;
}
export interface Steps {
  [k: string]: unknown;
}
