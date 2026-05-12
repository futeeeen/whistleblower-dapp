require("dotenv").config();
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.23",
  networks: {
    // Local zero-gas chain for burner-wallet experiments.
    // Permissioned-chain clients such as Besu should also set minGasPrice=0
    // in their node/client configuration.
    hardhat: {
      gasPrice: 0,
      initialBaseFeePerGas: 0
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      gasPrice: 0
    }
  }
};
