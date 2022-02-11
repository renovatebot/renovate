export interface ConanJSON {
  results?: Record<string, string>;
}

export interface ConanYAML {
  versions?: Record<string, { folder?: string }>;
}
