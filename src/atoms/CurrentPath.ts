
import { atom } from "jotai";

const currentPath = atom<string>("community");

export const currentPathAtom = atom(
  (get) => {
    return get(currentPath);
  },
  (_get, set, path: string) => {
    set(currentPath, path);
  },
)
