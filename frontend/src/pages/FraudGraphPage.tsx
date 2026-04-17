import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE } from '@/lib/api';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Activity, Info, Map as MapIcon, Layers, Radio, Crosshair, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Fallback coordinates if API doesn't return center (used before first fetch)
const CITY_COORDS: Record<string, [number, number]> = {
  Mumbai: [19.12, 72.86], Delhi: [28.6139, 77.209], Bangalore: [12.9716, 77.5946],
  Chennai: [13.0827, 80.2707], Kolkata: [22.5726, 88.3639],
  Pune: [18.5204, 73.8567], Hyderabad: [17.385, 78.4867], Ahmedabad: [23.0225, 72.5714],
  Jaipur: [26.9124, 75.7873], Lucknow: [26.8467, 80.9462], Indore: [22.7196, 75.8577],
  Patna: [25.6093, 85.1376], Bhopal: [23.2599, 77.4126],
};
const TIER_LABEL: Record<string, string> = { tier_1: 'Tier 1', tier_2: 'Tier 2', tier_3: 'Tier 3' };

const DEFAULT_CITY = { id: 'Mumbai', name: 'Mumbai', lat: 19.12, lng: 72.86, tier: 'Tier 1' };


function MapPanner({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.panTo({ lat, lng });
    if (zoom !== undefined) map.setZoom(zoom);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, zoom, map]);
  return null;
}

