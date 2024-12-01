import { Community } from "../../atoms/Community";
import styles from "./index.module.css";

export default function CommunityInfo({ data }: { data: Community }) {
 
  return (
    <div className={styles.CommunityInfo}>
        <div className={styles.CommunityImage}><img src={data.logo}></img></div>
        <div className={styles.CommunityText}>
            <div className={styles.CommunityName}>{data.name}</div>
            <div className={styles.CommunityDesc}>{data.description}</div>
        </div>
        </div>
  );
}


