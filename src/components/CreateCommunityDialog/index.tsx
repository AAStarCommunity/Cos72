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

function CreateCommunityDialog({
  onHide,
  visible,
  onCreate,
}: SendTokenDialogParams) {
  const toast = useRef<Toast>(null);

  const [name, setName] = useState<string | null>(null);
  const [symbol, setSymbol] = useState<string | null>(null);
  const [desc, setDesc] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Dialog
      className={styles.SignInDialog}
      onHide={onHide}
      visible={visible}
      header={"Create Community"}
    >
      <Toast ref={toast} />
      <div className={styles.Register}>
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
          <div>Symbol</div>
          <InputText
            value={symbol}
            className={styles.input}
            onChange={(event) => {
              setSymbol(event.target.value);
            }}
          ></InputText>
        </div>
        <div className={styles.inputRow}>
          <div>Description</div>
          <InputText
            value={desc}
            className={styles.input}
            onChange={(event) => {
              setDesc(event.target.value);
            }}
          ></InputText>
        </div>
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

        <div>
          <Button
            loading={loading}
            label="Create"
            className={styles.SignInBtn}
            onClick={() => {
              if (name && symbol && desc && logo) {
                setLoading(true);
                onCreate(
                  {
                    name,
                    symbol,
                    desc,
                    logo
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

export default CreateCommunityDialog;
