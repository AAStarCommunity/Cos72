/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber, BigNumberish, ethers } from "ethers";
import {
  SimpleAccount,
  SimpleAccount__factory,
  SimpleAccountFactory,
} from "@account-abstraction/contracts";

import { arrayify, BytesLike } from "ethers/lib/utils";

import { BaseApiParams, BaseAccountAPI } from "./BaseAccountAPI";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/types";
// const FACTORY_ADDRESS = "0x9406Cc6185a346906296840746125a0E44976454";
/**
 * constructor params, added no top of base params:
 * @param owner the signer object for the account owner
 * @param factoryAddress address of contract "factory" to deploy new contracts (not needed if account already deployed)
 * @param index nonce value used when creating multiple accounts for the same owner
 */
export interface SimpleAccountApiParams extends BaseApiParams {
  factoryAddress?: string;
  index?: BigNumberish;
  apiBaseUrl?: string;
}
const generateRandomString = function (length = 6) {
  return Math.random().toString(20).substr(2, length);
};
/**
 * An implementation of the BaseAccountAPI using the SimpleAccount contract.
 * - contract deployer gets "entrypoint", "owner" addresses and "index" nonce
 * - owner signs requests using normal "Ethereum Signed Message" (ether's signer.signMessage())
 * - nonce method is "nonce()"
 * - execute method is "execFromEntryPoint()"
 */
export class AirAccountAPI extends BaseAccountAPI {
  index: BigNumberish;
  apiBaseUrl: string;

  /**
   * our account contract.
   * should support the "execFromEntryPoint" and "nonce" methods
   */
  accountContract?: SimpleAccount;

  factory?: SimpleAccountFactory;

  constructor(params: SimpleAccountApiParams) {
    super(params);
    this.apiBaseUrl = params.apiBaseUrl
      ? params.apiBaseUrl
      : "https://anotherairaccountcommunitynode.onrender.com";
    this.index = BigNumber.from(params.index ?? 0);
  }

  async sendCaptcha(email: string) {
    const raw = JSON.stringify({
      email,
    });

    const requestOptions = {
      method: "POST",
      body: raw,
    };
    const response = await fetch(
      `${this.apiBaseUrl}/api/passkey/v1/reg/prepare`,
      requestOptions
    );
    if (response.ok) {
      const body = await response.json();
      return body;
    } else {
      return null;
    }
  }

  async register(email: string, captcha: string) {
    const raw = JSON.stringify({
      captcha,
      email,
      origin: window.location.origin,
    });
    const requestOptions = {
      method: "POST",
      body: raw,
    };
    const response = await fetch(
      `${this.apiBaseUrl}/api/passkey/v1/reg`,
      requestOptions
    );
    if (response.status == 200 || response.status === 400) {
      const body = await response.json();
      if (body.code === 200) {
        const json = body.data as PublicKeyCredentialCreationOptionsJSON;
        const attest = await startRegistration(json);
        // console.log(attest)
        const requestOptions = {
          method: "POST",
          body: JSON.stringify(attest),
        };

        const response2 = await fetch(
          `${this.apiBaseUrl}/api/passkey/v1/reg/verify?email=${email}&origin=${window.location.origin}&network=optimism-sepolia`,
          requestOptions as any
        );
        if (response2.ok) {
          const body2 = await response2.json();
          if (body2.code === 200) {
            localStorage.setItem("airaccount_token", body2.token);
            return true;
          }
          // console.log(body2)
        }
        return null;
      } else {
        console.log(body)
        if (body.code === 0 && body.data[0] === "User already exists") {
          const signResponse = await fetch(
            `${this.apiBaseUrl}/api/passkey/v1/sign`,
            requestOptions
          );
          if (signResponse.ok) {
            const body = await signResponse.json();
            if (body.code === 200) {
              const json = body.data as PublicKeyCredentialRequestOptionsJSON;
              const attest = await startAuthentication(json);
              // console.log(attest)
              const requestOptions = {
                method: "POST",
                body: JSON.stringify(attest),
              };

              const response2 = await fetch(
                `${this.apiBaseUrl}/api/passkey/v1/sign/verify?email=${email}&origin=${window.location.origin}&network=optimism-sepolia`,
                requestOptions as any
              );
              if (response2.ok) {
                const body2 = await response2.json();
                if (body2.code === 200) {
                  localStorage.setItem("airaccount_token", body2.token);
                  return true;
                }
              }
            }
          }
        }
        if (body.code === 0 && body.data[1] === "invalid captcha") {
          return "invalid captcha"
        }
      }
    } else {
      return null;
    }
  }

