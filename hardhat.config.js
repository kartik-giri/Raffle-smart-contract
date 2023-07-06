require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config()
require("hardhat-deploy");
/** @type import('hardhat/config').HardhatUserConfig */
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY

module.exports = {
  solidity: "0.8.18",
    
    defaultNetwork:"hardhat",

    networks:{
      hardhat:{
        chainId: 31337,
        blockConfirmations: 1,
      },
       
       sepolia:{
        url: SEPOLIA_RPC_URL,
        accounts:[PRIVATE_KEY],
        chainId: 11155111,
        blockConfirmation:6,
       }
    },

    namedAccounts: {
      deployer: {
          default: 0, // here this will by default take the first account as deployer
          // 1: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
      },
      player: {
          default: 1,
      },
  },

  etherscan: {
    apiKey: {
      sepolia:  ETHERSCAN_API_KEY
    }
  },

  mocha:{
    timeout: 300000, // 300 sec max
  }
  


};
