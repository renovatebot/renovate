export type GitTreeNode = {
  type: 'tree' | 'blob';
  path: string;
  mode: string;
};
