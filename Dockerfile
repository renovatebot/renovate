FROM node:8.11.1-alpine@sha256:d0febbb04c15f58a28888618cf5c3f1d475261e25702741622f375d0a82e050d

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
