FROM node:12.10.0 as build

WORKDIR /app

RUN ln -s $(which node) /usr/bin/node

COPY ./lib ./lib

COPY ./circom ./circom

COPY ./scripts/initialize.sh .

RUN ./initialize.sh



FROM build as local-lib

COPY --from=build /app/lib/dist /app/lib/dist



FROM local-lib as relayer

WORKDIR /app/relayer

COPY --from=build /app/circom/circuitsCompiled/transaction* ./compiled/

COPY ./relayer/package*.json ./

RUN npm ci && npm run build

COPY ./relayer ./

CMD ["nest", "start"]



FROM local-lib as cli

COPY --from=build /app/circom/circuitsCompiled /app/circom/circuitsCompiled

WORKDIR /app/zp-cli

COPY ./zp-cli/package*.json ./

RUN npm ci

COPY ./zp-cli .

RUN npm link

CMD ["zp", "balance"]
