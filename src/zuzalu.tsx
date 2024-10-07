import React from "react";
import ReactDOM from "react-dom/client";


import { PrimeReactProvider } from 'primereact/api';

import "primereact/resources/themes/lara-dark-teal/theme.css";
import 'primeicons/primeicons.css';
import App from "./Embed";
const nodeID = "__cos72__embed";
function initNode() {
   let node = document.getElementById(nodeID);
   if (!node) {
    node = document.createElement("div");
    node.id = nodeID;
    node.style.position = "fixed";
    node.style.right = "20px";
    node.style.bottom = "20px"
    node.style.zIndex = "3000";
    document.body.appendChild(node);

   }
   //const nodeID =  document.createElement("div")
}

initNode();

ReactDOM.createRoot(document.getElementById(nodeID)!).render(
  <React.StrictMode>
    <PrimeReactProvider>
        <App></App>
    </PrimeReactProvider>
  </React.StrictMode>
);
