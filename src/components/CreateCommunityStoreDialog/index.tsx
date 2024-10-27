/* eslint-disable @typescript-eslint/no-explicit-any */
import { InputText } from "primereact/inputtext";

import { Button } from "primereact/button";

import styles from "./index.module.css";
import { useRef, useState } from "react";
import { Dialog } from "primereact/dialog";

import { FileUpload, FileUploadHandlerEvent } from "primereact/fileupload";
import { pinata } from "../../config";

interface SendTokenDialogParams {
  onHide: () => void;
  onCreate: (community: any, callback: any) => void;
  visible: boolean;
}

function CreateCommunityStoreDialog({
  onHide,
  visible,
  onCreate,
}: SendTokenDialogParams) {
 
  const [name, setName] = useState<string | null>(null);
  const [receiver, setReceiver] = useState<string | null>(null);
  const [desc, setDesc] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileUploadRef = useRef<any>(null);
  const uploadImage = async (event: FileUploadHandlerEvent) => {
    try {
      const upload = await pinata.upload.file(event.files[0]);
      setLogo(upload.cid);
      if (fileUploadRef) {
        fileUploadRef.current.clear();
        fileUploadRef.current.setUploadedFiles(event.files);
      }
      return true;
      
    } catch (error) {
      return false;
    }
  }
  return (
    <Dialog
      className={styles.SignInDialog}
      onHide={onHide}
      visible={visible}
      header={"Create Store"}
    >
      
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
          <div>Logo</div>
          <InputText
            value={logo}
            className={styles.input}
            readOnly
            onChange={(event) => {
              setLogo(event.target.value);
            }}
          ></InputText>
           <FileUpload ref={fileUploadRef} name="logo[]" customUpload uploadHandler={uploadImage} accept="image/*" maxFileSize={1000000} emptyTemplate={<p className="m-0">Drag and drop files to here to upload.</p>} />
        </div>

        <div>
          <Button
            loading={loading}
            label="Create"
            className={styles.SignInBtn}
            onClick={() => {
              if (name  && desc && logo && receiver) {
                setLoading(true);
                onCreate(
                  {
                    name,
                    description: desc,
                    image: logo,
                    receiver
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

export default CreateCommunityStoreDialog;
