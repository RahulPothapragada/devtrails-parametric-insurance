/**
 * Simulation scenarios and event timelines.
 * Each scenario produces a timed sequence of events that stream into the UI.
 */

export interface SimEvent {
  id: string;
  timestamp: string;     // e.g. "T+2s"
  phase: 'trigger' | 'consensus' | 'claims' | 'fraud_wall' | 'result' | 'payout';
  title: string;
  description: string;
  status: 'info' | 'success' | 'danger' | 'warning';
  wallNumber?: number;
  data?: Record<string, unknown>;
}

export interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  gradient: string;
  borderColor: string;
  triggerType: string;
  location: string;
  triggerValue: string;
  totalClaims: number;
  genuineRiders: number;
  fraudRiders: number;
  totalPayout: string;
  totalBlocked: string;
  events: SimEvent[];
}

// ─── Mumbai Monsoon ──────────────────────────────────────
const mumbaiMonsoon: Scenario = {
  id: 'mumbai_monsoon',
  title: 'Mumbai Monsoon Deluge',
  subtitle: '89mm rainfall hits Andheri West — dark stores pause dispatch',
  icon: '🌧️',
  gradient: 'from-blue-600/20 to-cyan-600/20',
  borderColor: 'border-blue-500/30',
  triggerType: 'Heavy Rainfall',
  location: 'Andheri West, Mumbai',
  triggerValue: '89mm/day (threshold: 64.5mm)',
  totalClaims: 500,
  genuineRiders: 227,
  fraudRiders: 261,
  totalPayout: '₹86,260',
  totalBlocked: '₹1,04,400',
  events: [
    { id: 'm1', timestamp: 'T+0s', phase: 'trigger', title: 'TRIGGER DETECTED', description: 'Rainfall exceeds 64.5mm threshold in Andheri West zone. IMD reports 89mm in 6 hours.', status: 'danger' },
    { id: 'm2', timestamp: 'T+1s', phase: 'consensus', title: 'Source 1: OpenWeatherMap', description: 'Rainfall 89.2mm confirmed. Humidity 98%. Visibility 200m.', status: 'success' },
    { id: 'm3', timestamp: 'T+2s', phase: 'consensus', title: 'Source 2: Dark Store #47', description: 'Dispatch PAUSED at 14:22 IST. Zero orders queued.', status: 'success' },
    { id: 'm4', timestamp: 'T+3s', phase: 'consensus', title: 'Source 3: Zone Rider Behavior', description: '87% of zone riders stopped working. Activity drop confirmed.', status: 'success' },
    { id: 'm5', timestamp: 'T+4s', phase: 'consensus', title: 'Source 4: IMD Cross-Reference', description: 'IMD Mumbai confirms "extremely heavy" classification for western suburbs.', status: 'success' },
    { id: 'm6', timestamp: 'T+5s', phase: 'consensus', title: '✓ CONSENSUS REACHED', description: '4/4 sources confirm genuine disruption. Processing 500 incoming claims.', status: 'info' },
    { id: 'm7', timestamp: 'T+6s', phase: 'claims', title: 'CLAIMS FLOOD', description: '500 claims received. Beginning 7-wall fraud analysis on all claims simultaneously.', status: 'warning' },
    { id: 'm8', timestamp: 'T+7s', phase: 'fraud_wall', title: 'Wall 1: Proof of Work', description: '180 riders had 3+ hours verified activity → auto-approved. 47 had 1-2 hours → proportional. 273 had zero deliveries → held.', status: 'warning', wallNumber: 1 },
    { id: 'm9', timestamp: 'T+8s', phase: 'fraud_wall', title: 'Wall 2: Device Fingerprint', description: '23 accounts share only 4 unique device fingerprints. Multi-account operation detected.', status: 'danger', wallNumber: 2 },
    { id: 'm10', timestamp: 'T+9s', phase: 'fraud_wall', title: 'Wall 3: Location Intelligence', description: '189 claimed riders\' WiFi BSSIDs don\'t match Andheri West zone. Actual locations: Thane, Navi Mumbai.', status: 'danger', wallNumber: 3 },
    { id: 'm11', timestamp: 'T+10s', phase: 'fraud_wall', title: 'Wall 4: Crowd Oracle', description: 'Peer comparison: only 227/500 claimants match zone-wide stop pattern. 273 are outliers.', status: 'danger', wallNumber: 4 },
    { id: 'm12', timestamp: 'T+11s', phase: 'fraud_wall', title: 'Wall 5: Graph Network', description: 'Louvain algorithm detected 4 fraud clusters. 48 accounts from same IP, 37 share UPI ID, 92 synchronized logins.', status: 'danger', wallNumber: 5 },
    { id: 'm13', timestamp: 'T+12s', phase: 'fraud_wall', title: 'Wall 6: Temporal Patterns', description: '201 held riders show 95%+ claim rate (zone avg: 35%). Login-trigger correlation: 0.97.', status: 'danger', wallNumber: 6 },
    { id: 'm14', timestamp: 'T+13s', phase: 'fraud_wall', title: 'Wall 7: Multi-Source Verification', description: '165 riders connected to cell towers in completely different areas. GPS vs tower mismatch confirmed.', status: 'danger', wallNumber: 7 },
    { id: 'm15', timestamp: 'T+15s', phase: 'result', title: 'VERDICT COMPLETE', description: '227 genuine riders approved. 261 fraudulent claims blocked. 12 edge cases held for 24hr review.', status: 'info' },
    { id: 'm16', timestamp: 'T+16s', phase: 'payout', title: '💰 PAYOUTS INITIATED', description: '₹86,260 disbursed to 227 riders via UPI. Average payout: ₹380. Fraud savings: ₹1,04,400.', status: 'success' },
  ],
};

