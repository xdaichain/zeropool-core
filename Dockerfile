# Build lib
FROM node:12.10.0 as build-lib

WORKDIR /app/lib

COPY ./lib .

RUN npm ci && npm run build



# Build relayer
FROM build-lib as build-relayer

WORKDIR /app/relayer

COPY ./relayer/package*.json ./

RUN npm ci

COPY ./relayer .

RUN npm run build



# Build cli
FROM build-lib as build-cli

WORKDIR /app/zp-cli

COPY ./zp-cli/package*.json ./

RUN npm ci

COPY ./zp-cli .



FROM node:alpine as include-lib

COPY --from=build-lib /app/lib /app/lib



FROM include-lib as relayer

WORKDIR /app/relayer

COPY --from=build-relayer /app/relayer .

CMD ["./node_modules/.bin/nest", "start"]



FROM include-lib as cli

WORKDIR /app/zp-cli

RUN ln -s $(which node) /usr/bin/node

COPY --from=build-relayer /app/relayer/compiled /app/relayer/compiled

COPY --from=build-cli /app/zp-cli /app/zp-cli

RUN npm link
