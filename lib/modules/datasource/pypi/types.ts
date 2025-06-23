export interface PypiJSONRelease {
  requires_python?: string;
  upload_time?: string;
  yanked?: boolean;
}
export type Releases = Record<string, PypiJSONRelease[]>;
export interface PypiJSON {
  info: {
    name: string;
    home_page?: string;
    project_urls?: Record<string, string>;
  };

  releases?: Releases;
}
