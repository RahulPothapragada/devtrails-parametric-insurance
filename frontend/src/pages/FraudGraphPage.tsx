import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Activity, Info, Map as MapIcon, Layers, Radio, Crosshair, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons for Map
const riderIcon = (color: string, isAttack: boolean = false) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="position: relative; background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color}88;">
    ${isAttack ? '<div style="position: absolute; top: -16px; left: 6px; font-size: 16px; z-index: 100; filter: drop-shadow(0px 0px 2px rgba(0,0,0,0.8));">⚠️</div>' : ''}
  </div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const towerIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #3b82f6; width: 10px; height: 10px; transform: rotate(45deg); border: 1.5px solid white;"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5]
});

const CITIES = [
  { id: 'Mumbai', name: 'Mumbai', lat: 19.12, lng: 72.86, tier: 'Tier 1' },
  { id: 'Delhi', name: 'Delhi NCR', lat: 28.6139, lng: 77.209, tier: 'Tier 1' },
  { id: 'Bangalore', name: 'Bangalore', lat: 12.9716, lng: 77.5946, tier: 'Tier 1' },
  { id: 'Chennai', name: 'Chennai', lat: 13.0827, lng: 80.2707, tier: 'Tier 1' },
  { id: 'Kolkata', name: 'Kolkata', lat: 22.5726, lng: 88.3639, tier: 'Tier 1' },
  { id: 'Pune', name: 'Pune', lat: 18.5204, lng: 73.8567, tier: 'Tier 2' },
  { id: 'Hyderabad', name: 'Hyderabad', lat: 17.385, lng: 78.4867, tier: 'Tier 2' },
  { id: 'Ahmedabad', name: 'Ahmedabad', lat: 23.0225, lng: 72.5714, tier: 'Tier 2' },
  { id: 'Jaipur', name: 'Jaipur', lat: 26.9124, lng: 75.7873, tier: 'Tier 2' },
  { id: 'Lucknow', name: 'Lucknow', lat: 26.8467, lng: 80.9462, tier: 'Tier 3' },
  { id: 'Indore', name: 'Indore', lat: 22.7196, lng: 75.8577, tier: 'Tier 3' },
  { id: 'Patna', name: 'Patna', lat: 25.6093, lng: 85.1376, tier: 'Tier 3' },
  { id: 'Bhopal', name: 'Bhopal', lat: 23.2599, lng: 77.4126, tier: 'Tier 3' },
];


function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  useEffect(() => {
    map.flyTo(center, 13, { duration: 2.5, easeLinearity: 0.25 });
  }, [center, map]);
  return null;
}

export default function FraudGraphPage() {
  const [activeCity, setActiveCity] = useState(CITIES[0]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite'>('dark');
  const [showRadius, setShowRadius] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchLiveNetwork() {
      setLoading(true);
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/admin/maps/network?city_name=${activeCity.id}`);
        if (!response.ok) throw new Error('Network Database Offline');
        const payload = await response.json();
        // Insert a simulated Cell Tower node at the true city center for aesthetic radar effect
        const baseTower = { id: `T-${activeCity.id}`, name: `${activeCity.name} Central Hub`, type: 'tower', lat: payload.city_center[0], lng: payload.city_center[1] };
        setNodes([baseTower, ...payload.nodes]);
      } catch (err) {
        console.error('Failed to sync fast mapping:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLiveNetwork();
    setSelectedNode(null);
  }, [activeCity]);


  const dashboardStats = useMemo(() => {
    const spoofing = nodes.filter(n => n.status === 'spoofing').length;
    const attacks = nodes.filter(n => n.status === 'attack').length;
    return {
      activeNodes: nodes.length,
      threatLevel: attacks > 0 ? 'CRITICAL' : spoofing > 0 ? 'WARNING' : 'SECURE',
      totalSpoofing: spoofing + attacks
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
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-1">Active Nodes</span>
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

          {/* Controls */}
          <div className="space-y-4">
            <h2 className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Operational Zone</h2>
            <select 
              className="w-full bg-card border border-border rounded-xl px-4 h-11 text-sm font-bold text-foreground scrollbar-hide focus:outline-none focus:ring-1 focus:ring-primary/50"
              value={activeCity.id}
              onChange={(e) => setActiveCity(CITIES.find(c => c.id === e.target.value)!)}
            >
              <optgroup label="Tier 1 Cities">
                {CITIES.filter(c => c.tier === 'Tier 1').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
              <optgroup label="Tier 2 Cities">
                {CITIES.filter(c => c.tier === 'Tier 2').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
              <optgroup label="Tier 3 Cities">
                {CITIES.filter(c => c.tier === 'Tier 3').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            </select>

            <h2 className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-6">Interface Controls</h2>
            <div className="flex bg-muted/50 p-1 rounded-xl border border-border shadow-inner">
               <button 
                onClick={() => setMapStyle('dark')}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm",
                  mapStyle === 'dark' ? "bg-card text-foreground shadow-md ring-1 ring-primary/20" : "text-muted-foreground hover:text-foreground"
                )}
               >
                 <MapIcon className="w-3.5 h-3.5" /> Dark
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
        <MapContainer 
          center={[activeCity.lat, activeCity.lng]} 
          zoom={13} 
          className="h-full w-full"
          style={{ cursor: 'crosshair', filter: mapStyle === 'dark' ? 'invert(100%) hue-rotate(180deg) brightness(85%) contrast(110%) saturate(80%)' : 'none' }}
        >
          <TileLayer
            url={mapStyle === 'dark' 
              ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
              : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            }
            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
          />
          <MapController center={[activeCity.lat, activeCity.lng]} />

          {/* Links intentionally removed for a cleaner interface */}

          {/* Nodes */}
          {nodes.map(node => (
            <Marker 
              key={node.id} 
              position={[node.lat, node.lng]}
              icon={node.type === 'tower' ? towerIcon : riderIcon(
                node.status === 'attack' ? '#ef4444' : 
                node.status === 'spoofing' ? '#f59e0b' : '#10a37f',
                node.status === 'attack'
              )}
              eventHandlers={{
                click: () => setSelectedNode(node),
              }}
            >
              <Popup>
                <div className="p-1 font-sans">
                  <p className="font-bold text-sm leading-none pt-1">{node.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tight">{node.location}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

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
