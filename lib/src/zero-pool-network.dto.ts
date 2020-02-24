import { DepositEvent } from "./ethereum/zeropool";
import { Utxo } from "./utils";

export interface IMerkleTree {
  _merkleState: any[];
  push: (leaf: bigint) => void;
  proof: (index: number) => Array<any>; // replace any with correct type
  root: bigint;
  pushMany: (elements: bigint[]) => void;
}

export type MyUtxoState = {
  merkleTreeState: Array<any>, // replace any with correct type
  lastBlockNumber: string | number,
  utxoList: Utxo[],
  nullifiers: bigint[]
};

export type Action = 'deposit' | 'transfer' | 'withdraw';
export type ActionType = 'in' | 'out';

export type HistoryState = {
  lastBlockNumber: string | number,
  items: HistoryItem[]
}

export type HistoryItem = {
  action: Action,
  type: ActionType,
  amount: number,
  blockNumber: number
}

export type DepositHistoryItem = {
  deposit: DepositEvent,
  isExists: boolean,
  isSpent: boolean,
  spentInTx: string
}

export type ContractUtxos = {
  encryptedUtxoList: bigint[][],
  utxoDeltaList: bigint[],
  utxoHashes: bigint[],
  blockNumbers: number[],
  nullifiers: bigint[]
}

export type UtxoPair = {
  utxoIn: Utxo[],
  utxoOut: Utxo[]
}
