/* eslint-disable @typescript-eslint/no-explicit-any */
import { UserOperationStruct } from "@account-abstraction/contracts";
import { PaymasterAPI } from "../PaymasterAPI";
import { ethers } from "ethers";
import { calcPreVerificationGas } from "../utils/calcPreVerificationGas";
import { PaymasterConfig } from "../AAStarClient";
async function OptoJSON(op: Partial<UserOperationStruct>): Promise<any> {
  const userOp = await ethers.utils.resolveProperties(op);
  return Object.keys(userOp)
    .map((key) => {
      let val = (userOp as any)[key];
      if (typeof val !== "string" || !val.startsWith("0x")) {
        console.log(val, typeof val )
        val = val.toString()
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
export class BiconomyPayMasterAPI extends PaymasterAPI {
  private paymasterUrl: string;
  private paymasterConfig: PaymasterConfig;
//   private entryPoint: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(paymasterConfig: PaymasterConfig) {
    super();

    this.paymasterUrl = paymasterConfig.config.url;
    this.paymasterConfig = paymasterConfig;
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
      this.paymasterConfig.config.option,
      // {
      //   "mode": "SPONSORED",
      //   "calculateGasLimits": true,
      //   "expiryDuration": 300 ,
      //   "sponsorshipInfo": {
      //       "webhookData": {},
      //       "smartAccountInfo": {
      //           "name": "BICONOMY",
      //           "version": "2.0.0"
      //       }
      //   }
      // },
    ];
    console.log(
      "BiconomyPayMasterAPI",
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

    // {
    //     "id": 1,
    //     "jsonrpc": "2.0",
    //     "method": "pm_sponsorUserOperation",
    //     "params": [
    //         {
    //             sender, // address
    //             nonce, // uint256
    //             initCode, // string
    //             callData, // string
    //             callGasLimit, // string
    //             verificationGasLimit, // string
    //             preVerificationGas, // string
    //             maxFeePerGas, // string
    //             maxPriorityFeePerGas, // string
    //             signature // dummy signature string
    //         },
    //         {
    //             "mode": "SPONSORED",
    //             "calculateGasLimits": true,
    //             "expiryDuration": 300 // duration (secs) for which the generate paymasterAndData will be valid. Default duration is 300 secs. 
    //             "sponsorshipInfo": {
    //                 "webhookData": {},
    //                 "smartAccountInfo": {
    //                     "name": "BICONOMY",
    //                     "version": "2.0.0"
    //                 }
    //             }
    //         }
    //     ]
    // }

//     callGasLimit
// : 
// 21850
// paymasterAndData
// : 
// "0x00000f79b7faf42eebadba19acc07cd08af44789000000000000000000000000a6d8e935b792b3fe5b4516f847b5bf5310b5afb1000000000000000000000000000000000000000000000000000000006684de8c000000000000000000000000000000000000000000000000000000006684dd6000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000041603332d166352efbfbc9de1b76537ce993cb684eedad7c210c94ee4e26a75dca65e0a7f08ab4a118cc83cc8ec8b7f944814a5f37a5ac9e0162268cb0f2340bfc1b00000000000000000000000000000000000000000000000000000000000000"
// preVerificationGas
// : 
// "76270"
// verificationGasLimit
// : 
// 54726
    
    if (response.ok) {
      const data = await response.json();
      console.log(
        "BiconomyPayMasterAPI",
        this.paymasterUrl,
        "pm_sponsorUserOperation end",
        data
      );
      return {
        paymasterAndData: data.result.paymasterAndData,
        preVerificationGas: ethers.BigNumber.from(data.result.preVerificationGas).toHexString(),
        verificationGasLimit: ethers.BigNumber.from(data.result.verificationGasLimit).toHexString(),
        callGasLimit:  ethers.BigNumber.from(data.result.callGasLimit).toHexString(),
      };
    }
  }
}
