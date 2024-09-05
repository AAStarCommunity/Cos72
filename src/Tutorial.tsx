/* eslint-disable @typescript-eslint/no-explicit-any */

import { Panel } from "primereact/panel";
import styles from "./Tutorial.module.css";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";



function App() {

  return (
    <div className={styles.Root}>
        <div className={styles.DemoPanel}>
        <Panel header="Mint Test Token Demo" >
            <div className={styles.Input}><label>Account</label> <InputText width={"300px"}></InputText></div>
            <div className={styles.Input}><label>Amount </label> <InputText></InputText></div>
            <Button label="Mint"></Button>
        </Panel>
        </div>
        <div  className={styles.SourcePanel}>
                <Panel header="Source">

                </Panel>
        </div>
    </div>
  );
}

export default App;
