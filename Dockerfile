ARG target
FROM $target

COPY qemu-* /usr/bin/

LABEL maintainer="Jesse Stuart <hi@jessestuart.com>"
LABEL name="renovate"

ARG version
LABEL version="$version"

WORKDIR /usr/src/app/

RUN apk add --quiet --no-cache git openssh-client ca-certificates php php-mbstring php-openssl php-zip php-zlib composer
COPY package.json yarn.lock ./
RUN yarn --production -s --no-progress && yarn cache clean
COPY lib lib

COPY --from=golang /usr/local/go/bin/go /bin/go
RUN mkdir -p /usr/local/go

COPY bin bin

USER node

ENTRYPOINT ["node", "/usr/src/app/lib/renovate.js"]
