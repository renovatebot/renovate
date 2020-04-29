export const presets = {
  disable: {
    docker: {
      enabled: false,
    },
    'docker-compose': {
      enabled: false,
    },
    circleci: {
      enabled: false,
    },
  },
  enableMajor: {
    docker: {
      major: {
        enabled: true,
      },
    },
  },
  disableMajor: {
    docker: {
      major: {
        enabled: false,
      },
    },
  },
  pinDigests: {
    description: 'Pin Docker digests',
    docker: {
      pinDigests: true,
    },
  },
};
