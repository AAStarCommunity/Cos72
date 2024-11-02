/* eslint-disable @typescript-eslint/no-explicit-any */
import { InputText } from "primereact/inputtext";

import { Button } from "primereact/button";

import styles from "./index.module.css";
import { useRef, useState } from "react";
import { Dialog } from "primereact/dialog";

import { Toast } from "primereact/toast";

interface SendTokenDialogParams {
  onHide: () => void;
  onCreate: (community: any, callback: any) => void;
  visible: boolean;
}

function SentCommunityPointTokenDialog({
  onHide,
  visible,
  onCreate,
}: SendTokenDialogParams) {
  const toast = useRef<Toast>(null);

  const [account, setAccount] = useState<string | null>(null);
 
  const [amount, setAmount] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  return (
    <Dialog
      className={styles.SignInDialog}
      onHide={onHide}
      visible={visible}
      header={"Sent Point Token"}
    >
      <Toast ref={toast} />
      <div className={styles.Register}>
        <div className={styles.inputRow}>
          <div>Account</div>
          <InputText
            value={account}
            className={styles.input}
            onChange={(event) => {
              setAccount(event.target.value);
            }}
          ></InputText>
        </div>
      
        <div className={styles.inputRow}>
          <div>Amount</div>
          <InputText
            value={amount}
            className={styles.input}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
          ></InputText>
        </div>
   

        <div>
          <Button
            loading={loading}
            label="Send"
            className={styles.SignInBtn}
            onClick={() => {
              if (account  && amount ) {
                setLoading(true);
                onCreate(
                  {
                    account,
                    amount,
                   
                  },
                  () => {
                    setLoading(false);
                  }
                );
              }
            }}
          />
        </div>
      </div>
    </Dialog>
  );
}

export default SentCommunityPointTokenDialog;
