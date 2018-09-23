FROM amd64/node:8.12.0-alpine@sha256:81abb8de1e5e8b6e55bca143b3c2ec1e2d167cb27fd2cd3191a0d222f7c5e710

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
