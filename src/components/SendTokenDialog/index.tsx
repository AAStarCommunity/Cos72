/* eslint-disable @typescript-eslint/no-explicit-any */
import { InputText } from "primereact/inputtext";

import { Button } from "primereact/button";

import styles from "./index.module.css";
import { useRef, useState } from "react";
import { Dialog } from "primereact/dialog";

import { Toast } from "primereact/toast";

interface SendTokenDialogParams {
  onHide: () => void;
  onSend: (account: string, amount: string, callback: any) => void;
  visible: boolean;
}

function SendTokenDialog({ onHide, visible, onSend }: SendTokenDialogParams) {
  const toast = useRef<Toast>(null);
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [tokenAmount, setTokenAmount] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  

  return (
    <Dialog
      className={styles.SignInDialog}
      onHide={onHide}
      visible={visible}
      header={"Send USDT"}
    >
    <Toast ref={toast} />
   
    
      <div className={styles.Register}>
        <div className={styles.inputRow}>
          <div>Account address</div>
          <InputText
            value={accountAddress}
            className={styles.input}
            onChange={(event) => {
                setAccountAddress(event.target.value);
            }}
          ></InputText>
          </div>
          <div className={styles.inputRow}>
          <div>Token Amount</div>
          <InputText
            value={tokenAmount}
            className={styles.input}
            onChange={(event) => {
                setTokenAmount(event.target.value);
            }}
          ></InputText>
          </div>
       
   
       
          <div>
            <Button
              loading={loading}
              label="Send"
             
              className={styles.SignInBtn}
              onClick={() => {
                if (accountAddress && tokenAmount) {
                    setLoading(true)
                    onSend(accountAddress, tokenAmount, () => {
                        setLoading(false)
                    })
                }
                
              }}
            />
          </div>
        </div>

    </Dialog>
  );
}

export default SendTokenDialog;
