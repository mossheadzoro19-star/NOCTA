"use client";

import { motion } from "framer-motion";

export default function Hero() {
  return (
    <div className="relative text-center pt-[180px] pb-6 px-6">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="text-[clamp(2.6rem,5.5vw,4rem)] font-bold tracking-[-0.04em] leading-[1.1]"
      >
        <span className="text-nocta-text">Watch together.</span>
        <br />
        <span className="text-gradient">Stay connected.</span>
      </motion.h1>
    </div>
  );
}
