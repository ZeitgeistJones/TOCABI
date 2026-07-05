"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick } from "~~/hooks/scaffold-eth";

type HeaderMenuLink = {
  label: string;
  href: string;
};

export const menuLinks: HeaderMenuLink[] = [
  { label: "The Board", href: "/" },
  { label: "Post a Bounty", href: "/create" },
  { label: "Rap Sheet", href: "/rap-sheet" },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href }) => {
        const isActive = pathname === href;
        return (
          <li key={href}>
            <Link
              href={href}
              passHref
              className={`${
                isActive ? "text-blood border-blood" : "border-transparent hover:text-blood"
              } font-numeric text-xs uppercase tracking-[0.18em] border-b-2 px-2 py-1 rounded-none transition-colors`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </>
  );
};

/**
 * Site header
 */
export const Header = () => {
  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <div
      className="sticky lg:static top-0 navbar bg-base-100 min-h-0 shrink-0 justify-between z-20 px-3 sm:px-5"
      style={{ borderBottom: "1px solid rgb(44 26 14 / 0.2)" }}
    >
      <div className="navbar-start w-auto lg:w-1/2">
        <details className="dropdown" ref={burgerMenuRef}>
          <summary className="ml-1 btn btn-ghost lg:hidden hover:bg-transparent">
            <Bars3Icon className="h-5 w-5" />
          </summary>
          <ul
            className="menu menu-compact dropdown-content mt-3 p-2 shadow-sm bg-base-100 rounded-none w-52 border border-ink/20"
            onClick={() => {
              burgerMenuRef?.current?.removeAttribute("open");
            }}
          >
            <HeaderMenuLinks />
          </ul>
        </details>
        <Link href="/" passHref className="hidden lg:flex items-center gap-3 ml-2 mr-8 shrink-0">
          <div className="flex flex-col">
            <span className="font-display font-black text-xl leading-none tracking-wide text-blood">TOCABI</span>
            <span className="font-numeric text-[0.55rem] uppercase tracking-[0.3em] text-ink-soft">
              Take Our Clawd And Build It.
            </span>
          </div>
        </Link>
        <ul className="hidden lg:flex lg:flex-nowrap menu menu-horizontal px-1 gap-2">
          <HeaderMenuLinks />
        </ul>
      </div>
      <div className="navbar-end grow mr-2">
        <RainbowKitCustomConnectButton />
      </div>
    </div>
  );
};
