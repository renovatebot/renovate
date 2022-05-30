export type GithubApiQueryResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: ItemsEntity[];
};

export type ItemsEntity = {
  html_url: string;
  number: number;
  title: string;
  labels: LabelsEntity[];
};

export type LabelsEntity = {
  name: string;
};
