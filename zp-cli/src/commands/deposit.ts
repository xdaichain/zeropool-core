import cli from 'cli-ux'
import Base from '../base';
import { tw } from 'zeropool-lib';

const axios = require('axios').default;

export default class Deposit extends Base {
  static description = 'Deposit asset to ZeroPool';

  static examples = [
    `$ zp deposit --amount='...' --contract='...' --mnemonic='...'
TODO: put example of response
`,
  ];

  async run(): Promise<void> {
    await super.run();

    cli.action.start(`Deposit ${ this.amount } ${ this.asset } to the contract`);
    const amountOfAsset = tw(this.amount).toNumber();
    const [tx, zeroPoolTxHash] = await this.zp.prepareDeposit(this.assetAddress, amountOfAsset)
    this.log('TX', tx)
    const depositBlockNumber = (await this.zp.deposit(this.assetAddress, amountOfAsset, zeroPoolTxHash)).toString();

    const [gasTx,] = await this.gasZp.prepareWithdraw(this.assetAddress, this.gasFee)
    this.log('Gas TX', gasTx)

    cli.action.start(`Send transaction to relayer ${ this.relayerEndpoint }`);
    const res = await axios.post(`${ this.relayerEndpoint }/tx`, {
      depositBlockNumber,
      tx,
      gasTx
    });

    cli.action.stop();

    cli.info(`Deposit TX hash: ${res.data.transactionHash}`)

    process.exit();
  }
}
