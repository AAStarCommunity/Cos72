/* eslint-disable @typescript-eslint/no-explicit-any */
import { UserOperationStruct } from "@account-abstraction/contracts";
import { PaymasterAPI } from "../PaymasterAPI";
import { ethers } from "ethers";
import { calcPreVerificationGas } from "../calcPreVerificationGas";
async function OptoJSON(op: Partial<UserOperationStruct>): Promise<any> {
  const userOp = await ethers.utils.resolveProperties(op);
  return Object.keys(userOp)
    .map((key) => {
      let val = (userOp as any)[key];
      if (typeof val !== "string" || !val.startsWith("0x")) {
        val = ethers.utils.hexValue(val);
      }
      return [key, val];
    })
    .reduce(
      (set, [k, v]) => ({
        ...set,
        [k]: v,
      }),
      {}
    );
}
export class AAStarPayMasterAPI extends PaymasterAPI {
  private paymasterUrl: string;
  //private entryPoint: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(paymasterUrl: string, _entryPoint: string) {
    super();

    this.paymasterUrl = paymasterUrl;
    //  this.entryPoint = entryPoint;
  }

  async getPaymasterAndData(
    userOp: Partial<UserOperationStruct>
  ): Promise<any> {
    // Hack: userOp includes empty paymasterAndData which calcPreVerificationGas requires.
    // try {
    //   // userOp.preVerificationGas contains a promise that will resolve to an error.
    //   await ethers.utils.resolveProperties(userOp);
    //   // eslint-disable-next-line no-empty
    // } catch (_) {}
    const pmOp: Partial<UserOperationStruct> = {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: userOp.initCode,
      callData: userOp.callData,
      callGasLimit: userOp.callGasLimit,
      verificationGasLimit: userOp.verificationGasLimit,
      maxFeePerGas: userOp.maxFeePerGas,
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
      // Dummy signatures are required in order to calculate a correct preVerificationGas value.
      paymasterAndData:
        "0x0101010101010101010101010101010101010101000000000000000000000000000000000000000000000000000001010101010100000000000000000000000000000000000000000000000000000000000000000101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101",
      signature:
        "0xa15569dd8f8324dbeabf8073fdec36d4b754f53ce5901e283c6de79af177dc94557fa3c9922cd7af2a96ca94402d35c39f266925ee6407aeb32b31d76978d4ba1c",
    };
    const op = await ethers.utils.resolveProperties(pmOp);
    op.preVerificationGas = calcPreVerificationGas(op);
    op.verificationGasLimit = ethers.BigNumber.from(
      op.verificationGasLimit
    ).mul(3);

    // Ask the paymaster to sign the transaction and return a valid paymasterAndData value.

    const params = [
      await OptoJSON(op),
      {
        strategy_code: "a__d7MwJ",
        version: "v0.6",
      },
    ];
    console.log(
      "AAStarPayMasterAPI",
      this.paymasterUrl,
      "pm_sponsorUserOperation start",
      params
    );
    const response = await fetch(this.paymasterUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: 0,
        jsonrpc: "2.0",
        method: "pm_sponsorUserOperation",
        params: params,
      }),
    });

    //   {
    //     "paymasterAndData": "0x9d6ac51b972544251fcc0f2902e633e3f9bd3f2900000000000000000000000000000000000000000000000000000000667a3f25000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000871e94cd9b6f4b73f45003279b04ced8d2b96e9946e94246c063f89774ee59d75362f7f8b6a1d254a36eeca7308f1b96f82eae7e23563ee5d902fe2f0ed99d271c",
    //     "preVerificationGas": "0xd2da",
    //     "verificationGasLimit": "0xee69",
    //     "callGasLimit": "0x6038"
    // }
    // {
    //     "code": 200,
    //     "message": "",
    //     "data": {
    //         "strategyId": "",
    //         "network": "ethereum-sepolia",
    //         "entrypointVersion": "v0.6",
    //         "entrypointAddress": "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    //         "paymasterAddress": "0xF2147CA7f18e8014b76e1A98BaffC96ebB90a29f",
    //         "Erc20TokenCost": null,
    //         "userOpResponse": {
    //             "paymasterAndData": "0xf2147ca7f18e8014b76e1a98baffc96ebb90a29f00000000000000000000000000000000000000000000000000000000667a329800000000000000000000000000000000000000000000000000000000667a316b00000000000000000000000086af7fa0d8b0b7f757ed6cdd0e2aadb33b03be5800000000000000000000000000000000000000000000000000000000000000000e056ba0aaed24c28ce05d84f457b14dcaf9b931081c9d44a8d3ece345631e1e11b2b55ab3fd1b4bdbfa5915a0e57c1b2feb47662818effe982a97efe9a567281b",
    //             "preVerificationGas": 51638,
    //             "verificationGasLimit": 391733,
    //             "callGasLimit": 45445,
    //             "maxFeePerGas": 14497306854,
    //             "maxPriorityFeePerGas": 1500000000,
    //             "accountGasLimit": "",
    //             "paymasterVerificationGasLimit": null,
    //             "paymasterPostOpGasLimit": null,
    //             "gasFees": ""
    //         }
    //     },
    //     "cost": "2562047h47m16.854775807s"
    // }
    if (response.ok) {
      const data = await response.json();
      console.log(
        "AAStarPayMasterAPI",
        this.paymasterUrl,
        "pm_sponsorUserOperation end",
        data
      );
      if (data.code === 200) {
        return {
          paymasterAndData: data.data.userOpResponse.paymasterAndData,
          preVerificationGas: data.data.userOpResponse.preVerificationGas,
          verificationGasLimit: data.data.userOpResponse.verificationGasLimit,
          callGasLimit: data.data.userOpResponse.callGasLimit,
        };
      }
    }
  }
}
