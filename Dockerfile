FROM amd64/golang:1.11.2-alpine@sha256:2169a7effa73e283ad0f290021eaf14fd812dae9767646b5afcb5bf097b17c0b AS golang

FROM amd64/node:8.12.0-alpine@sha256:81abb8de1e5e8b6e55bca143b3c2ec1e2d167cb27fd2cd3191a0d222f7c5e710

LABEL maintainer="Rhys Arkins <rhys@arkins.net>"
LABEL name="renovate"

WORKDIR /usr/src/app/

RUN apk add --quiet --no-cache git openssh-client ca-certificates php php-mbstring php-openssl php-zip php-zlib composer
COPY package.json .
COPY yarn.lock .
RUN yarn install --production && yarn cache clean
COPY lib lib

COPY --from=golang /usr/local/go/bin/go /bin/go
RUN mkdir -p /usr/local/go

COPY bin bin

USER node

ENTRYPOINT ["node", "/usr/src/app/lib/renovate.js"]
CMD ["--help"]
