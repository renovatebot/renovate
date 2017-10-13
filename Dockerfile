# extend node alpine base image
# using 8-alpine allows renovate to update
FROM node:8-alpine

# TODO: use custom renovation?
ENV RENOVATE_VERSION 9.74.0

LABEL maintainer="Rhys Arkins <rhys@arkins.net>"
LABEL name="renovate"
LABEL version="$RENOVATE_VERSION"

# fix permissions for the global node directories
# this allows installing renovate globally as user 1000
RUN set -x \
  && export NPM_PREFIX=$(npm config get prefix) \
  && chown -R 1000:0 \
    $NPM_PREFIX/lib/node_modules \
    $NPM_PREFIX/bin \
    $NPM_PREFIX/share

# inject the custom entrypoint
# ensure that it is executable by user 1000
# user 1000 is already setup for usage in node base images
# TODO: replace with "COPY --chown" once released
COPY entrypoint.sh /entrypoint.sh
RUN set -x \
  && chown 1000:0 /entrypoint.sh \
  && chmod u+x /entrypoint.sh

# switch to user 1000 (non-root)
# this is generally considered more secure
# and prevents several problems in specialized environments
USER 1000

# globally install the specified version of renovate
RUN set -x \
  && npm install -g renovate@$RENOVATE_VERSION

# define a custom entrypoint (wrapping script)
ENTRYPOINT ["/entrypoint.sh"]

# print usage instructions by default
CMD ["--help"]
