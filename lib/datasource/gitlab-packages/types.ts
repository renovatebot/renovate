export interface GitlabPackage {
  version: string;
  created_at: string;
  name: string;
  _links: Record<string, string> | undefined;
}
