import { Avatar } from "primereact/avatar";
import styles from "./Embed.module.css";
import { Dialog } from "primereact/dialog";
import { useState } from "react";
import AccountSign from "./components/embed/AccountSign";
function App() {
  const [embedDialogVisible, setEmbedDialogVisible] = useState(false);
  return (
    <div className={styles.root}>
      <Avatar
        icon="pi pi-user"
        size="large"
        style={{
          backgroundColor: "#2196F3",
          color: "#ffffff",
          cursor: "pointer",
        }}
        shape="circle"
        onClick={() => {

          setEmbedDialogVisible(!embedDialogVisible);
        }}
      />
      <Dialog
        showHeader={false}
        visible={embedDialogVisible}
        position={"right"}
        style={{ width: "350px", height: "70vh" }}
        onHide={() => {
          if (!embedDialogVisible) return;
          setEmbedDialogVisible(false);
        }}
        draggable={false}
        resizable={false}
      
      >
        <AccountSign onComplete={() => {
            
        }}></AccountSign>
      </Dialog>
    </div>
  );
}

export default App;
