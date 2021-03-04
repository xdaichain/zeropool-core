import Base from '../base';
import { fw } from 'zeropool-lib';
import cli from "cli-ux";

export default class Balance extends Base {
  static description = 'Get ZeroPool balance';

  static examples = [
    `$ zp balance
hello world from ./src/hello.ts!
`,
  ];

  async run() {
    await super.run();

    cli.action.start(`Fetching balance`);
    const balances = await this.zp.getBalance();
    console.log(balances)
    if (Object.keys(balances).length === 0) {
      this.log(`Your balance: 0 zpETH`);
    } else {
      this.log(`Your balance: ${ fw(balances['0x0000000000000000000000000000000000000000']) } zpETH`);
    }
    process.exit();
  }

}
