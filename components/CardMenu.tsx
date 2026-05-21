"use client";

import { Archive, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Action = {
  key: "edit" | "archive" | "delete";
  label: string;
  danger?: boolean;
  onSelect: () => void;
};

export function CardMenu({
  onEdit,
  onArchive,
  onDelete,
  className,
  label = "More actions",
}: {
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const actions: Action[] = [];
  if (onEdit)
    actions.push({ key: "edit", label: "Edit", onSelect: onEdit });
  if (onArchive)
    actions.push({ key: "archive", label: "Archive", onSelect: onArchive });
  if (onDelete)
    actions.push({
      key: "delete",
      label: "Delete",
      danger: true,
      onSelect: onDelete,
    });

  if (actions.length === 0) return null;

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-full border-[0.5px] border-transparent text-[#9498b0] transition hover:border-[#1e2230] hover:bg-[#12121e] hover:text-[#e8eaf2]"
      >
        <MoreHorizontal size={16} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-8 z-40 w-[152px] overflow-hidden rounded-[12px] border-[0.5px] border-[#1e2230] bg-[#0d0f16] shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                a.onSelect();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium transition ${
                a.danger
                  ? "text-[#c43838] hover:bg-[#1a0f0f]"
                  : "text-[#e8eaf2] hover:bg-[#12121e]"
              }`}
            >
              {a.key === "edit" ? (
                <Pencil size={13} />
              ) : a.key === "archive" ? (
                <Archive size={13} />
              ) : (
                <Trash2 size={13} />
              )}
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
