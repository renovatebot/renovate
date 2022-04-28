export interface GalaxyResult {
  results: {
    summary_fields: {
      versions: {
        name: string;
        release_date: string;
      }[];
    };
    github_user: string;
    github_repo: string;
  }[];
}
