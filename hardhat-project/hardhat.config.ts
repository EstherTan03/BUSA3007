import type { HardhatUserConfig } from "hardhat/config";

import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable } from "hardhat/config";

import * as dotenv from "dotenv";
dotenv.config();

import "@nomicfoundation/hardhat-viem";
import "@nomicfoundation/hardhat-ethers";

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthersPlugin],
solidity: {
  version: "0.8.28",
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "london" // <-- Ganache-compatible
  }
},
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    ganache: {
      type: "http",
      url: 'http://127.0.0.1:7545' ,
      accounts: ['0x7150915fac91aafe7e618368bedfc845eb57e53131b220815cd216f46d4ad503','0xa3c114ddb7f171a95b04d90af6d8f06b28f9b43eb46243ca3a8bab7de83fd0aa', '0x3daa35470cda1e6ebe4feedee21015c70617025bdcbeb426edebfa953ea3c5f8']
    },
    localganache: {
      type: "http",
      url: 'http://127.0.0.1:7545' ,
      accounts: ['0x9fd6cfb16d2336dc24109c4382646e099b9be90ceed09b509c3c01993ce164a4'],
      chainId: 1337, 
    },
  },
};

export default config;
