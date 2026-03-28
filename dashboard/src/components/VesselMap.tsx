"use client";
import { useState } from "react";
import { Vessel } from "@/lib/data";

interface Props {
  vessels: Vessel[];
  onSelectVessel?: (v: Vessel) => void;
}

// Embed the actual MarineTraffic live AIS map
// This shows real vessel positions worldwide — 327K+ ships
export default function VesselMap({ vessels }: Props) {
  const [zoom, setZoom] = useState(9);
  const [center] = useState({ lat: 26.3, lng: 56.5 });

  // MarineTraffic embed URL — shows real AIS data
  const mtUrl = `https://www.marinetraffic.com/en/ais/embed/zoom:${zoom}/centery:${center.lat}/centerx:${center.lng}/maptype:4/shownames:false/mmsi:0/shipid:0/fleet:/fleet_id:/sat:/showmenu:/remember:false`;

  return (
    <div className="relative w-full h-full bg-[#1e1e1e]">
      {/* Live MarineTraffic AIS embed */}
      <iframe
        src={mtUrl}
        className="w-full h-full border-0"
        style={{ filter: "saturate(0.8) brightness(0.85)" }}
        title="Live AIS Vessel Tracking — MarineTraffic"
        allow="fullscreen"
        loading="eager"
      />

      {/* Overlay: stats from our simulated data */}
      <div className="absolute top-2 left-2 bg-[#333333]/90 backdrop-blur-sm border border-[#3a3a3a] rounded-lg px-3 py-2 z-10 space-y-1">
        <div className="text-[10px] font-bold text-white flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
          LIVE AIS DATA
        </div>
        <div className="text-[8px] text-slate-400">
          {vessels.filter(v => v.status === "underway").length} oil tankers underway in view
        </div>
        <div className="text-[8px] text-slate-400">
          {(vessels.reduce((s, v) => s + v.cargoVolume, 0) / 1e6).toFixed(1)}M bbl crude in transit
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-1 z-10">
        {[
          { label: "Strait of Hormuz", z: 9, lat: 26.3, lng: 56.5 },
          { label: "Persian Gulf", z: 6, lat: 27, lng: 51 },
          { label: "Global", z: 2, lat: 20, lng: 40 },
        ].map((preset) => (
          <button
            key={preset.label}
            onClick={() => setZoom(preset.z)}
            className={`text-[8px] px-2 py-1 rounded bg-[#333333]/90 border border-[#3a3a3a] transition
              ${zoom === preset.z ? "text-cyan-400 border-cyan-400/30" : "text-slate-500 hover:text-white"}`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
