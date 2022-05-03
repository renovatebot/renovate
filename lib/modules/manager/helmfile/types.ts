interface Release {
  name: string;
  chart: string;
  version: string;
}

interface Repository {
  name: string;
  url: string;
  oci?: boolean;
}

export interface Doc {
  releases?: Release[];
  repositories?: Repository[];
}