// ─── Delhi Heatwave ──────────────────────────────────────
const delhiHeatwave: Scenario = {
  id: 'delhi_heatwave',
  title: 'Delhi Heatwave Emergency',
  subtitle: '47°C across NCR — IMD red alert issued for 6 hours',
  icon: '🔥',
  gradient: 'from-orange-600/20 to-red-600/20',
  borderColor: 'border-orange-500/30',
  triggerType: 'Extreme Heat',
  location: 'Anand Vihar, Delhi NCR',
  triggerValue: '47°C (threshold: 40°C)',
  totalClaims: 320,
  genuineRiders: 285,
  fraudRiders: 28,
  totalPayout: '₹1,45,350',
  totalBlocked: '₹14,280',
  events: [
    { id: 'd1', timestamp: 'T+0s', phase: 'trigger', title: 'TRIGGER DETECTED', description: 'Temperature exceeds 40°C threshold in Delhi NCR. IMD reports 47°C at Anand Vihar.', status: 'danger' },
    { id: 'd2', timestamp: 'T+1s', phase: 'consensus', title: 'Source 1: OpenWeatherMap', description: 'Temperature 46.8°C. Feels like 49°C. UV Index: Extreme.', status: 'success' },
    { id: 'd3', timestamp: 'T+2s', phase: 'consensus', title: 'Source 2: IMD Red Alert', description: 'IMD issues RED alert for NCR. "Avoid outdoor exposure" advisory active.', status: 'success' },
    { id: 'd4', timestamp: 'T+3s', phase: 'consensus', title: 'Source 3: Dark Store Cluster', description: '3 dark stores in Anand Vihar sector reduced operations. Dispatch rate down 70%.', status: 'success' },
    { id: 'd5', timestamp: 'T+4s', phase: 'consensus', title: '✓ CONSENSUS REACHED', description: '3/3 sources confirm. Heatwave event validated. Processing 320 claims.', status: 'info' },
    { id: 'd6', timestamp: 'T+5s', phase: 'claims', title: 'CLAIMS RECEIVED', description: '320 claims from NCR Zone Tier 1. Most riders stopped between 11 AM - 5 PM.', status: 'warning' },
    { id: 'd7', timestamp: 'T+6s', phase: 'fraud_wall', title: 'Wall 1: Proof of Work', description: '285 riders had verified morning shifts (6AM-11AM). 35 had no activity before heat peak.', status: 'warning', wallNumber: 1 },
    { id: 'd8', timestamp: 'T+7s', phase: 'fraud_wall', title: 'Wall 3: Location Intelligence', description: '28 riders\' device signals don\'t match NCR zones. Located in Faridabad, Ghaziabad periphery.', status: 'danger', wallNumber: 3 },
    { id: 'd9', timestamp: 'T+8s', phase: 'fraud_wall', title: 'Wall 5: Graph Network', description: 'No fraud rings detected. Isolated suspicious accounts only.', status: 'success', wallNumber: 5 },
    { id: 'd10', timestamp: 'T+9s', phase: 'fraud_wall', title: 'Wall 6: Temporal Patterns', description: '7 riders claiming for first time despite being registered 3+ months. Unusual onboarding-to-claim gap.', status: 'warning', wallNumber: 6 },
    { id: 'd11', timestamp: 'T+11s', phase: 'result', title: 'VERDICT COMPLETE', description: '285 genuine riders approved. 28 fraudulent blocked. 7 edge cases held for review.', status: 'info' },
    { id: 'd12', timestamp: 'T+12s', phase: 'payout', title: '💰 PAYOUTS INITIATED', description: '₹1,45,350 disbursed to 285 riders. Average payout: ₹510. Fraud savings: ₹14,280.', status: 'success' },
  ],
};

