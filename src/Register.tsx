/* eslint-disable @typescript-eslint/no-explicit-any */
import { InputText } from "primereact/inputtext";
import styles from "./Register.module.css";
import { Panel } from "primereact/panel";
import { Button } from "primereact/button";
import { InputOtp } from "primereact/inputotp";
import { AirAccountAPI } from "./sdk/account/AirAccountAPI";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import { NetworkdConfig, networkIds } from "./config";
import { entryPointAddress } from "./sdk/AAStarClient";

function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [sendCaptchaLoading, setSendCaptchaLoading] = useState(false);
  const [sendCaptchaSuccess, setSendCaptchaSuccess] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const register = async () => {
    const airAccount = new AirAccountAPI({
      apiBaseUrl: "https://anotherairaccountcommunitynode.onrender.com",
      provider: new ethers.providers.JsonRpcProvider(
        NetworkdConfig[networkIds.OP_SEPOLIA].rpc
      ),
      entryPointAddress: entryPointAddress,
    });
    if (email && !captcha) {
      setSendCaptchaLoading(true);

      const result = await airAccount.sendCaptcha(email);
      if (result) {
        setSendCaptchaSuccess(true);
      }
      console.log(result);
      setSendCaptchaLoading(false);
    } else if (email && captcha) {
      airAccount.register(email, captcha);
    }
  };

  useEffect(() => {
    const airAccount = new AirAccountAPI({
      apiBaseUrl: "https://anotherairaccountcommunitynode.onrender.com",
      provider: new ethers.providers.JsonRpcProvider(
        NetworkdConfig[networkIds.OP_SEPOLIA].rpc
      ),
      entryPointAddress: entryPointAddress,
    });
    airAccount.getAccountInfo().then((data) => {
      console.log(data);
    });
  }, []);
  return (
    <div className={styles.Register}>
      <Panel >
        <div className={styles.emailRow}>
          {" "}
          <InputText
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          ></InputText>
          {sendCaptchaSuccess && (
            <InputOtp
              length={6}
              value={captcha}
              onChange={(event) => {
                if (event.value) {
                  setCaptcha(event.value as any);
                }
              }}
            />
          )}
          <Button
            loading={sendCaptchaLoading}
            onClick={() => {
              register();
            }}
          >
            Register
          </Button>
        </div>
      </Panel>
      <div className="flex align-items-center justify-content-center">
        <div className="surface-card p-4 shadow-2 border-round w-full lg:w-6">
          <div className="text-center mb-5">
            <img
              src="/demo/images/blocks/logos/hyper.svg"
              alt="hyper"
              height={50}
              className="mb-3"
            />
            <div className="text-900 text-3xl font-medium mb-3">
              Welcome Back
            </div>
            <span className="text-600 font-medium line-height-3">
              Don't have an account?
            </span>
            <a className="font-medium no-underline ml-2 text-blue-500 cursor-pointer">
              Create today!
            </a>
          </div>

          <div>
            <label htmlFor="email" className="block text-900 font-medium mb-2">
              Email
            </label>
            <InputText
              id="email"
              type="text"
              placeholder="Email address"
              className="w-full mb-3"
            />


            <Button label="Sign In" icon="pi pi-user" className={styles.SignInBtn}/>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
