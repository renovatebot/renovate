// `@semantic-release/commit-analyzer` ships no type declarations, so we declare
// the single function we use. The signature matches its `analyzeCommits` export.
declare module '@semantic-release/commit-analyzer' {
  export function analyzeCommits(
    pluginConfig: unknown,
    context: {
      commits: { message: string; hash: string }[];
      logger: { log: (...args: unknown[]) => void };
      cwd: string;
      env: NodeJS.ProcessEnv;
    },
  ): Promise<'major' | 'minor' | 'patch' | null>;
}
