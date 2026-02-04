"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

export type PageMenuItem = {
  label: string;
  href: string;
};

function MenuList({
  id,
  items,
  onSelect,
  menuClassName,
}: {
  id: string;
  items: PageMenuItem[];
  onSelect: (href: string) => void;
  menuClassName: string;
}) {
  return (
    <div id={id} role="menu" className={menuClassName}>
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
  // 「ディスプレイ幅に対してウィンドウ幅が50%以下ならアイコン表示」という要件に合わせる。
  // 初期値はSSR/初回描画の安定のため false（常時表示）にして、マウント後に計算して上書きする。
  const [useIconMode, setUseIconMode] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

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

  useEffect(() => {
    function update() {
      const screenWidth =
        typeof window.screen?.width === "number" && window.screen.width > 0
          ? window.screen.width
          : window.innerWidth;
      const ratio = window.innerWidth / screenWidth;
      setUseIconMode(ratio <= 0.5);
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  function onSelect(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div ref={rootRef} className={className}>
      {/* Wide window: menu always visible (no icon) */}
      {!useIconMode ? (
        <MenuList
          id={menuId}
          items={items}
          onSelect={onSelect}
          menuClassName="w-48 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black/10"
        />
      ) : null}

      {/* Narrow window (<= 50% of screen): icon + dropdown */}
      {useIconMode ? (
        <div>
          <button
            type="button"
            aria-label={buttonAriaLabel}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-md bg-white/70 shadow-sm ring-1 ring-black/10 backdrop-blur hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Image src="/menu.svg" alt="" width={22} height={22} />
          </button>

          {open ? (
            <MenuList
              id={menuId}
              items={items}
              onSelect={onSelect}
              menuClassName="mt-2 w-48 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black/10"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
