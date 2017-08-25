# extend node alpine base image
FROM node:8.4.0-alpine

ENV RENOVATE_VERSION 9.45.10

MAINTAINER Rhys Arkins <rhys@arkins.net>
LABEL NAME renovate
LABEL VERSION $RENOVATE_VERSION

# globally install the specified version of renovate
RUN set -x \
  && npm install -g renovate@$RENOVATE_VERSION

# inject the custom entrypoint
# ensure that it is executable by user 1000
# user 1000 is already setup for usage in node base images
COPY entrypoint.sh /entrypoint.sh
RUN set -x \
  && chown 1000:0 /entrypoint.sh \
  && chmod u+x /entrypoint.sh

# switch to user 1000
# this prevents several problems in specialized environments
USER 1000

# define a custom entrypoint
# handles runtime configuration using env
ENTRYPOINT ["/entrypoint.sh"]

# print usage instructions by default
CMD ["usage"]
