/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumberish } from 'ethers'

export interface TransactionDetailsForUserOp {
  target: string
  data: string | any
  value?: BigNumberish
  gasLimit?: BigNumberish
  maxFeePerGas?: BigNumberish
  maxPriorityFeePerGas?: BigNumberish
  nonce?: BigNumberish
}
