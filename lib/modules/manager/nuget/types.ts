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

export interface MsbuildGlobalManifest {
  readonly sdk?: MsbuildSdk;
  readonly 'msbuild-sdks'?: Record<string, string>;
}

export interface MsbuildSdk {
  readonly version: string;
  readonly rollForward: string;
}

export interface ProjectFile {
  readonly isLeaf: boolean;
  readonly name: string;
}
