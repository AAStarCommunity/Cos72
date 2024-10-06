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

function CreateCommunityGoodsDialog({
  onHide,
  visible,
  onCreate,
}: SendTokenDialogParams) {
  const toast = useRef<Toast>(null);

  const [name, setName] = useState<string | null>(null);

  const [logo, setLogo] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [payToken, setPayToken] = useState<string | null>(null);
  const [receiver, setReceiver] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Dialog
      className={styles.SignInDialog}
      onHide={onHide}
      visible={visible}
      header={"Create Goods"}
    >
      <Toast ref={toast} />
      <div className={styles.Register}>
        <div className={styles.inputRowWrapper}>
          <div className={styles.inputRow}>
            <div>Name</div>
            <InputText
              value={name}
              className={styles.input}
              onChange={(event) => {
                setName(event.target.value);
              }}
            ></InputText>
          </div>

          <div className={styles.inputRow}>
            <div>Description</div>
            <InputText
              value={description}
              className={styles.input}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
            ></InputText>
          </div>
        </div>
        <div className={styles.inputRowWrapper}>
          <div className={styles.inputRow}>
            <div>Logo</div>
            <InputText
              value={logo}
              className={styles.input}
              onChange={(event) => {
                setLogo(event.target.value);
              }}
            ></InputText>
          </div>
          <div className={styles.inputRow}>
            <div>Pay Token</div>
            <InputText
              value={payToken}
              className={styles.input}
              onChange={(event) => {
                setPayToken(event.target.value);
              }}
            ></InputText>
          </div>
        </div>
        <div className={styles.inputRowWrapper}>
        <div className={styles.inputRow}>
          <div>Price</div>
          <InputText
            value={price}
            className={styles.input}
            onChange={(event) => {
              setPrice(event.target.value);
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
       </div>
          <div className={styles.inputRow}>
          

<div>Receiver</div>
          <InputText
            value={receiver}
            className={styles.input}
            onChange={(event) => {
              setReceiver(event.target.value);
            }}
          ></InputText>
          </div>
          <div className={styles.inputRow}>
          <Button
            loading={loading}
            label="Create"
            className={styles.SignInBtn}
            onClick={() => {
              if (
                name &&
                description &&
                logo &&
                payToken &&
                receiver &&
                amount &&
                price
              ) {
                setLoading(true);
                onCreate(
                  {
                    name,
                    description,
                    logo,
                    payToken,
                    price,
                    receiver,
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

export default CreateCommunityGoodsDialog;