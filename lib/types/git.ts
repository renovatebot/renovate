export type GitTreeNode = {
  type: 'tree' | 'blob';
  path: string;
  mode: string;
};

export type GitProtocol = 'ssh' | 'http' | 'https';

export type GitOptions = Record<string, null | string | number>;
