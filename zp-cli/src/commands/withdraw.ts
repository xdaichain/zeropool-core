import cli from 'cli-ux'
import { tw } from 'zeropool-lib';
import Base from '../base';

const axios = require('axios').default;

const timeout = (ms: number) => new Promise(res => setTimeout(res, ms))

export default class Withdraw extends Base {
  static description = 'Show ZeroPool tx history'

  static examples = [
    `$ zp deposit --amount='...' --contract='...' --mnemonic='...'
TODO: put example of response
`,
  ];

  async run(): Promise<void> {
    await super.run();

    cli.action.start(`Prepare withdraw transaction ${this.asset}`);

    const withdrawAmount = tw(this.amount).toNumber();
    const [tx, depositBlockNumber] = await this.zp.prepareWithdraw(this.assetAddress, withdrawAmount);
    this.log('TX', tx)

    cli.action.start(`Send transaction to relayer ${this.relayerEndpoint}`);
    const res = await axios.post(`${this.relayerEndpoint}/tx`, {
      tx,
      depositBlockNumber
    });
    cli.info(`Tx hash: ${res.data.transactionHash}`)

    // todo: ZeroPool withdrawal note is not updated instantly
    await timeout(5000)

    const withdrawals = await this.zp.getActiveWithdrawals()
    this.log('Active withdrawals', withdrawals)

    // ZerooPool `withdraw` call reqires ten blocks (CHALLENGE_EXPIRES_BLOCKS)
    // to be mined after withdrawal utxo has been sent
    await this.zp.ZeroPool.web3Ethereum.waitBlockNumber(withdrawals[0].blockNumber + 11)

    cli.action.start(`Withdraw`);
    const withdrawRes = await this.zp.withdraw(withdrawals[0]);
    this.log('Withdraw TX hash', withdrawRes)

    cli.action.stop();

    process.exit();

  }
}
