import Web3 from 'web3';
import { AbiItem, keccak256 } from 'web3-utils';
import { Contract, EventData } from 'web3-eth-contract';
import { HttpProvider } from 'web3-providers-http';
import { Transaction, TransactionReceipt } from 'web3-core';
import { addHexPrefix, privateToAddress, toChecksumAddress } from 'ethereumjs-util';
import { BigNumber } from 'bignumber.js'
import { toHex } from "../utils";

export type TransactionParams = {
    from?: string | number;
    to: string;
    value?: number | string;
    gas?: number;
    gasPrice?: number | string;
    data?: string;
    nonce?: number;
}

export class Web3Ethereum {

    // @ts-ignore
    public ethAddress: string;
    private privateKey: string | undefined;
    private isInit = false;

    private web3: Web3;

    constructor(provider: HttpProvider) {
        this.web3 = new Web3(provider);
        this.init()
    }

    async init() {
        if (this.isInit) return;
        const addresses = await this.web3.eth.getAccounts()
        if (addresses.length !== 0) this.ethAddress = addresses[0]
        this.isInit = true
    }

    setLocalAddress(privateKey: string) {
        this.ethAddress = getEthereumAddress(privateKey)
        this.privateKey = privateKey
    }

    createInstance(abi: AbiItem[], address?: string,): Contract {
        return new this.web3.eth.Contract(abi, address);
    }

    getTransaction(txHash: string, callback?: (err: any, tx: Transaction) => void): Promise<Transaction> {
        return this.web3.eth.getTransaction(txHash, callback);
    }


    getTransactionReceipt(
        txHash: string,
        callback?: (err: any, tx: TransactionReceipt) => void
    ): Promise<TransactionReceipt> {
        return this.web3.eth.getTransactionReceipt(txHash, callback);
    }

    getBalance(address: string): Promise<string> {
        return this.web3.eth.getBalance(address);
    }

    getBlockNumber(): Promise<number> {
        return this.web3.eth.getBlockNumber();
    }

    encodeParameter(param: any, value: any): string {
        return this.web3.eth.abi.encodeParameter(param, value)
    }

    encodeParameters(types: any[], value: any): string {
        return this.web3.eth.abi.encodeParameters(types, value)
    }

    decodeParameter(types: any, hex: string): { [key: string]: any } {
        return this.web3.eth.abi.decodeParameter(types, hex)
    }

    decodeParameters(types: any[], hex: string): { [key: string]: any } {
        return this.web3.eth.abi.decodeParameters(types, hex)
    }

    async waitBlockNumber(blockNumber: number) {
        console.log(`waiting until ${blockNumber} block is mined`)
        const subscription = this.web3.eth.subscribe('newBlockHeaders')
        const res = await (new Promise(resolve => {
            subscription
                .on('data', blockHeader => {
                    const left = blockNumber - blockHeader.number
                    console.log(`${Math.max(left, 0)} blocks left`)
                    if (left <= 0) resolve(true)
                })
                .on('error', error => {
                    console.log(error)
                    resolve(false)
                })
        }))
        subscription.unsubscribe()
        return res
    }

