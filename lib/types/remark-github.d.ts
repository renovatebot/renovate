/**
 * Types for `remark-github`
 *
 * @see https://github.com/remarkjs/remark-github
 */
declare module 'remark-github' {
  import type { Plugin } from 'unified';

  namespace github {
    export interface Options {
      /**
       * Wrap mentions in `<strong>`, true by default.
       * @see https://github.com/remarkjs/remark-github#mentions
       */
      mentionStrong?: boolean;

      /**
       * Repository to link against.
       *
       * @see https://github.com/remarkjs/remark-github#repository
       */
      repository?: string;
    }
  }

  const github: Plugin<[github.Options?]>;

  export = github;
}
