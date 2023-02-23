export interface JiraSearchResponse {
  issues: JiraIssue[];
}

export interface JiraIssue {
  id: number;
  key: string;
  fields: {
    description: AtlassianDocumentFormat;
    summary: string;
  };
}

export interface JiraTransitionsResponse {
  transitions: JiraTransition[];
}

export const StatusCategoryKey = [
  'new',
  'indeterminate',
  'in-progress',
  'done',
] as const;

export interface JiraTransition {
  id: number;
  name: string;
  to: {
    statusCategory: {
      key: string; // TODO Add types
    };
  };
}

export interface AtlassianDocumentFormat {
  type: string;
  version: number;
  content?: AtlassianDocumentContent[];
}

export interface AtlassianDocumentContent {
  type?: string;
  text?: string;
  attrs?: AtlassianDocumentAttributes;
  marks?: AtlassianDocumentMarks[];
  content?: AtlassianDocumentContent[];
}

export interface AtlassianDocumentMarks {
  type: string;
  attrs?: AtlassianDocumentAttributes;
}

export interface AtlassianDocumentAttributes {
  href?: string;
  level?: number;
}

export interface MarkdownASTNode {
  type: string;
  value: string;
  children: MarkdownASTNode[];
  url?: string;
  depth?: number;
  ordered?: boolean;
}