  async getAccountInfo() {
    const airaccountToken = localStorage.getItem("airaccount_token");

    const myHeaders = new Headers();
    myHeaders.append("Authorization", `Bearer ${airaccountToken}`);

    const requestOptions = {
      method: "GET",
      headers: myHeaders,
    };

    const response = await fetch(
      `${this.apiBaseUrl}/api/passkey/v1/account/info?network=optimism-sepolia`,
      requestOptions
    );
    if (response.ok) {
      const body = await response.json();
      if (body.code === 200) {
        return body.data;
      }
    }
    return null;
  }

  async signOut() {
    localStorage.removeItem("airaccount_token");
  }

  // const generateRegPasskeyPublicKey = async (email: string) => {
  //   const origin = window.location.origin;
  //   const resp = await api.post(API.PASSKEY_REG, {
  //     email,
  //     origin,
  //     captcha: "111111",
  //   });
  //   const json = resp.data.data as PublicKeyCredentialCreationOptionsJSON;
  //   if (json !== null) {
  //     const attest = await startRegistration(json);
  //     const verifyResp = await api.post(
  //       API.PASSKEY_REG_VERIFY +
  //         "?origin=" +
  //         encodeURIComponent(origin) +
  //         "&email=" +
  //         email +
  //         "&network=optimism-sepolia",
  //       attest
  //     );
  //     const signInRlt = verifyResp.status === 200 && verifyResp.data.code === 200;
  //     if (signInRlt) {
  //       if (verifyResp.data.token) {
  //         localStorage.setItem("token", verifyResp.data.token!);
  //       }
  //     }
  //   }
  // };

  async _getAccountContract(): Promise<SimpleAccount> {
    if (this.accountContract == null) {
      this.accountContract = SimpleAccount__factory.connect(
        await this.getAccountAddress(),
        this.provider
      );
    }
    return this.accountContract;
  }

  /**
   * return the value to put into the "initCode" field, if the account is not yet deployed.
   * this value holds the "factory" address, followed by this account's information
   */
  async getAccountInitCode(): Promise<string> {
    const accountInfo = await this.getAccountInfo();
    if (accountInfo) {
      return accountInfo.init_code;
    }
    return Promise.resolve("");
  }

  async getNonce(): Promise<BigNumber> {
    if (await this.checkAccountPhantom()) {
      return BigNumber.from(0);
    }
    const accountContract = await this._getAccountContract();
    return await accountContract.getNonce();
  }

  /**
   * encode a method call from entryPoint to our contract
   * @param target
   * @param value
   * @param data
   */
  async encodeExecute(
    target: string,
    value: BigNumberish,
    data: string
  ): Promise<string> {
    const accountContract = await this._getAccountContract();
    return accountContract.interface.encodeFunctionData("execute", [
      target,
      value,
      data,
    ]);
  }

  async encodeBatchExecute(data: [string[], BytesLike[]]): Promise<string> {
    const accountContract = await this._getAccountContract();
    return accountContract.interface.encodeFunctionData("executeBatch", data);
  }

  async signUserOpHash(userOpHash: string): Promise<string> {
    const accountInfo = await this.getAccountInfo();

    if (accountInfo) {
      const nonce = generateRandomString();
      const raw = JSON.stringify({
        nonce,
        origin: window.location.origin,
        txdata: userOpHash,
      });
      const airaccountToken = localStorage.getItem("airaccount_token");

      const myHeaders = new Headers();
      myHeaders.append("Authorization", `Bearer ${airaccountToken}`);
      const requestOptions = {
        method: "POST",
        body: raw,
        headers: myHeaders,
      };
      const response = await fetch(
        `${this.apiBaseUrl}/api/passkey/v1/tx/sign`,
        requestOptions
      );
      if (response.ok) {
        const body = await response.json();
        if (body.code === 200) {
          const json = body.data as PublicKeyCredentialRequestOptionsJSON;
          const attest = await startAuthentication(json);
          // console.log(attest)
          const requestOptions = {
            method: "POST",
            body: JSON.stringify(attest),
            headers: myHeaders,
          };

          const response2 = await fetch(
            `${this.apiBaseUrl}/api/passkey/v1/tx/sign/verify?origin=${window.location.origin}&nonce=${nonce}`,
            requestOptions as any
          );
          if (response2.ok) {
            const body2 = await response2.json();
            if (body2.code === 200) {
              if (body2.data.privateKey) {
                const signer = new ethers.Wallet(body2.data.privateKey);
                const sign0 = await signer.signMessage(arrayify(userOpHash));
                console.log({
                  userOpHash,
                  signMessage: sign0,
                  airAccount: body2.data.sign,
                  verifyResult: body2.data,
                });
                // return sign0
              }
              return body2.data.sign;
            }
            // console.log(body2)
          }
        }
      }
    }
    return "";
  }
}
