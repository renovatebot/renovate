export type GitTreeNode = {
  type: 'tree' | 'blob';
  path: string;
  mode: string;
};

export type GitProtocol = 'ssh' | 'http' | 'https';
