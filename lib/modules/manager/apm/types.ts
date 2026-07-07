export interface ApmMcpDependency {
  name?: string;
  transport?: string;
}

export interface ApmDependencies {
  /** Git-based agent package dependencies, e.g. `owner/repo#v1.0.0`. */
  apm?: unknown;
  /** MCP server dependencies. Not managed by Renovate (see readme). */
  mcp?: ApmMcpDependency[];
}

export interface ApmManifest {
  name?: string;
  version?: string;
  dependencies?: ApmDependencies;
  devDependencies?: ApmDependencies;
}
