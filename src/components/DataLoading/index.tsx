
import { BlockUI } from 'primereact/blockui';
import PacmanLoader from "react-spinners/PacmanLoader";
export default function DataLoading({
    loading
} : {
    loading: boolean
}) {
    return (
        <BlockUI blocked={loading} fullScreen template={
            <div><PacmanLoader color='#2dd4bf'  size={50}/> </div>
        }>
 
    </BlockUI>)
}
        