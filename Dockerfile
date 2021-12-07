FROM containerbase/buildpack

RUN install-tool node v14.18.2

RUN install-tool yarn 1.22.17

COPY . /app

WORKDIR /app

RUN yarn build

ENTRYPOINT ["docker-entrypoint.sh", "node", "/app/dist/renovate.js"]
CMD []

ENV RENOVATE_BINARY_SOURCE=install LOG_LEVEL=debug

RUN unset NPM_CONFIG_PREFIX && npm config ls -l

RUN cat /usr/local/node/14.18.2/etc/npmrc

USER 1000

