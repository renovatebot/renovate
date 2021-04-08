export interface NpmResponse {
  _id: string;
  name?: string;
  versions?: Record<
    string,
    {
      repository?: {
        url: string;
        directory: string;
      };
      homepage?: string;
      deprecated?: boolean;
      gitHead?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }
  >;
  repository?: {
    url?: string;
    directory?: string;
  };
  homepage?: string;
  time?: Record<string, string>;
}
