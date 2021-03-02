const ZeroPool = artifacts.require("ZeroPool");
const MainnetProxy = artifacts.require("MainnetProxy");


module.exports = async function(deployer, network, accounts) {
  await deployer.deploy(MainnetProxy);
  await deployer.deploy(ZeroPool);

  const mainnetProxy = await MainnetProxy.deployed();

  const hardforkcalldata = web3.eth.abi.encodeFunctionCall({
    name: 'init',
    type: 'function',
    inputs: [{
        type: 'address',
        name: 'relayer'
    }]
  }, [accounts[0]]);

  console.log(hardforkcalldata)
  await mainnetProxy.hardfork(ZeroPool.address, hardforkcalldata);

  const zp = await ZeroPool.deployed()
  console.log(await zp.init(accounts[0]))
};