// ─── Bengaluru Bandh ─────────────────────────────────────
const bengaluruBandh: Scenario = {
  id: 'bengaluru_bandh',
  title: 'Bengaluru Bandh',
  subtitle: 'State-wide shutdown declared — all commercial activity halted',
  icon: '🏴',
  gradient: 'from-red-600/20 to-purple-600/20',
  borderColor: 'border-red-500/30',
  triggerType: 'Social Disruption',
  location: 'Bengaluru (City-Wide)',
  triggerValue: 'Official Bandh Declaration',
  totalClaims: 180,
  genuineRiders: 165,
  fraudRiders: 8,
  totalPayout: '₹69,300',
  totalBlocked: '₹3,360',
  events: [
    { id: 'b1', timestamp: 'T+0s', phase: 'trigger', title: 'TRIGGER DETECTED', description: 'Karnataka Bandh declared. NLP keyword match: "bandh" + "shutdown" confirmed in 6 news sources.', status: 'danger' },
    { id: 'b2', timestamp: 'T+1s', phase: 'consensus', title: 'Source 1: NewsAPI', description: '6 major outlets confirm bandh call. The Hindu, Deccan Herald, NDTV, Times of India reporting.', status: 'success' },
    { id: 'b3', timestamp: 'T+2s', phase: 'consensus', title: 'Source 2: Traffic Data', description: 'TomTom reports avg speed 3.2 km/hr across Bengaluru. Silk Board junction at standstill.', status: 'success' },
    { id: 'b4', timestamp: 'T+3s', phase: 'consensus', title: 'Source 3: Platform Operations', description: 'All 12 Bengaluru dark stores have SUSPENDED operations.', status: 'success' },
    { id: 'b5', timestamp: 'T+4s', phase: 'consensus', title: '✓ CONSENSUS REACHED', description: 'City-wide event confirmed. All Bengaluru riders eligible for protection.', status: 'info' },
    { id: 'b6', timestamp: 'T+5s', phase: 'claims', title: 'CLAIMS RECEIVED', description: '180 claims from all 3 Bengaluru zone tiers. City-wide event = simplified validation.', status: 'warning' },
    { id: 'b7', timestamp: 'T+6s', phase: 'fraud_wall', title: 'Wall 1: Proof of Work', description: '165 riders had scheduled shifts today. 15 had no recent activity in past 7 days.', status: 'warning', wallNumber: 1 },
    { id: 'b8', timestamp: 'T+7s', phase: 'fraud_wall', title: 'Wall 4: Crowd Oracle', description: 'City-wide shutdown: 95% of all Bengaluru riders stopped. Zone-level validation bypassed.', status: 'success', wallNumber: 4 },
    { id: 'b9', timestamp: 'T+8s', phase: 'fraud_wall', title: 'Wall 5: Graph Network', description: '8 accounts linked to known dormant cluster from previous bandh event. Previously flagged.', status: 'danger', wallNumber: 5 },
    { id: 'b10', timestamp: 'T+10s', phase: 'result', title: 'VERDICT COMPLETE', description: '165 genuine riders approved. 8 previously-flagged accounts blocked. 7 new riders held for review.', status: 'info' },
    { id: 'b11', timestamp: 'T+11s', phase: 'payout', title: '💰 PAYOUTS INITIATED', description: '₹69,300 disbursed to 165 riders. Average payout: ₹420. Clean event, minimal fraud.', status: 'success' },
  ],
};

