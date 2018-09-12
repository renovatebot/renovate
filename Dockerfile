FROM node:8.12.0-alpine@sha256:c2ea45a3953fd73f85e19b2993ed063261951f628628c3ad6fc11e96df86f5bc

LABEL maintainer="Rhys Arkins <rhys@arkins.net>"
LABEL name="renovate"

WORKDIR /usr/src/app/

RUN apk add --quiet --no-cache git openssh-client
COPY package.json .
COPY yarn.lock .
RUN yarn install --production && yarn cache clean
COPY lib lib
USER node

ENTRYPOINT ["node", "/usr/src/app/lib/renovate.js"]
CMD ["--help"]
