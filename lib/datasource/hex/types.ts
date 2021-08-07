export interface HexRelease {
  html_url: string;
  meta?: { links?: Record<string, string> };
  releases?: {
    version: string;
    inserted_at?: string;
  }[];
}
