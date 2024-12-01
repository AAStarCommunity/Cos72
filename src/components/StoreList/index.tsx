import {  Store } from "../../atoms/Community";
import styles from "./index.module.css";
import { useNavigate } from "react-router-dom";
export default function StoreList({ data }: { data: Store[] }) {
  const navigate = useNavigate();
  return (
    <div className={styles.StoreList}>
    {data.map((store: Store) => {
      return (
        <div className={styles.Store} key={`${store.address}`} >
          <div className={styles.StoreInfo} onClick={() => {
              navigate(`/community/${store.communityAddress}/store/${store.address}`)
          }}>
            <img src={store.logo} className={styles.StoreImage}></img>
            <div className={styles.GoodsName}>{store.name}</div>
          </div>
          <div className={styles.StoreGoodsList}>
            {store.goodsList.map((item) => {
              return (
                <div
                  className={styles.StoreGoods}
                  key={item.uuid}
                  onClick={() => {
                    navigate(`/community/${store.communityAddress}/store/${store.address}/goods/${item.id.toNumber()}`)
                  }}
                >
                  <img
                    src={item.images[0]}
                    className={styles.StoreGoodsImage}
                  ></img>

                  <div className={styles.StoreGoodsPrice}>
                    <div>
                      {item.price} {item.payTokenSymbol}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
  );
}