// ─── 500-Rider GPS Spoofing Attack ───────────────────────
const spoofingAttack: Scenario = {
  id: 'spoofing_attack',
  title: 'The 500-Rider Attack',
  subtitle: 'Coordinated GPS spoofing ring attempts to drain the payout pool',
  icon: '💀',
  gradient: 'from-red-900/30 to-black/30',
  borderColor: 'border-red-600/40',
  triggerType: 'Adversarial Attack',
  location: 'Andheri West, Mumbai',
  triggerValue: 'GPS Spoofing + Fake Accounts',
  totalClaims: 500,
  genuineRiders: 227,
  fraudRiders: 273,
  totalPayout: '₹86,260',
  totalBlocked: '₹1,09,200',
  events: [
    { id: 'a1', timestamp: 'T+0s', phase: 'trigger', title: 'TRIGGER FIRES', description: 'Rain trigger fires in Andheri West. Genuine event — 89mm rainfall confirmed.', status: 'danger' },
    { id: 'a2', timestamp: 'T+1s', phase: 'consensus', title: 'EVENT VERIFIED', description: '4/4 sources confirm genuine disruption. Dark store paused, 87% zone riders stopped.', status: 'success' },
    { id: 'a3', timestamp: 'T+2s', phase: 'claims', title: '⚠️ ANOMALY: CLAIM SURGE', description: '500 claims received — 2.2× expected for zone population. Anomaly detection triggered.', status: 'danger' },
    { id: 'a4', timestamp: 'T+3s', phase: 'fraud_wall', title: 'Wall 1: Proof of Work', description: '180 had 3+ hrs deliveries → APPROVED. 47 had 1-2 hrs → proportional. 273 had ZERO deliveries → HELD.', status: 'danger', wallNumber: 1 },
    { id: 'a5', timestamp: 'T+5s', phase: 'fraud_wall', title: 'Wall 2: Device Fingerprint', description: '23 accounts sharing 4 device hashes detected. One device running 6 simultaneous "riders."', status: 'danger', wallNumber: 2 },
    { id: 'a6', timestamp: 'T+6s', phase: 'fraud_wall', title: 'Wall 3: Location Intelligence', description: 'WiFi BSSID analysis: 189 riders\' WiFi networks match Thane/Navi Mumbai, NOT Andheri West.', status: 'danger', wallNumber: 3 },
    { id: 'a7', timestamp: 'T+7s', phase: 'fraud_wall', title: 'Wall 4: Crowd Oracle', description: 'Peer comparison: genuine riders stopped at 14:22. 201 "riders" were never active in zone history.', status: 'danger', wallNumber: 4 },
    { id: 'a8', timestamp: 'T+9s', phase: 'fraud_wall', title: 'Wall 5: Graph Network — RING DETECTED', description: '🕸️ Louvain algorithm found 4 dense clusters: Cluster A (48 accounts, same IP), Cluster B (37, shared UPI), Cluster C (92, synchronized logins within 60s), Cluster D (96, linked device fingerprints).', status: 'danger', wallNumber: 5 },
    { id: 'a9', timestamp: 'T+11s', phase: 'fraud_wall', title: 'Wall 6: Temporal Patterns', description: 'Behavioral analysis: 201 accounts claim on 95% of events (zone avg: 35%). Login only within 15 min of triggers.', status: 'danger', wallNumber: 6 },
    { id: 'a10', timestamp: 'T+12s', phase: 'fraud_wall', title: 'Wall 7: Motion & Cell Tower', description: 'GPS shows movement across Andheri, but accelerometer reads 0.00 m/s². Cell towers confirm Thane, not Andheri.', status: 'danger', wallNumber: 7 },
    { id: 'a11', timestamp: 'T+14s', phase: 'result', title: '🛡️ ATTACK NEUTRALIZED', description: '261 fraud ring members FROZEN. 12 edge cases held for manual review. 227 genuine riders unaffected.', status: 'info' },
    { id: 'a12', timestamp: 'T+15s', phase: 'payout', title: '💰 GENUINE RIDERS PAID', description: '₹86,260 paid to 227 genuine riders in under 30 seconds. ₹1,09,200 in fraud BLOCKED. ₹0 lost to attackers.', status: 'success' },
  ],
};

export const SCENARIOS: Scenario[] = [
  mumbaiMonsoon,
  delhiHeatwave,
  bengaluruBandh,
  spoofingAttack,
];

// ─── Fraud Graph Data ────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  type: 'honest' | 'suspicious' | 'fraud_ring' | 'blocked';
  cluster?: number;
  fraudScore: number;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'shared_ip' | 'shared_upi' | 'shared_device' | 'sync_login' | 'same_pattern';
  strength: number;
}

