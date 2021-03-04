import cli from 'cli-ux'
import Base from '../base';
import { tw } from 'zeropool-lib';
const axios = require('axios').default;

export default class Transfer extends Base {
  static description = 'Show ZeroPool tx history';

  static examples = [
    `$ zp deposit --amount='...' --contract='...' --mnemonic='...'
TODO: put example of response
`,
  ];

  async run(): Promise<void> {
    await super.run();

    cli.action.start(`Prepare transfer transaction ${this.amount} ${this.asset}`);

    const amountOfAsset = tw(this.amount).toNumber();
    const [tx, depositBlockNumber] = await this.zp.transfer(this.assetAddress, this.to, amountOfAsset)    
    this.log('TX ', tx)

    cli.action.start(`Send transaction to relayer ${this.relayerEndpoint}`);
    const res = await axios.post(`${this.relayerEndpoint}/tx`, {
      tx,
      depositBlockNumber,
    })

    cli.action.stop();

    cli.info(`Tx hash: ${res.data.transactionHash}`)

    process.exit();
  }
}
