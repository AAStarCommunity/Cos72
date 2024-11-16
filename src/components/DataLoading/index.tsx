

import PacmanLoader from "react-spinners/PacmanLoader";
import styles from "./index.module.css"
export default function DataLoading() {
    return (
        <div className={styles.Root}>
            <PacmanLoader color='#3b82f6'  size={30}/> 
    </div>)
}
        