export interface FraudGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function generateFraudGraphData(): FraudGraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // 20 honest riders — isolated / few connections
  for (let i = 1; i <= 20; i++) {
    nodes.push({
      id: `R-${String(i).padStart(3, '0')}`,
      label: `Rider ${i}`,
      type: 'honest',
      fraudScore: Math.floor(Math.random() * 15),
    });
  }

  // Cluster A: 6 accounts sharing same IP (fraud ring)
  for (let i = 21; i <= 26; i++) {
    nodes.push({
      id: `R-${String(i).padStart(3, '0')}`,
      label: `Rider ${i}`,
      type: 'fraud_ring',
      cluster: 1,
      fraudScore: 75 + Math.floor(Math.random() * 20),
    });
  }
  // Connect cluster A
  for (let i = 21; i <= 26; i++) {
    for (let j = i + 1; j <= 26; j++) {
      edges.push({
        source: `R-${String(i).padStart(3, '0')}`,
        target: `R-${String(j).padStart(3, '0')}`,
        type: 'shared_ip',
        strength: 0.9,
      });
    }
  }

  // Cluster B: 4 accounts sharing device fingerprint
  for (let i = 27; i <= 30; i++) {
    nodes.push({
      id: `R-${String(i).padStart(3, '0')}`,
      label: `Rider ${i}`,
      type: 'fraud_ring',
      cluster: 2,
      fraudScore: 80 + Math.floor(Math.random() * 15),
    });
  }
  for (let i = 27; i <= 30; i++) {
    for (let j = i + 1; j <= 30; j++) {
      edges.push({
        source: `R-${String(i).padStart(3, '0')}`,
        target: `R-${String(j).padStart(3, '0')}`,
        type: 'shared_device',
        strength: 0.85,
      });
    }
  }

  // Cluster C: 5 accounts with synchronized logins + shared UPI
  for (let i = 31; i <= 35; i++) {
    nodes.push({
      id: `R-${String(i).padStart(3, '0')}`,
      label: `Rider ${i}`,
      type: 'fraud_ring',
      cluster: 3,
      fraudScore: 85 + Math.floor(Math.random() * 10),
    });
  }
  for (let i = 31; i <= 35; i++) {
    for (let j = i + 1; j <= 35; j++) {
      edges.push({
        source: `R-${String(i).padStart(3, '0')}`,
        target: `R-${String(j).padStart(3, '0')}`,
        type: 'shared_upi',
        strength: 0.95,
      });
    }
  }

  // A few suspicious but not-yet-confirmed nodes
  for (let i = 36; i <= 38; i++) {
    nodes.push({
      id: `R-${String(i).padStart(3, '0')}`,
      label: `Rider ${i}`,
      type: 'suspicious',
      fraudScore: 40 + Math.floor(Math.random() * 20),
    });
  }

  // A couple edges between suspicious nodes and one cluster
  edges.push({ source: 'R-036', target: 'R-023', type: 'sync_login', strength: 0.5 });
  edges.push({ source: 'R-037', target: 'R-028', type: 'same_pattern', strength: 0.4 });

  // A few very light connections between honest riders (normal)
  edges.push({ source: 'R-002', target: 'R-005', type: 'same_pattern', strength: 0.1 });
  edges.push({ source: 'R-008', target: 'R-012', type: 'sync_login', strength: 0.15 });

  return { nodes, edges };
}

export const FRAUD_GRAPH_DATA = generateFraudGraphData();

// ─── Story Mode Data (Rider Journey) ────────────────────

export interface StoryDay {
  day: string;
  dayNumber: number;
  title: string;
  subtitle: string;
  type: 'normal' | 'warning' | 'danger' | 'recovery' | 'summary';
  icon: string;
  earnings: {
    withFlowSecure: number;
    withoutFlowSecure: number;
  };
  details: {
    shifts: string;
    weather: string;
    aiAction?: string;
    triggerFired?: boolean;
    payoutAmount?: number;
    optimizationSavings?: number;
  };
  narrative: string;
}