    async sendTransaction(
        txParams: TransactionParams,
        confirmations = 1,
        onTransactionHash?: (error: any, txHash: string | undefined) => void
    ): Promise<string | TransactionReceipt> {

        if (!this.isInit) await this.init()

        const nonce = !txParams.nonce
            ? await this.web3.eth.getTransactionCount(this.ethAddress)
            : txParams.nonce;

        const gasPrice = !txParams.gasPrice
            ? await this.web3.eth.getGasPrice()
            : txParams.gasPrice;

        const callback = (error: any, txHash: string | undefined) => {
            if (error) {
                console.log(error)
                onTransactionHash && onTransactionHash(error, undefined)
            }
        }

        const txConfig: TransactionParams = {
            nonce,
            data: txParams.data || '',
            gasPrice: toHex(gasPrice),
            to: txParams.to,
            from: txParams.from || this.ethAddress,
            value: toHex(txParams.value || 0)
        }
        const gasEstimate = await this.web3.eth.estimateGas(txConfig)

        // If we have `priviteKey` sign transaction locally
        const promiEvent = this.privateKey
            ? this.web3.eth.sendSignedTransaction(
                await sign(
                    this.web3,
                    {...txConfig, gas: gasEstimate},
                    this.privateKey || '',
                    await this.web3.eth.getChainId()
                ), callback)
            : this.web3.eth.sendTransaction(txConfig, callback)

        return new Promise((resolve) => {
            promiEvent
                .on('transactionHash', transactionHash => {
                    onTransactionHash && onTransactionHash(undefined, transactionHash);
                    if (confirmations === 0) {
                        resolve(transactionHash);
                    }
                })
                .on('receipt', receipt => {
                    if (confirmations === 1) {
                        resolve(receipt);
                    }
                })
                .on('confirmation', (num, receipt) => {
                    if (num === confirmations - 1) {
                        resolve(receipt);
                    }
                });
        })
    }

    sendSignedTransaction(rawTx: string, confirmations: number = 1): Promise<string | Transaction> {
        if (rawTx.indexOf('0x') !== 0) {
            rawTx = '0x' + rawTx;
        }

        return new Promise((resolve) => {
            this.web3.eth.sendSignedTransaction(rawTx)
                .on('transactionHash', (transactionHash: string) => {
                    if (confirmations === 0) {
                        resolve(transactionHash);
                    }
                })
                .on('confirmation', (num: any, receipt: any) => {
                    if (num === confirmations) {
                        resolve(receipt);
                    }
                });
        })
    }
}

async function sign(web3: Web3, txParam: TransactionParams, privateKey: string, chainId: number): Promise<string> {
    if (privateKey.indexOf('0x') === 0) {
        privateKey = privateKey.substring(2);
    }
    const signedTx = await web3.eth.accounts.signTransaction(
        {
            ...txParam,
            chainId
        },
        privateKey
    )

    return signedTx.rawTransaction || '0x'
}

export const hash = keccak256;

export const tbn = (x: number | string): BigNumber => new BigNumber(x);
export const tw = (x: string | number | BigNumber) =>
    BigNumber.isBigNumber(x) ? x.times(1e18).integerValue() : tbn(x).times(1e18).integerValue();
export const fw = (x: string | number | BigNumber) =>
    BigNumber.isBigNumber(x) ? x.times(1e-18).toNumber() : tbn(x).times(1e-18).toNumber();

export function getEvents(
    instance: Contract,
    event: string,
    fromBlockNumber: string | number = 0,
    onData?: (data: EventData) => any
): Promise<EventData[]> {
    if (onData) {
        return instance.events[event]({ fromBlock: fromBlockNumber })
            .on('data', function (event: EventData) {
                onData(event);
            })
    }
    return instance.getPastEvents(event, { fromBlock: fromBlockNumber, toBlock: 'latest' })
}

export function gasLessCall(
    instance: Contract,
    methodName: string,
    parameters: any[],
    addressFrom: string = '0x0000000000000000000000000000000000000000',
    blockNumber: string = 'latest'
): Promise<any> {
    return instance.methods[methodName](...parameters).call({ from: addressFrom }, blockNumber);
}

export function getCallData(instance: Contract, methodName: string, parameters: any): string {
    if (!instance.methods[methodName])
        throw new Error(`Method ${ methodName } does not exist`);
    return instance.methods[methodName](...parameters).encodeABI();
}

export function getEthereumAddress(privateKey: string) {
    if (privateKey.indexOf('0x') === 0) {
        privateKey = privateKey.substring(2);
    }
    const addressBuffer = privateToAddress(Buffer.from(privateKey, 'hex'));
    const hexAddress = addressBuffer.toString('hex');
    return addHexPrefix(toChecksumAddress(hexAddress));
}
