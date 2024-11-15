/* eslint-disable @typescript-eslint/no-explicit-any */

import { Dropdown } from "primereact/dropdown";
import { NetworkdConfig, networkIds } from "../../config";
import { useAtom } from "jotai";
import { currentChainAtom } from "../../atoms/CurrentChain";
const ChainList = [
    // NetworkdConfig[networkIds.OP_MAINNET],
    NetworkdConfig[networkIds.OP_SEPOLIA],
  //  NetworkdConfig[networkIds.BASE_SEPOLIA],
  ];
function NetworkSelector() {
  const [currentChain, setCurrentChainId] = useAtom(currentChainAtom)
 
  return (
    <Dropdown
    optionLabel="name"
    options={ChainList}
    value={currentChain}
    onChange={(e) => {
        setCurrentChainId(e.value.chainId);
    }}
  />
  );
}

export default NetworkSelector;
