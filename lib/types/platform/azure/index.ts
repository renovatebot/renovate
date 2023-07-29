export type AzureItem = {
  objectId: string;
};

export type AzureTreeNode = {
  objectId: string;
  relativePath: string;
  gitObjectType: 'tree' | 'blob';
};

export type AzureTree = {
  objectId: string;
  treeEntries: AzureTreeNode[];
};

export interface AzureTag {
  name: string;
  value: string;
}
