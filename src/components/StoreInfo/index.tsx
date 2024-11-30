import { Store } from "../../atoms/Community";
import styles from "./index.module.css";

export default function StoreInfo({ data }: { data: Store }) {
 
  return (
    <div className={styles.storeInfo}>
        <div className={styles.storeImage}><img src={data.logo}></img></div>
        <div className={styles.storeText}>
            <div className={styles.storeName}>{data.name}</div>
            <div className={styles.storeDesc}>{data.description}</div>
        </div>
        </div>
  );
}


