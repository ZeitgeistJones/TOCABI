"use client";

import React from "react";
import { Address } from "@scaffold-ui/components";
import { base } from "viem/chains";
import { ClientOnly } from "~~/components/ClientOnly";
import { HouseRulesModal } from "~~/components/HouseRulesModal";

const CONTRACT_ADDRESS = "0xDC03A2B68b56dF719aE1f51930bb790e33aDe595";

/**
 * Site footer
 */
export const Footer = () => {
  return (
    <div className="px-4 py-5" style={{ borderTop: "1px solid rgb(44 26 14 / 0.2)" }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
        {/* Wordmark */}
        <div className="flex flex-col items-center md:items-start">
          <span className="font-display font-black text-lg leading-none text-blood">TOCABI</span>
          <span className="font-numeric text-[0.55rem] uppercase tracking-[0.25em] text-ink-soft">
            Take Our Clawd And Build It.
          </span>
        </div>

        {/* Contract address */}
        <div className="flex items-center gap-3">
          <ClientOnly
            fallback={
              <span className="font-numeric text-xs text-ink-soft">
                {CONTRACT_ADDRESS.slice(0, 6)}…{CONTRACT_ADDRESS.slice(-4)}
              </span>
            }
          >
            <Address
              address={CONTRACT_ADDRESS as `0x${string}`}
              chain={base}
              blockExplorerAddressLink={`https://basescan.org/address/${CONTRACT_ADDRESS}`}
              size="xs"
            />
          </ClientOnly>
        </div>

        {/* House Rules */}
        <div className="flex items-center gap-4">
          <HouseRulesModal />
          <span className="text-faded">·</span>
          <a
            href={`https://basescan.org/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="link font-numeric text-xs uppercase tracking-widest text-ink-soft"
          >
            BaseScan ↗
          </a>
        </div>
      </div>
    </div>
  );
};
