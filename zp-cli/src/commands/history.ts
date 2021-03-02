import Base from '../base';
import cli from "cli-ux";

export default class History extends Base {
  static description = 'Show ZeroPool tx history';

  static examples = [
    `$ zp history --contract='...' --mnemonic='...'
TODO: put example of response
`,
  ];

  async run() {
    await super.run();

    cli.action.start(`Fetching history`);
    await this.showHistory();
    cli.action.stop();
    process.exit();
  }

  private async showHistory() {
    const depositHistory = await this.zp.depositExternalHistory();
    const txHistory = await this.zp.getBalanceAndHistory();
    /*
        Actions:
        1. Deposit ETH/Token
        2.1. Deposit spending
        2.2. Cancel Deposit
        3. Transafer ETH/Token
        4. Prepare withdraw
        5. Withdraw
     */

    // todo: we can have utxos from ZP mnemonic but didn't have deposits from new private key
    // todo: fetch token decimals
    // todo: fetch token names
    // todo: sort by block number
    for (const d of depositHistory) {
      let msg = `Deposit ${d.deposit.params.amount} wei\nBlock number: ${d.deposit.blockNumber}\n`;

      msg += d.spentInTx === '0'
        ? 'Have not spent yet'
        : `Spent in transaction: ${d.spentInTx}`;

      this.log(msg + '\n');
    }

    for (const utxo of txHistory.historyItems) {
      const msg = `UTXO ${utxo.amount} wei\nType ${utxo.type}\nBlock number: ${utxo.blockNumber}`;
      this.log(msg + '\n');
    }
  }
}
