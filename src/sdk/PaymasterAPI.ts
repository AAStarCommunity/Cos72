/* eslint-disable @typescript-eslint/no-explicit-any */
import { UserOperationStruct } from '@account-abstraction/contracts'

/**
 * an API to external a UserOperation with paymaster info
 */
export class PaymasterAPI {
  /**
   * @param _userOp a partially-filled UserOperation (without signature and paymasterAndData
   *  note that the "preVerificationGas" is incomplete: it can't account for the
   *  paymasterAndData value, which will only be returned by this method..
   * @returns the value to put into the PaymasterAndData, undefined to leave it empty
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPaymasterAndData (_userOp: Partial<UserOperationStruct>): Promise<any> {
    return '0x'
  }
}