export const STORY_DAYS: StoryDay[] = [
  {
    day: 'Monday',
    dayNumber: 1,
    title: 'Business as Usual',
    subtitle: 'Clear skies, normal operations',
    type: 'normal',
    icon: '☀️',
    earnings: { withFlowSecure: 820, withoutFlowSecure: 820 },
    details: {
      shifts: '4:00 PM – 12:00 AM',
      weather: '32°C, Clear, AQI 85',
    },
    narrative: 'Ravi works his regular evening shift at Dark Store #47, Andheri West. 18 deliveries completed. A normal day — the kind that pays for rent.',
  },
  {
    day: 'Tuesday',
    dayNumber: 2,
    title: 'Steady Earnings',
    subtitle: 'High demand day — extra orders',
    type: 'normal',
    icon: '📦',
    earnings: { withFlowSecure: 960, withoutFlowSecure: 960 },
    details: {
      shifts: '4:00 PM – 12:00 AM',
      weather: '31°C, Partly Cloudy, AQI 78',
    },
    narrative: 'Tuesday brings a surge. Office workers ordering groceries before the midweek lull. 22 deliveries. Ravi earns well today.',
  },
  {
    day: 'Wednesday',
    dayNumber: 3,
    title: 'AI Prediction Kicks In',
    subtitle: 'Heavy rain forecast for 2-8 PM — AI recommends shift change',
    type: 'warning',
    icon: '🤖',
    earnings: { withFlowSecure: 620, withoutFlowSecure: 200 },
    details: {
      shifts: '7:00 AM – 1:00 PM (AI-optimized)',
      weather: '28°C, Heavy Rain 2-8 PM',
      aiAction: 'Shift moved to morning to avoid disruption. Saved ₹420.',
      optimizationSavings: 420,
    },
    narrative: 'Sunday night, FlowSecure flagged Wednesday: "Heavy rain expected 2-8 PM. Your zone will likely pause dispatch." The AI recommended switching to a 7 AM – 1 PM shift. Ravi follows the recommendation and earns ₹620 before the rain hits. Without FlowSecure, he would have showed up at 4 PM, found the store closed, and earned just ₹200 from the hour before rain.',
  },
  {
    day: 'Thursday',
    dayNumber: 4,
    title: 'The Storm Hits',
    subtitle: '89mm rainfall — parametric insurance activates',
    type: 'danger',
    icon: '⛈️',
    earnings: { withFlowSecure: 380, withoutFlowSecure: 0 },
    details: {
      shifts: 'Cannot work — city-wide flooding',
      weather: '25°C, 89mm rainfall, Visibility 150m',
      triggerFired: true,
      payoutAmount: 380,
    },
    narrative: 'Thursday is catastrophic. 89mm of rain in 6 hours. BMC issues waterlogging alerts. Dark Store #47 pauses dispatch. All riders sent home. Without FlowSecure — Ravi earns ₹0. He sits at home, watching the rain, losing a full day of income. With FlowSecure — the parametric trigger fires automatically. 4/4 data sources confirm the event. The 7-wall fraud engine clears Ravi in under 3 seconds (he had 3+ hours of verified activity this week). ₹380 lands in his UPI account within 2 minutes. No forms. No calls.',
  },
  {
    day: 'Friday',
    dayNumber: 5,
    title: 'Recovery Day',
    subtitle: 'Rain clears — high demand, extra earnings',
    type: 'recovery',
    icon: '🌤️',
    earnings: { withFlowSecure: 1080, withoutFlowSecure: 1080 },
    details: {
      shifts: '10:00 AM – 10:00 PM (extended)',
      weather: '30°C, Clearing, AQI 92',
    },
    narrative: 'The storm passes. Pent-up demand explodes. People who couldn\'t order during the rain flood the app. Ravi works an extended 12-hour shift and earns ₹1,080 — his best day this week. The post-disruption rebound is real.',
  },
  {
    day: 'Saturday',
    dayNumber: 6,
    title: 'Weekend Rush',
    subtitle: 'Normal operations — weekend grocery demand',
    type: 'normal',
    icon: '🛒',
    earnings: { withFlowSecure: 890, withoutFlowSecure: 890 },
    details: {
      shifts: '2:00 PM – 11:00 PM',
      weather: '31°C, Clear, AQI 80',
    },
    narrative: 'A good Saturday. Weekend grocery orders keep Ravi busy. 20 deliveries across a 9-hour shift. Predictable, reliable income.',
  },
  {
    day: 'Sunday',
    dayNumber: 7,
    title: 'Week in Review',
    subtitle: 'FlowSecure\'s full impact becomes clear',
    type: 'summary',
    icon: '📊',
    earnings: { withFlowSecure: 310, withoutFlowSecure: 310 },
    details: {
      shifts: '4:00 PM – 8:00 PM (half day)',
      weather: '32°C, Clear, AQI 75',
    },
    narrative: 'Sunday evening. Ravi checks his weekly summary. The numbers tell the story.',
  },
];
