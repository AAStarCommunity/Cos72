/* eslint-disable @typescript-eslint/no-explicit-any */
import styles from "./index.module.css";
import { ProgressSpinner } from "primereact/progressspinner";


function Loading() {
 
  return (
    <div className={styles.root}>
      <ProgressSpinner></ProgressSpinner>
    </div>
  );
}

export default Loading;
