"use client";

import { motion } from "framer-motion";
import { Sunrise } from "lucide-react";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

function FloatingCard({
  index,
  className,
  children,
}: {
  index: number;
  className: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.6 + index * 0.15, ease }}
      className={`absolute z-10 ${className}`}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4 + index, repeat: Infinity, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function HeroFloatingCards() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block">
      {/* Top-left: Gmail-style email preview */}
      <FloatingCard index={0} className="left-[8%] top-[26%] xl:left-[14%]">
        <div
          className="w-[210px] rounded-[14px] bg-white p-3"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8623E] text-[11px] font-semibold text-white">
              M
            </span>
            <span className="text-[13px] font-semibold text-[#0b0b0f]">Mike Rodriguez</span>
            <span className="ml-auto text-[11px] text-[#6b6b72]">2m ago</span>
          </div>
          <p className="mt-2 truncate text-[12px] text-[#6b6b72]">
            Re: 24 Sycamore showing Saturday…
          </p>
        </div>
      </FloatingCard>

      {/* Top-right: Morning Brief pill */}
      <FloatingCard index={1} className="right-[8%] top-[22%] xl:right-[14%]">
        <div
          className="flex items-center gap-2 rounded-full bg-white px-4 py-2"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
          }}
        >
          <Sunrise className="h-4 w-4 text-[#E8A23E]" />
          <span className="text-[13px] font-medium text-[#0b0b0f]">Morning Brief</span>
          <motion.span
            className="h-2 w-2 rounded-full bg-[#E8623E]"
            animate={{ opacity: [1, 0.3, 1], scale: [1, 0.85, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </FloatingCard>

      {/* Bottom-left: Aria suggested reply */}
      <FloatingCard index={2} className="bottom-[18%] left-[6%] xl:left-[11%]">
        <div
          className="w-[240px] rounded-[14px] bg-white p-3"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
          }}
        >
          <span
            className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: "rgba(167,139,250,0.15)", color: "#7C5CDB" }}
          >
            AI
          </span>
          <p className="mt-2 line-clamp-2 font-serif text-[13px] italic leading-snug text-[#6b6b72]">
            {`Drafted: "Sounds great — Saturday 11am works perfectly. See you then!"`}
          </p>
        </div>
      </FloatingCard>

      {/* Bottom-right: Hot leads */}
      <FloatingCard index={3} className="bottom-[18%] right-[7%] xl:right-[12%]">
        <div
          className="w-[180px] rounded-[14px] bg-white p-3"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
          }}
        >
          <p className="text-[12px] font-semibold text-[#0b0b0f]">Hot leads today</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#E8623E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#E8A23E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3EA877]" />
          </div>
          <p className="mt-2 text-[11px] text-[#6b6b72]">3 ready • 2 warm</p>
        </div>
      </FloatingCard>
    </div>
  );
}

export default HeroFloatingCards;
