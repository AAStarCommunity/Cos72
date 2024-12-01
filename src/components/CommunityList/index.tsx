import {  Community, Store } from "../../atoms/Community";
import styles from "./index.module.css";
import { useNavigate } from "react-router-dom";
export default function CommunityList({ data }: { data: Community[] }) {
  const navigate = useNavigate();
  return (
    <div className={styles.CommunityList}>
    {data.map((community: Community) => {
      return (
        <div className={styles.Community} key={`${community.address}`} >
          <div className={styles.CommunityInfo} onClick={() => {
              navigate(`/community/${community.address}`)
          }}>
            <img src={community.logo} className={styles.CommunityImage}></img>
            <div className={styles.CommunityName}>{community.name}</div>
          </div>
          <div className={styles.CommunityStoreList}>
            {community.storeList.map((item: Store) => {
              return (
                <div
                  className={styles.CommunityStore}
                  key={item.address}
                  onClick={() => {
                    navigate(`/community/${community.address}/store/${item.address}`)
                  }}
                >
                  <img
                    src={item.logo}
                    className={styles.CommunityStoreImage}
                  ></img>
                 <div>{item.name}</div>
                 
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
