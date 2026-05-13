"use client";

import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/landing/Hero";
import CreateJoinRoom from "@/components/landing/CreateJoinRoom";

export default function Home() {
  return (
    <main className="min-h-screen bg-nocta-bg relative">
      {/* Chromatic ambient light */}
      <div className="ambient-glow" />

      <Navbar />
      <Hero />
      <CreateJoinRoom />
    </main>
  );
}
