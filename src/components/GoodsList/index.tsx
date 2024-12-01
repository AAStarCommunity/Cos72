import { Goods } from "../../atoms/Community";
import styles from "./index.module.css";
import { useNavigate } from "react-router-dom";
export default function GoodsList({ data }: { data: Goods[] }) {
  const navigate = useNavigate();
  return (
    <div className={styles.GoodsList}>
      {data.map((item: Goods) => {
        return (
          <div
            className={styles.Goods}
            key={item.uuid}
            onClick={() => {
              navigate(
                `/community/${item.communityAddress}/store/${
                  item.storeAddress
                }/goods/${item.id.toNumber()}`
              );
            }}
          >
            <img src={item.images[0]} className={styles.GoodsImage}></img>
            <div className={styles.GoodsName}>{item.name}</div>

            <div className={styles.CommunityGoodsPrice}>
              <div className={styles.GoodsPrice}>
                {item.price} {item.payTokenSymbol}
              </div>
            </div>

            <div className={styles.GoodsStore}>
              <div>{item.communityName}</div> <div>{item.storeName}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