export default function FraudGraphPage() {
  const [searchParams] = useSearchParams();
  const requestedCity = searchParams.get('city');
  const [cities, setCities] = useState<typeof DEFAULT_CITY[]>([DEFAULT_CITY]);
  const [activeCity, setActiveCity] = useState(DEFAULT_CITY);
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [mapStyle, setMapStyle] = useState<'light' | 'satellite'>('light');
  const [showRadius, setShowRadius] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pinnedLocation, setPinnedLocation] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  // Load cities from backend
  useEffect(() => {
    fetch(`${API_BASE}/data/cities`)
      .then(r => r.json())
      .then((data: Array<{ name: string; tier: string }>) => {
        const mapped = data.map(c => {
          const coords = CITY_COORDS[c.name] || [19.12, 72.86];
          return { id: c.name, name: c.name, lat: coords[0], lng: coords[1], tier: TIER_LABEL[c.tier] || c.tier };
        });
        if (mapped.length > 0) {
          setCities(mapped);
          const requested = requestedCity
            ? mapped.find(c => c.name.toLowerCase() === requestedCity.toLowerCase())
            : null;
          setActiveCity(requested || mapped[0]);
        }
      })
      .catch(() => {});
  }, [requestedCity]);

  useEffect(() => {
    async function fetchLiveNetwork() {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/admin/maps/network?city_name=${activeCity.id}`);
        if (!response.ok) throw new Error('Network Database Offline');
        const payload = await response.json();
        // Insert a simulated Cell Tower node at the true city center for aesthetic radar effect
        const baseTower = { id: `T-${activeCity.id}`, name: `${activeCity.name} Central Hub`, type: 'tower', lat: payload.city_center[0], lng: payload.city_center[1] };
        // Update city coords from backend response
        if (payload.city_center) {
          setActiveCity(prev => ({ ...prev, lat: payload.city_center[0], lng: payload.city_center[1] }));
        }
        setNodes([baseTower, ...payload.nodes]);
      } catch (err) {
        console.error('Failed to sync fast mapping:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLiveNetwork();
    setSelectedNode(null);
    setPinnedLocation(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCity.id]); // only re-fetch when city changes, not when coords update from payload


  const dashboardStats = useMemo(() => {
    const riderNodes = nodes.filter(n => n.type === 'rider');
    const spoofing = riderNodes.filter(n => n.status === 'spoofing').length;
    const attacks = riderNodes.filter(n => n.status === 'attack').length;
    const anomalous = spoofing + attacks;
    const anomalyPct = riderNodes.length > 0 ? Math.round(anomalous / riderNodes.length * 100) : 0;
    return {
      activeNodes: riderNodes.length,
      threatLevel: attacks > 0 ? 'CRITICAL' : spoofing > 0 ? 'WARNING' : 'SECURE',
      totalSpoofing: anomalous,
      anomalyPct,
    };
  }, [nodes]);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden">
      {/* Sidebar Controls */}
      <div className="w-80 border-r bg-card flex flex-col shadow-sm z-10 shrink-0">
        <div className="p-6 border-b bg-muted/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
               <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Fraud Network</h1>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Real-time geospatial anomaly detection.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">

          {/* 1. City Selector — first */}
          <div className="space-y-2">
            <h2 className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Operational Zone</h2>
            <select
              className="w-full bg-card border border-border rounded-xl px-4 h-11 text-sm font-bold text-foreground scrollbar-hide focus:outline-none focus:ring-1 focus:ring-primary/50"
              value={activeCity.id}
              onChange={(e) => { const c = cities.find(c => c.id === e.target.value); if (c) setActiveCity(c); }}
            >
              <optgroup label="Tier 1 Cities">
                {cities.filter(c => c.tier === 'Tier 1').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
              <optgroup label="Tier 2 Cities">
                {cities.filter(c => c.tier === 'Tier 2').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
              <optgroup label="Tier 3 Cities">
                {cities.filter(c => c.tier === 'Tier 3').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            </select>
          </div>

          {/* 2. Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 p-3 rounded-lg border border-border relative">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-1">Total Riders</span>
              <span className="text-xl font-bold text-foreground font-mono">{loading ? '…' : dashboardStats.activeNodes}</span>
              {loading && <span className="absolute top-3 right-3 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-primary" /></span>}
            </div>
            <div className="bg-muted/30 p-3 rounded-lg border border-border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-1">Spoofing</span>
              <span className={cn("text-xl font-bold font-mono", dashboardStats.totalSpoofing > 0 ? "text-destructive" : "text-primary")}>
                {loading ? '…' : dashboardStats.totalSpoofing}
              </span>
            </div>
          </div>

          {/* 3. Anomaly Rate */}
          {!loading && dashboardStats.activeNodes > 0 && (
            <div className={cn("p-3 rounded-lg border", dashboardStats.anomalyPct > 15 ? "bg-destructive/10 border-destructive/30" : "bg-muted/30 border-border")}>
              <div className="flex items-end justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">% Riders Flagged</span>
                <span className={cn("text-lg font-bold font-mono", dashboardStats.anomalyPct > 15 ? "text-destructive" : "text-[#f59e0b]")}>
                  {dashboardStats.anomalyPct}%
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-700", dashboardStats.anomalyPct > 15 ? "bg-destructive" : "bg-[#f59e0b]")}
                  style={{ width: `${dashboardStats.anomalyPct}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {dashboardStats.activeNodes - dashboardStats.totalSpoofing} clean · {dashboardStats.totalSpoofing} flagged
              </p>
            </div>
          )}

          {/* 4. Flagged Riders — click to pinpoint on map */}
          <div className="space-y-2">
            <h2 className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Flagged Riders</h2>
            {loading ? (
              <p className="text-xs text-muted-foreground italic text-center py-3">Scanning network…</p>
            ) : nodes.filter((n: any) => n.type === 'rider' && n.status !== 'normal').length === 0 ? (
              <p className="text-xs text-primary font-medium text-center py-3">✓ No anomalies detected</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border">
                {nodes.filter((n: any) => n.type === 'rider' && n.status !== 'normal').map((rider: any) => (
                  <div
                    key={rider.id}
                    onClick={() => {
                      setSelectedNode(rider);
                      setPinnedLocation({ lat: rider.lat, lng: rider.lng, zoom: 16 });
                    }}
                    className={cn("p-2.5 rounded-lg border text-xs cursor-pointer transition-colors",
                      selectedNode?.id === rider.id ? "bg-destructive/10 border-destructive/40" : "bg-card hover:bg-muted border-border"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground truncate">{rider.name}</span>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-1",
                        rider.status === 'attack' ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                      )}>
                        {rider.status === 'attack' ? 'ATTACK' : 'SPOOF'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{rider.location} · {rider.verdict}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Map Controls */}
          <div className="space-y-3">
            <h2 className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Interface Controls</h2>
            <div className="flex bg-muted/50 p-1 rounded-xl border border-border shadow-inner">
               <button 
                onClick={() => setMapStyle('light')}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm",
                  mapStyle === 'light' ? "bg-card text-foreground shadow-md ring-1 ring-primary/20" : "text-muted-foreground hover:text-foreground"
                )}
               >
                 <MapIcon className="w-3.5 h-3.5" /> Light
               </button>
               <button 
                onClick={() => setMapStyle('satellite')}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm",
                  mapStyle === 'satellite' ? "bg-card text-foreground shadow-md ring-1 ring-primary/20" : "text-muted-foreground hover:text-foreground"
                )}
               >
                 <Layers className="w-3.5 h-3.5" /> Satellite
               </button>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowRadius(!showRadius)}
              className={cn(
                "w-full justify-start h-10 rounded-xl px-4 font-bold text-xs ring-offset-background transition-all",
                showRadius ? "bg-primary/10 border-primary/40 text-primary" : "text-muted-foreground"
              )}
            >
              <Radio className={cn("w-4 h-4 mr-3", showRadius && "animate-pulse")} />
              Toggle Tower Coverage ({showRadius ? 'ON' : 'OFF'})
            </Button>
          </div>

        </div>

        {/* Legend */}
        <div className="p-6 bg-muted/20 border-t border-border">
           <div className="flex flex-col gap-3">
             <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
               <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/10" /> Connected Rider
             </div>
             <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
               <div className="w-3 h-3 rounded-full bg-destructive shadow-[0_0_8px_var(--destructive)]" /> High-Risk Anomaly
             </div>
             <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
               <div className="w-[10px] h-[10px] rotate-45 bg-blue-500 border border-white" /> Network Infrastructure
             </div>
           </div>
        </div>
      </div>

      {/* Main Map View */}
      <div className="flex-1 relative bg-muted">
        <APIProvider apiKey={GMAPS_KEY}>
          <Map
            defaultCenter={{ lat: activeCity.lat, lng: activeCity.lng }}
            defaultZoom={13}
            mapId={mapStyle === 'light' ? 'fraud-map-light' : 'fraud-map-dark'}
            mapTypeId={mapStyle === 'satellite' ? 'satellite' : 'roadmap'}
            disableDefaultUI={true}
            gestureHandling="greedy"
            className="h-full w-full"
            style={{ cursor: 'crosshair' }}
          >
            <MapPanner
              lat={pinnedLocation?.lat ?? activeCity.lat}
              lng={pinnedLocation?.lng ?? activeCity.lng}
              zoom={pinnedLocation?.zoom}
            />

            {/* Nodes */}
            {nodes.map(node => {
              const isTower = node.type === 'tower';
              const color = isTower ? '#3b82f6'
                : node.status === 'attack' ? '#ef4444'
                : node.status === 'spoofing' ? '#f59e0b'
                : '#10a37f';
              return (
                <AdvancedMarker
                  key={node.id}
                  position={{ lat: node.lat, lng: node.lng }}
                  onClick={() => setSelectedNode(node)}
                  title={node.name}
                >
                  {isTower ? (
                    <div style={{
                      background: color, width: 12, height: 12,
                      transform: 'rotate(45deg)', border: '1.5px solid white',
                      boxShadow: `0 0 8px ${color}88`
                    }} />
                  ) : (
                    <div style={{ position: 'relative' }}>
                      {selectedNode?.id === node.id && (
                        <div style={{
                          position: 'absolute', inset: -6, borderRadius: '50%',
                          border: `2px solid ${color}`, animation: 'ping 1s ease-in-out infinite',
                          opacity: 0.6,
                        }} />
                      )}
                      <div style={{
                        background: color, borderRadius: '50%',
                        width: selectedNode?.id === node.id ? 20 : 14,
                        height: selectedNode?.id === node.id ? 20 : 14,
                        border: '2px solid white', boxShadow: `0 0 ${selectedNode?.id === node.id ? 16 : 10}px ${color}88`,
                        transition: 'all 0.2s ease',
                      }} />
                      {node.status === 'attack' && (
                        <div style={{
                          position: 'absolute', top: -18, left: 4,
                          fontSize: 14, filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))'
                        }}>⚠️</div>
                      )}
                    </div>
                  )}
                </AdvancedMarker>
              );
            })}
          </Map>
        </APIProvider>

        {/* Floating Node Inspector */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              className="absolute bottom-4 right-4 w-72 z-[1000] rounded-xl border bg-card/95 backdrop-blur-xl shadow-xl overflow-hidden"
            >
              <div className={cn("h-1 w-full", selectedNode.status === 'attack' ? "bg-destructive" : selectedNode.status === 'spoofing' ? "bg-amber-500" : "bg-primary")} />
              <div className="p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center border shrink-0",
                      selectedNode.risk === 'extreme' ? "bg-destructive/10 border-destructive/20 text-destructive" :
                      selectedNode.risk === 'high' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                      "bg-blue-500/10 border-blue-500/20 text-blue-500"
                    )}>
                      {selectedNode.type === 'tower' ? <Crosshair className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground leading-none">{selectedNode.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{selectedNode.id}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                    <Crosshair className="w-3.5 h-3.5 text-muted-foreground rotate-45" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-2.5 py-1.5 rounded-lg bg-muted/40 text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5"><MapIcon className="w-3 h-3" /> Location</span>
                    <span className="font-mono font-bold text-foreground">{selectedNode.lat.toFixed(4)}, {selectedNode.lng.toFixed(4)}</span>
                  </div>

                  {selectedNode.type === 'rider' && (
                    <div className={cn("px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2",
                      selectedNode.risk === 'extreme' ? "bg-destructive/10 border border-destructive/20" : "bg-amber-500/10 border border-amber-500/20"
                    )}>
                      {selectedNode.risk === 'extreme' ? <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" /> : <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      <span className={cn("font-semibold leading-tight", selectedNode.risk === 'extreme' ? "text-destructive" : "text-amber-600")}>
                        {selectedNode.verdict || 'Anomaly Detected'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
