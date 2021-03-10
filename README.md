<p align="center">
  <img src="https://zeropoolnetwork.github.io/zeropool-core/img/zeropool.svg" width="300px"></img>
</p>


# zeropool-core

Smart contracts, Cryptography and Relayer that are used at zeropool.network

This repo contains of smart contract, SNARKs implementation on circom lib, CLI for making deposit, transfer and withdraw.

ZeroPool project design is described on ethresarch: https://ethresear.ch/t/state-of-zeropool-scaling-anonymous-transactions-for-ethereum/6946


# How to use

1. `docker-compose build cli`
2. Compete config template - `zp-cli/client.config.js`. You can get generate a new mnemonic at the https://testnet.app.zeropool.network/
3. Now you can interact with the ZeroPool network deployed to the Sokol testnet.

# Exmaples

* `./scripts/run.sh balance`
* `./scripts/run.sh deposit -v=0.1`
* `./scripts/run.sh transfer -v=0.1 -t=0x262aea12310f24ae8bda8f844814de77b182082c13a8efd7d2bf99c62427df19`
* `./scripts/run.sh withdraw -v=0.1`
