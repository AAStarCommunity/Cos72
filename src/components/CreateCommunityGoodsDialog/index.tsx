/* eslint-disable @typescript-eslint/no-explicit-any */
import { InputText } from "primereact/inputtext";

import { Button } from "primereact/button";

import styles from "./index.module.css";
import { useRef, useState } from "react";
import { Dialog } from "primereact/dialog";

import { Toast } from "primereact/toast";
import { FileUpload, FileUploadHandlerEvent } from "primereact/fileupload";
import { pinata, PinataGroup } from "../../config";
import { Dropdown } from "primereact/dropdown";
import { ethers } from "ethers";
import { useAtomValue } from "jotai";
import { currentChainAtom } from "../../atoms/CurrentChain";

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
  const currentChain = useAtomValue(currentChainAtom);
  
  const [name, setName] = useState<string | null>(null);

  const [logo, setLogo] = useState<string | null>(null);
  const [descImages, setDescImages] =  useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [payToken, setPayToken] = useState<string | null>(null);

  const [price, setPrice] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileUploadRef = useRef<any>(null);
  const descriptionfileUploadRef = useRef<any>(null);
  const uploadImage = async (event: FileUploadHandlerEvent) => {
    try {
      const cids = [];
   
      for(let i = 0, l = event.files.length; i < l; i++) {
        const upload = await pinata.upload.file(event.files[i]).group(PinataGroup);
        cids.push(upload.cid);
      }
      
      setLogo(cids.join(","));
      if (fileUploadRef) {
        fileUploadRef.current.clear();
        fileUploadRef.current.setUploadedFiles(event.files);
      }
      return true;
      
    } catch (error) {
      return false;
    }
  }

  const uploadDescriptionImage = async (event: FileUploadHandlerEvent) => {
    try {
      const cids = [];
      for(let i = 0, l = event.files.length; i < l; i++) {
        const upload = await pinata.upload.file(event.files[i]).group(PinataGroup);
        cids.push(upload.cid);
      }
     
      setDescImages(cids.join(","));
      if (descriptionfileUploadRef) {
        descriptionfileUploadRef.current.clear();
        descriptionfileUploadRef.current.setUploadedFiles(event.files);
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
            <div>Pay Token</div>
            <InputText
              value={payToken}
              className={styles.input}
              onChange={(event) => {
                setPayToken(event.target.value);
              }}
            ></InputText>
               <Dropdown  onChange={(e) => setPayToken(e.value.code)} options={[
                { name: 'ETH', code: ethers.constants.AddressZero },
                { name: 'USDC', code: currentChain.contracts.USDC },
               ]} optionLabel="name" 
                placeholder="Select a Token" className="w-full md:w-14rem" />
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
          <div>Goods Images</div>
          <InputText
            value={logo}
            className={styles.input}
            readOnly
            onChange={(event) => {
              setLogo(event.target.value);
            }}
          ></InputText>
           <FileUpload ref={fileUploadRef} multiple={true} name="logo[]" customUpload uploadHandler={uploadImage} accept="image/*" maxFileSize={1000000} emptyTemplate={<p className="m-0">Drag and drop files to here to upload.</p>} />
        </div>
        <div className={styles.inputRow}>
          <div>Description Images</div>
          <InputText
            value={descImages}
            className={styles.input}
            readOnly
            onChange={(event) => {
              setDescImages(event.target.value);
            }}
          ></InputText>
           <FileUpload ref={descriptionfileUploadRef} multiple={true} name="Description[]" customUpload uploadHandler={uploadDescriptionImage} accept="image/*" maxFileSize={1000000} emptyTemplate={<p className="m-0">Drag and drop files to here to upload.</p>} />
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
                descImages &&
                amount &&
                price
              ) {
                setLoading(true);
                onCreate(
                  {
                    name,
                    description,
                    images: logo,
                    descImages,
                    payToken,
                    price,
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
