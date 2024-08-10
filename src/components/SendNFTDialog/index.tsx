/* eslint-disable @typescript-eslint/no-explicit-any */
import { InputText } from "primereact/inputtext";

import { Button } from "primereact/button";

import styles from "./index.module.css";
import { useState } from "react";
import { Dialog } from "primereact/dialog";


interface SendTokenDialogParams {
  onHide: () => void;
  onSend: (account: string, tokenId: number, callback: any) => void;
  visible: boolean;
  tokenId: number | null;
}

function SendNFTDialog({ onHide, visible, onSend, tokenId }: SendTokenDialogParams) {
 
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  

  return (
    <Dialog
      className={styles.SignInDialog}
      onHide={onHide}
      visible={visible}
      header={"Send NFT"}
    >

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
       
       
   
       
          <div>
            <Button
              loading={loading}
              label="Send"
             
              className={styles.SignInBtn}
              onClick={() => {
                if (accountAddress && (tokenId !== null)) {
                    setLoading(true)
                    onSend(accountAddress, tokenId, () => {
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

export default SendNFTDialog;
