/* eslint-disable @typescript-eslint/no-explicit-any */
import { UserOperationStruct } from "@account-abstraction/contracts";
import { PaymasterAPI } from "../PaymasterAPI";
import { ethers } from "ethers";
import { calcPreVerificationGas } from "../utils/calcPreVerificationGas";
import { entryPointAddress, PaymasterConfig } from "../AAStarClient";
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
export class StackupPayMasterAPI extends PaymasterAPI {
    private paymasterUrl: string;
    private entryPoint: string;
    private paymasterConfig: PaymasterConfig;
    constructor(paymasterConfig: PaymasterConfig) {
      super();
      this.paymasterUrl = paymasterConfig.config.url;
      this.entryPoint = paymasterConfig.config.entryPoint ? paymasterConfig.config.entryPoint : entryPointAddress;
      this.paymasterConfig = paymasterConfig;
    }
  
    async getPaymasterAndData(
      userOp: Partial<UserOperationStruct>
    ): Promise<string> {
    
      console.log("op", "getPaymasterAndData")
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
        paymasterAndData:"0x0101010101010101010101010101010101010101000000000000000000000000000000000000000000000000000001010101010100000000000000000000000000000000000000000000000000000000000000000101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101",
        signature: "0xa15569dd8f8324dbeabf8073fdec36d4b754f53ce5901e283c6de79af177dc94557fa3c9922cd7af2a96ca94402d35c39f266925ee6407aeb32b31d76978d4ba1c",
      };
      const op = await ethers.utils.resolveProperties(pmOp);
      op.preVerificationGas = calcPreVerificationGas(op);
      op.verificationGasLimit = ethers.BigNumber.from(op.verificationGasLimit).mul(3);
  
      // Ask the paymaster to sign the transaction and return a valid paymasterAndData value.
     
      const params = [await OptoJSON(op), this.entryPoint, this.paymasterConfig.config.option  ]; //{"type": "payg"}
      const provider = new ethers.providers.StaticJsonRpcProvider(this.paymasterUrl);
      console.log("StackupPayMaster", this.paymasterUrl, "pm_sponsorUserOperation start", params)
      const response = await provider.send("pm_sponsorUserOperation", params);
      console.log("StackupPayMaster", this.paymasterUrl, "pm_sponsorUserOperation complete", response)
      return response
    }
  }

