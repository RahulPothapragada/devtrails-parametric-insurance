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


function MapPanner({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (map) map.panTo({ lat, lng });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, map]);
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

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 p-3 rounded-lg border border-border relative">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-1">Active Riders</span>
              <span className="text-xl font-bold text-foreground font-mono">{loading ? '...' : dashboardStats.activeNodes}</span>
              {loading && <span className="absolute top-3 right-3 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span></span>}
            </div>
            <div className="bg-muted/30 p-3 rounded-lg border border-border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-1">Threat Level</span>
              <span className={cn(
                "text-xs font-bold leading-tight pt-1 block",
                dashboardStats.threatLevel === 'SECURE' ? "text-primary" : "text-destructive"
              )}>
                {dashboardStats.threatLevel}
              </span>
            </div>
          </div>

          {/* Anomaly Rate — live computed from real rider nodes */}
          {!loading && dashboardStats.activeNodes > 0 && (
            <div className={cn(
              "p-3 rounded-lg border",
              dashboardStats.anomalyPct > 15
                ? "bg-destructive/10 border-destructive/30"
                : "bg-muted/30 border-border"
            )}>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-2">Anomalous Behaviour</span>
              <div className="flex items-end gap-2 mb-2">
                <span className={cn(
                  "text-2xl font-bold font-mono",
                  dashboardStats.anomalyPct > 15 ? "text-destructive" : "text-[#f59e0b]"
                )}>
                  {dashboardStats.anomalyPct}%
                </span>
                <span className="text-xs text-muted-foreground pb-0.5">
                  of riders in {activeCity.name}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", dashboardStats.anomalyPct > 15 ? "bg-destructive" : "bg-[#f59e0b]")}
                  style={{ width: `${dashboardStats.anomalyPct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {dashboardStats.totalSpoofing} riders flagged · {dashboardStats.activeNodes - dashboardStats.totalSpoofing} clean
              </p>
            </div>
          )}

          {/* Active Riders List */}
          <div className="space-y-3 mt-6">
            <h2 className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Active Riders Details</h2>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border">
              {nodes.filter((n: any) => n.type === 'rider').map((rider: any) => (
                <div 
                   key={rider.id}
                   onClick={() => setSelectedNode(rider)}
                   className={cn("p-2.5 rounded-lg border text-xs cursor-pointer hover:bg-muted font-medium flex items-center justify-between transition-colors",
                   selectedNode?.id === rider.id ? "bg-primary/10 border-primary" : "bg-card"
                   )}
                >
                   <span className="truncate flex-1">{rider.name}</span>
                   <span className={cn(
                     "w-2.5 h-2.5 rounded-full shrink-0 shadow-sm",
                     rider.status === 'attack' ? "bg-destructive border border-destructive/50" :
                     rider.status === 'spoofing' ? "bg-amber-500 border border-amber-500/50" : "bg-primary border border-primary/50"
                   )} />
                </div>
              ))}
              {nodes.filter((n: any) => n.type === 'rider').length === 0 && !loading && (
                <div className="text-xs text-muted-foreground italic p-2 text-center">Loading network activity...</div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
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

            <h2 className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-6">Interface Controls</h2>
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
            <MapPanner lat={activeCity.lat} lng={activeCity.lng} />

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
                      <div style={{
                        background: color, borderRadius: '50%', width: 14, height: 14,
                        border: '2px solid white', boxShadow: `0 0 10px ${color}88`
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
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="absolute bottom-10 left-10 right-10 md:left-auto md:right-10 md:w-96 z-[1000] rounded-2xl border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden shadow-primary/5"
            >
              <div className={cn(
                "h-1.5 w-full",
                selectedNode.status === 'attack' ? "bg-destructive shadow-[0_0_10px_var(--destructive)]" : 
                selectedNode.status === 'spoofing' ? "bg-amber-500" : "bg-primary"
              )} />
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                   <div className="flex items-center gap-4">
                     {selectedNode.type === 'tower' ? (
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                           <Crosshair className="w-6 h-6 text-blue-500" />
                        </div>
                     ) : (
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center border",
                          selectedNode.risk === 'extreme' ? "bg-destructive/10 border-destructive/20 text-destructive" :
                          selectedNode.risk === 'high' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                          "bg-primary/10 border-primary/20 text-primary"
                        )}>
                           <Activity className="w-6 h-6" />
                        </div>
                     )}
                     <div>
                        <h3 className="text-xl font-bold text-foreground leading-none">{selectedNode.name}</h3>
                        <p className="text-xs text-muted-foreground font-bold mt-2 uppercase tracking-widest">{selectedNode.id}</p>
                     </div>
                   </div>
                   <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)} className="h-8 w-8 rounded-full">
                     <Crosshair className="w-4 h-4 rotate-45" />
                   </Button>
                </div>

                <div className="space-y-4">
                   <div className="flex justify-between items-center p-3.5 rounded-xl border bg-muted/30">
                      <div className="flex items-center gap-3">
                         <MapIcon className="w-4 h-4 text-muted-foreground" />
                         <span className="text-xs font-bold text-muted-foreground">Geospatial Center</span>
                      </div>
                      <span className="text-xs font-bold text-foreground font-mono">{selectedNode.lat.toFixed(4)}, {selectedNode.lng.toFixed(4)}</span>
                   </div>

                   {selectedNode.type === 'rider' && (
                     <div className={cn(
                        "p-4 rounded-xl border flex items-center gap-4",
                        selectedNode.risk === 'extreme' ? "bg-destructive/10 border-destructive/20" : "bg-muted/50 border-border"
                     )}>
                        {selectedNode.risk === 'extreme' ? <AlertCircle className="w-5 h-5 text-destructive animate-bounce" /> : <Info className="w-5 h-5 text-primary" />}
                        <div>
                           <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none mb-1">Safety Verdict</p>
                           <p className={cn(
                              "text-xs font-bold",
                              selectedNode.risk === 'extreme' ? "text-destructive" : 
                              selectedNode.risk === 'high' ? "text-amber-500" : "text-foreground"
                           )}>
                              {selectedNode.verdict || (selectedNode.risk === 'extreme' ? 'CRITICAL: Multi-Proxy Relay Detected' : 
                               selectedNode.risk === 'high' ? 'High Risk Location Mismatch' : 'Nominal Signal Pattern')}
                           </p>
                        </div>
                     </div>
                   )}
                </div>

                <div className="mt-8">
                   <Button className="w-full rounded-xl h-11 bg-primary hover:bg-primary/90 font-bold">
                     Analyze Defense Packet <ChevronRight className="w-4 h-4 ml-2" />
                   </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
