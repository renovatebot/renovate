FROM node:8-alpine as dependencies
WORKDIR /usr/src/app/
RUN yarn add renovate --production --no-lockfile

FROM alpine:3.7
RUN addgroup -g 1000 node && adduser -H -u 1000 -G node -s /bin/sh -D node
WORKDIR /usr/src/app/
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/
COPY --from=dependencies /usr/lib/libgcc* /usr/lib/libstdc* /usr/lib/
COPY --from=dependencies /usr/src/app/node_modules ./node_modules

USER node
CMD ["./node_modules/.bin/renovate"]
