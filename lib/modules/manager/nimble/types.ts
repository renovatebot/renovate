export interface NimblePackageEntry {
  name?: string;
  url?: string;
  method?: string;
  tags?: string[];
  description?: string;
  license?: string;
  web?: string;
  alias?: string;
  [key: string]: unknown;
}
