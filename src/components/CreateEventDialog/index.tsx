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

function CreateEventDialog({
  onHide,
  visible,
  onCreate,
}: SendTokenDialogParams) {
  const toast = useRef<Toast>(null);

  const [name, setName] = useState<string | null>(null);
  const [pos, setPos] = useState<string | null>(null);
  const [desc, setDesc] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Dialog
      className={styles.SignInDialog}
      onHide={onHide}
      visible={visible}
      header={"Create Event"}
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
          <div>Location</div>
          <InputText
            value={pos}
            className={styles.input}
            onChange={(event) => {
              setPos(event.target.value);
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
        <div className={styles.inputRow}>
          <div>Link</div>
          <InputText
            value={link}
            className={styles.input}
            onChange={(event) => {
              setLink(event.target.value);
            }}
          ></InputText>
        </div>

        <div>
          <Button
            loading={loading}
            label="Create"
            className={styles.SignInBtn}
            onClick={() => {
              if (name && link && pos && desc && logo) {
                setLoading(true);
                onCreate(
                  {
                    name,
                    link,
                    desc,
                    logo,
                    pos
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

export default CreateEventDialog;
