export interface DotnetToolsManifest {
  readonly version: number;
  readonly isRoot: boolean;

  readonly tools: Record<string, DotnetTool>;
}

export interface DotnetTool {
  readonly version: string;
  readonly commands: string[];
}

export interface Registry {
  readonly url: string;
  readonly name?: string;
}
