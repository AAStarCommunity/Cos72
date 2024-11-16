/* eslint-disable @typescript-eslint/no-explicit-any */

import { useAtom } from "jotai";

import { Community, communityListAtom, Order, Store } from "./atoms/Community";

import styles from "./Order.module.css";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";

function OrderApp() {
  const [communityList] = useAtom(communityListAtom);

  const orderList: Order[] = [];
  communityList.forEach((item: Community) => {
    item.storeList.forEach((store: Store) => {
      store.orderList.forEach((order: Order) => {
        orderList.push(order);
      });
    });
  });
  return (
    <div className={styles.Root}>
      <DataTable value={orderList}>
        <Column field="storeName" header="Store"></Column>
        <Column field="goodsName" header="Goods"></Column>
        <Column field="amount" header="Amount"></Column>
        <Column field="formatTime" header="Time"></Column>
      </DataTable>
    </div>
  );
}

export default OrderApp;
