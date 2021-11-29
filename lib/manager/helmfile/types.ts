export interface Doc {
  releases?: {
    name: string;
    chart: string;
    version: string;
  }[];
  repositories?: {
    name: string;
    url: string;
  }[];
}
