export interface ToolConstraint {
  toolName: string;
  constraint?: string;
}

export interface ToolConfig {
  datasource: string;
  depName: string;
  hash?: boolean;
  versioning: string;
}
