export interface Doc {
  releases?: {
    chart: string;
    version: string;
  }[];
  repositories?: {
    name: string;
    url: string;
  }[];
}
