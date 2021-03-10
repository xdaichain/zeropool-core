import { Injectable } from '@nestjs/common';
import * as prettyMilliseconds from 'pretty-ms';
import { Tx } from './transaction.dto';
import { gasZp, zp } from './zeroPool';
import { MemoryStorage } from './storage/memoryStorage';
import { handleBlock, initialScan, synced } from './blockScanner/blockScanner';
import { Block, BlockItem, IMerkleTree, merkleTree, Tx as ZpTx, ZeroPoolNetwork } from 'zeropool-lib';
import { IStorage } from './storage/IStorage';
import { combineLatest, concat, Observable, of, Subject } from 'rxjs';
import { bufferTime, catchError, concatMap, delay, filter, map, mergeMap, take } from 'rxjs/operators';
import { fromPromise } from 'rxjs/internal-compatibility';
import { v4 as uuidv4 } from 'uuid';
import { performance } from "perf_hooks";
import { AppConfig } from "./app.config";
import { Transaction } from "web3-core";

export const storage = new MemoryStorage('zp');

type BlockItemDetails = {
    tx: ZpTx<string>,
    depositBlockNumber: string
}

type TxContract = {
    id: string,
    payload: BlockItemDetails,
}

type ProcessedTx = {
    id: string
    txData?: string | Transaction,
    error?: string
}

const generateTxId = () => {
    return uuidv4();
};

@Injectable()
export class AppService {

    private tx$ = new Subject<TxContract>();
    private processedTx$ = new Subject<ProcessedTx>();

    constructor() {

        const t1 = performance.now();

        combineLatest([
            fromPromise(initialScan(storage, zp)),
        ]).subscribe(() => {
            const t2 = performance.now();
            console.log(`sync is done in ${prettyMilliseconds(t2 - t1)}`);

            this.txPipe(this.tx$, zp, storage).subscribe((data: ProcessedTx[]) => {
                data.forEach((processedTx) => {
                    this.processedTx$.next(processedTx);
                })
            });
        });
    }

    public publishTransaction(
        tx: Tx,
        depositBlockNumber: string,
    ): Observable<ProcessedTx> {
        const id = generateTxId();

        this.tx$.next({
            payload: {
                depositBlockNumber: depositBlockNumber,
                tx: packZpTx(tx)
            }, id
        });

        const result$ = this.processedTx$.pipe(
            filter((processedTx) => processedTx.id === id),
            take(1),
        );

        return result$.pipe(take(1));
    }

    private txPipe(
        txPipe: Subject<TxContract>,
        localZp: ZeroPoolNetwork,
        localStorage: IStorage,
        waitBlocks = 0,
    ): Observable<ProcessedTx[]> {

        return txPipe.pipe(
            bufferTime(AppConfig.txAggregationTime),
            filter((txs) => txs.length > 0),
            concatMap((contract: TxContract[]) => {
                console.log(
                    `${getCurrentDate()}: Received Transaction ${localStorage.storageName} Batch with ${contract.length} tx`
                );

                const chunkedContractList: TxContract[][] = splitArr(contract, AppConfig.maxBatchCapacity);

                const processedTxChunkList$: Observable<ProcessedTx[]>[] = chunkedContractList.map((contractChunk: TxContract[]) => {
                    const processedTx$ = this.handleTransactionContractList(
                        contractChunk,
                        localZp,
                        localStorage,
                        waitBlocks
                    );

                    if (chunkedContractList.length > 1) {
                        return processedTx$.pipe(delay(15000), take(1));
                    }
                    return processedTx$.pipe(take(1));
                });

                return concat(...processedTxChunkList$)
            }),
        );

    }

    private handleTransactionContractList(
        contract: TxContract[],
        localZp: ZeroPoolNetwork,
        localStorage: IStorage,
        waitBlocks = 0,
    ): Observable<ProcessedTx[]> {
        return of('').pipe(
            mergeMap(() => {
                return fromPromise(this.publishBlock(
                    contract.map(x => x.payload), localZp, localStorage, waitBlocks
                ))
            }),
            map((txData: any) => {
                return contract.map(x => {
                    return { txData, id: x.id };
                })
            }),
            catchError((e) => {
                console.log({
                    ...contract.map(x => x.payload),
                    error: e.message,
                });
                const processedTransactionList = contract.map(x => {
                    return { id: x.id, error: e.message || e }
                });
                return of(processedTransactionList);
            }),
            take(1)
        );
    }

    private async publishBlock(
        blockItemDetails: BlockItemDetails[],
        localZp: ZeroPoolNetwork,
        storage: IStorage,
        waitBlocks = 0
    ): Promise<any> {

        if (synced.filter(x => !x).length !== 0 || synced.length < 1) {
            throw new Error('relayer not synced');
        }

        const currentBlockNumber = await localZp.ZeroPool.web3Ethereum.getBlockNumber();
        const blockNumberExpires = currentBlockNumber + 500;

        const rollupCurTxNum = await localZp.ZeroPool.getRollupTxNum();
        //const version = await zp.ZeroPool.getContractVersion();
        const version = 1;

        const mt = copyMerkleTree(storage.utxoTree);
        const blockItemList: BlockItem<string>[] = [];

        for (const details of blockItemDetails) {
            mt.push(BigInt(details.tx.utxoHashes[0]));
            mt.push(BigInt(details.tx.utxoHashes[1]));

            const blockItem: BlockItem<string> = {
                tx: details.tx,
                depositBlockNumber: details.depositBlockNumber,
                newRoot: mt.root.toString(),
            };

            blockItemList.push(blockItem);

        }

        mt.pushZeros(512 - blockItemDetails.length * 2);

        const block: Block<string> = {
            BlockItems: blockItemList,
            rollupCurrentBlockNumber: +rollupCurTxNum >> 8,
            blockNumberExpires,
        };

        const ok = await handleBlock(block, storage);
        if (!ok) {
            throw new Error('cannot verify block');
        }

        const res = await localZp.ZeroPool.publishBlock(
            block.BlockItems,
            block.rollupCurrentBlockNumber,
            block.blockNumberExpires,
            version,
            waitBlocks
        );

        storage.addBlocks([block]);

        return res;
    }

}

function packZpTx(tx: Tx): ZpTx<string> {
    return {
        txExternalFields: tx.txExternalFields,
        delta: tx.delta,
        utxoHashes: tx.utxoHashes,
        token: tx.token,
        rootPointer: tx.rootPointer,
        proof: tx.proof,
        nullifier: tx.nullifier
    };
}

function copyMerkleTree(mt: IMerkleTree): IMerkleTree {
    const serialized = mt.serialize();
    const [height, _merkleState, length] = JSON.parse(serialized);
    const utxoMt = merkleTree(32 + 1);
    utxoMt.height = height;
    utxoMt._merkleState = _merkleState;
    utxoMt.length = length;
    return utxoMt;
}

function getCurrentDate(): string {
    const today = new Date();
    const date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    const time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    return date + ' ' + time;
}

const splitArr = (arr: any[], chunkSize: number): any[][] => {
    const tmp = [];
    for (let i = 0, j = arr.length; i < j; i += chunkSize) {
        tmp.push(
            arr.slice(i, i + chunkSize)
        );
    }
    return tmp;
};
