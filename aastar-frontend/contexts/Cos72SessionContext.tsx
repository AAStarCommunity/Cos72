/**
 * Cos72 unified session (Phase 0 §0.1).
 *
 * The ONE session every module consumes. Cos72 is AirAccount-only — there is no
 * `window.ethereum` / EOA. After passkey login the session exposes the user's
 * AirAccount smart-account `address` and a single `send()` that performs a
 * gasless write: it delegates to `cosSend`, which prepares a sponsored UserOp on
 * the backend and signs the returned `userOpHash` with the device passkey. This
 * replaces every module's bespoke `window.ethereum` wallet layer.
 *
 * @module contexts/Cos72SessionContext
 */
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Address, Hash } from "viem";
import { accountAPI } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { assertUserOpHash } from "@/lib/webauthn-assert";
import { cosSend, type ContractCall } from "@/lib/sdk/cosTx";

interface Cos72Session {
  /** AirAccount smart-account address (null until login + account loaded). */
  address: Address | null;
  /** Passkey-authenticated (JWT present). */
  isConnected: boolean;
  isLoading: boolean;
  /** Gasless write: sponsored UserOp + passkey assertion over its userOpHash. */
  send: (call: ContractCall) => Promise<Hash>;
  /** Re-fetch the account address (e.g. after account creation). */
  refresh: () => Promise<void>;
}

const Cos72SessionCtx = createContext<Cos72Session | null>(null);

export function Cos72SessionProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated()) {
      setAddress(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await accountAPI.getAccount();
      setAddress((res.data?.address as Address) ?? null);
    } catch {
      setAddress(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Gasless write: cosSend handles encode → backend prepare → passkey assert → submit.
  const send = useCallback((call: ContractCall) => cosSend(call, assertUserOpHash), []);

  return (
    <Cos72SessionCtx.Provider
      value={{ address, isConnected: isAuthenticated(), isLoading, send, refresh }}
    >
      {children}
    </Cos72SessionCtx.Provider>
  );
}

/** Consume the Cos72 session. Throws if used outside the provider. */
export function useCos72Session(): Cos72Session {
  const ctx = useContext(Cos72SessionCtx);
  if (!ctx) throw new Error("useCos72Session must be used within <Cos72SessionProvider>");
  return ctx;
}
