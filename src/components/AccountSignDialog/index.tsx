/* eslint-disable @typescript-eslint/no-explicit-any */
import { InputText } from "primereact/inputtext";

import { Button } from "primereact/button";
import { InputOtp } from "primereact/inputotp";
import styles from "./index.module.css";
import { useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import { AirAccountAPI } from "../../sdk/account/AirAccountAPI";
import { ethers } from "ethers";
import { NetworkdConfig, networkIds } from "../../config";
import { entryPointAddress } from "../../sdk/AAStarClient";
import { Toast } from "primereact/toast";
import AAStarLogo from "../../assets/logo-aastar.png";
import { useSetAtom } from "jotai";

import { userInfoAtom } from "../../atoms/UserInfo";
import { TabPanel, TabView } from "primereact/tabview";
import {
  useConnectModal,
 
} from '@rainbow-me/rainbowkit';
interface AccountSignDialogParams {
  onHide: () => void;
  visible: boolean;
}

function AccountSignDialog({ onHide, visible }: AccountSignDialogParams) {
  const toast = useRef<Toast>(null);
  const [email, setEmail] = useState<string | null>(localStorage.getItem("email"));
  const [loading, setLoading] = useState(false);
  const [captchaSuccess, sendCaptchaSuccess] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const { openConnectModal } = useConnectModal();
  const loadUserInfo = useSetAtom<any>(userInfoAtom);
  const register = async () => {
    const airAccount = new AirAccountAPI({
      provider: new ethers.providers.JsonRpcProvider(
        NetworkdConfig[networkIds.OP_SEPOLIA].rpc
      ),
      entryPointAddress: entryPointAddress,
    });
    if (email && !captcha) {
      setLoading(true);

      const result = await airAccount.login(email);
      if (result === false) {
        const sendCaptchaResult = await airAccount.sendCaptcha(email);
        if (sendCaptchaResult) {
          sendCaptchaSuccess(true);
        }
      }
      else {
        loadUserInfo();
        onHide();
      }
      
      // console.log(result);
      setLoading(false);
    } else if (email && captcha) {
      setLoading(true);
      const result = await airAccount.register(email, captcha);
      if (result === true) {
        loadUserInfo();
        onHide();
      }
      if (result === "invalid captcha") {
        if (toast.current) {
            toast.current?.show({severity:'error', summary: 'Error', detail:'Invalid captcha', life: 3000});
        }
      }
      setLoading(false);
    }
  };
  return (
    <Dialog
      className={styles.SignInDialog}
      onHide={onHide}
      visible={visible}
      header={"Sign in"}
    >
    <Toast ref={toast} />
   
      <div className={styles.WelcomeBack}><img src={AAStarLogo}></img> <div>Welcome Back</div></div>
      <TabView>
    <TabPanel header="Email">
    <div className={styles.Register}>
        <div className={styles.inputRow}>
          <div>Email address</div>
          <InputText
            value={email}
            className={styles.input}
            
            autoComplete={"on"}
            onChange={(event) => {
              setEmail(event.target.value);
              localStorage.setItem("email", event.target.value)
            }}
          ></InputText>
          </div>
       
            {captchaSuccess && (
              <div className={styles.inputRow}>
                <div>
                  <div>Verification code</div>
                  <div>
                    Enter the verification code sent to your email address
                  </div>
                </div>
                <InputOtp
                  length={6}
                  value={captcha}
                  onChange={(event) => {
                    if (event.value) {
                      setCaptcha(event.value as any);
                    }
                  }}
                />
              </div>
            )}
       
          <div>
            <Button
              loading={loading}
              label="Continue"
              icon="pi pi-user"
              className={styles.SignInBtn}
              onClick={  () => {
                register();
              }}
            />
          </div>
      </div>
    </TabPanel>
    <TabPanel header="Wallet">
    <div>
            <Button
              loading={loading}
              label="Connect Wallet"
              icon="pi pi-user"
              className={styles.SignInBtn}
              onClick={openConnectModal}
            />
          </div>
      </TabPanel>
    </TabView>
     
    
    </Dialog>
  );
}

export default AccountSignDialog;
