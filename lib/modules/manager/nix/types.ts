export interface NixFlakeLock {
  readonly nodes: Record<string, NixInput>;
  readonly root: string;
  readonly version: number;
}

export interface NixInput {
  readonly inputs?: Record<string, string>;
  readonly locked?: LockedInput;
  readonly original?: OriginalInput;
}

export interface LockedInput {
  readonly lastModified: number;
  readonly narHash: string;
  readonly owner?: string;
  readonly repo?: string;
  readonly ref?: string;
  readonly rev: string;
  readonly revCount: number;
  readonly type: InputType;
  readonly url?: string;
}

export interface OriginalInput {
  readonly owner?: string;
  readonly repo?: string;
  readonly ref?: string;
  readonly type: InputType;
  readonly url?: string;
}

export enum InputType {
  git = 'git',
  github = 'github',
  gitlab = 'gitlab',
  indirect = 'indirect',
  sourcehut = 'sourcehut',
}
