"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { GeopoliticalEvent, RegionRisk } from "@/lib/data";

interface Props {
  events: GeopoliticalEvent[];
  regions: RegionRisk[];
  onSelectRegion?: (region: string) => void;
}

const REGION_GEO: Record<string, { center: [number, number]; zoom: number }> = {
  "Middle East": { center: [28, 48], zoom: 5 },
  "Eastern Europe": { center: [50, 35], zoom: 4 },
  Africa: { center: [5, 20], zoom: 3 },
  "Asia Pacific": { center: [25, 105], zoom: 3 },
  Americas: { center: [20, -90], zoom: 3 },
};

function riskColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 60) return "#f97316";
  if (score >= 40) return "#f59e0b";
  return "#22c55e";
}

export default function WorldRiskMap({ events, regions, onSelectRegion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: [25, 30], zoom: 2, zoomControl: false, attributionControl: false, minZoom: 2, maxZoom: 8, worldCopyJump: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", { maxZoom: 16 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;
    })();

    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    layersRef.current.forEach((l) => map.removeLayer(l));
    layersRef.current = [];

    regions.forEach((r) => {
      const geo = REGION_GEO[r.region];
      if (!geo) return;
      const color = riskColor(r.score);
      const regionEvents = events.filter((e) => e.region === r.region);

      // Risk zone circle
      const zone = L.circle(geo.center, { radius: 800000, color, fillColor: color, fillOpacity: 0.08, weight: 1, opacity: 0.3 }).addTo(map);
      layersRef.current.push(zone);

      // Center marker
      const marker = L.circleMarker(geo.center, { radius: Math.max(8, r.score / 6), color, fillColor: color, fillOpacity: 0.6, weight: 2 }).addTo(map);
      layersRef.current.push(marker);

      // Label
      const label = L.marker(geo.center, {
        icon: L.divIcon({
          className: "",
          html: `<div style="text-align:center;transform:translateX(-50%);margin-top:${Math.max(10, r.score / 6) + 4}px">
            <div style="color:${color};font-size:11px;font-weight:800;text-shadow:0 0 8px rgba(0,0,0,0.9)">${r.score}</div>
            <div style="color:#94a3b8;font-size:8px;font-weight:600;white-space:nowrap;text-shadow:0 0 6px rgba(0,0,0,0.9)">${r.region}</div>
          </div>`,
        }),
      }).addTo(map);
      layersRef.current.push(label);

      // Event dots around region
      regionEvents.forEach((e, i) => {
        const angle = (i / regionEvents.length) * Math.PI * 2;
        const lat = geo.center[0] + Math.cos(angle) * 3;
        const lng = geo.center[1] + Math.sin(angle) * 3;
        const sevColor = e.severity === "critical" ? "#ef4444" : e.severity === "high" ? "#f97316" : e.severity === "medium" ? "#f59e0b" : "#22c55e";

        const evMarker = L.circleMarker([lat, lng], { radius: 4, color: sevColor, fillColor: sevColor, fillOpacity: 0.7, weight: 1 }).addTo(map);
        evMarker.bindPopup(
          `<div style="font-family:system-ui;font-size:11px;color:#e2e8f0;min-width:200px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sevColor}"></span><span style="font-weight:800">${e.severity.toUpperCase()}</span><span style="color:#64748b;font-size:9px">${e.category}</span></div>
            <div style="font-weight:700;margin-bottom:4px">${e.title}</div>
            <div style="font-size:9px;color:#94a3b8;margin-bottom:4px">${e.summary}</div>
            <div style="font-size:9px;color:#3b82f6">Impact: ${e.impact}</div>
            <div style="font-size:8px;color:#64748b;margin-top:4px">Source: ${e.source}</div>
          </div>`,
          { className: "dark-popup", maxWidth: 280 }
        );
        layersRef.current.push(evMarker);
      });

      // Click to zoom + filter
      marker.on("click", () => {
        map.flyTo(geo.center, geo.zoom, { duration: 0.8 });
        setSelectedRegion(r.region);
        onSelectRegion?.(r.region);
      });
    });
  }, [events, regions, onSelectRegion]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" style={{ background: "#080808" }} />
      {selectedRegion && (
        <button onClick={() => { mapRef.current?.flyTo([25, 30], 2, { duration: 0.8 }); setSelectedRegion(null); }}
          className="absolute top-2 left-2 bg-[#333333]/90 border border-[#3a3a3a] rounded-lg px-2 py-1 text-[9px] text-slate-400 hover:text-white transition z-[1000]">
          ← Global View
        </button>
      )}
      {selectedRegion && (
        <div className="absolute top-2 right-2 bg-[#333333]/90 border border-[#3a3a3a] rounded-lg px-2.5 py-1.5 text-[9px] z-[1000]">
          <div className="text-white font-bold">{selectedRegion}</div>
          <div className="text-slate-500">{events.filter((e) => e.region === selectedRegion).length} active events</div>
        </div>
      )}
    </div>
  );
}
