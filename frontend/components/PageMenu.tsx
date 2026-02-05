"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type PageMenuItem = {
  label: string;
  href: string;
};

function MenuList({
  items,
  onSelect,
  menuClassName,
}: {
  items: PageMenuItem[];
  onSelect: (href: string) => void;
  menuClassName: string;
}) {
  return (
    <div role="menu" className={menuClassName}>
      {items.map((item) => (
        <button
          key={`${item.href}:${item.label}`}
          type="button"
          role="menuitem"
          className="block w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100"
          onClick={() => onSelect(item.href)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

type Props = {
  items: PageMenuItem[];
  className?: string;
  buttonAriaLabel?: string;
};

export default function PageMenu({
  items,
  className,
  buttonAriaLabel = "メニュー",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function onSelect(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div ref={rootRef} className={className}>
      {!open ? (
        <button
          type="button"
          aria-label={buttonAriaLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-md bg-white/70 shadow-sm ring-1 ring-black/10 backdrop-blur hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Image src="/menu.svg" alt="" width={22} height={22} />
        </button>
      ) : (
        <MenuList
          items={items}
          onSelect={onSelect}
          menuClassName="w-48 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black/10"
        />
      )}
    </div>
  );
}
