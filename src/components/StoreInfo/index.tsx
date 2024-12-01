import { Button } from "primereact/button";
import { Store } from "../../atoms/Community";
import styles from "./index.module.css";
import { useNavigate } from "react-router-dom";

export default function StoreInfo({ data, isShowEnter }: { data: Store, isShowEnter?:boolean }) {
    const navigate = useNavigate();
  return (
    <div className={styles.Root}>
    <div className={styles.storeInfo}>
        <div className={styles.storeImage}><img src={data.logo}></img></div>
        <div className={styles.storeText}>
            <div className={styles.storeName}>{data.name}</div>
            <div className={styles.storeDesc}>{data.description}</div>
        </div>
        </div>
        {
            isShowEnter &&   <Button label="Enter the store" onClick={() => {
                navigate(`/community/${data.communityAddress}/store/${data.address}`)
           }}></Button>
        }
      
        </div>
  );
}


