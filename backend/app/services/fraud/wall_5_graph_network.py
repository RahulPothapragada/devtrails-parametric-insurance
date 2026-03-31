"""Wall 5 — Graph Network Analysis (0-20 pts). Fraud ring detection via NetworkX."""

import networkx as nx
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Rider
from app.services.mock_platform import SUSPICIOUS_DOMAINS

try:
    from community import community_louvain
    HAS_LOUVAIN = True
except ImportError:
    HAS_LOUVAIN = False

FRAUD_RING_MIN_SIZE = 3
MAX_SHARED_ATTRIBUTES = 2


async def check_graph_network(db: AsyncSession, rider_id: int) -> dict:
    result = await db.execute(select(Rider))
    all_riders = result.scalars().all()

    if len(all_riders) < 3:
        return {"passed": True, "score": 0.0, "details": {"reason": "Not enough riders for graph analysis"}}

    G = nx.Graph()
    for r in all_riders:
        G.add_node(r.id, name=r.name, zone_id=r.zone_id, suspicious=r.is_suspicious)

    # Edge 1: Shared device fingerprints
    device_groups = defaultdict(list)
    for r in all_riders:
        if r.device_fingerprint:
            device_groups[r.device_fingerprint].append(r.id)
    for fp, rids in device_groups.items():
        if len(rids) > 1:
            for i in range(len(rids)):
                for j in range(i + 1, len(rids)):
                    G.add_edge(rids[i], rids[j], reason="shared_device", weight=3.0)

    # Edge 2: Shared suspicious email domains
    domain_groups = defaultdict(list)
    for r in all_riders:
        if r.email and "@" in r.email:
            domain = r.email.split("@")[-1]
            if domain in SUSPICIOUS_DOMAINS:
                domain_groups[domain].append(r.id)
    for domain, rids in domain_groups.items():
        if len(rids) > 1:
            for i in range(len(rids)):
                for j in range(i + 1, len(rids)):
                    G.add_edge(rids[i], rids[j], reason="shared_suspicious_email_domain", weight=2.0)

    # Edge 3: Shared UPI IDs
    upi_groups = defaultdict(list)
    for r in all_riders:
        if r.upi_id:
            upi_groups[r.upi_id].append(r.id)
    for upi, rids in upi_groups.items():
        if len(rids) > 1:
            for i in range(len(rids)):
                for j in range(i + 1, len(rids)):
                    G.add_edge(rids[i], rids[j], reason="shared_upi", weight=4.0)

    # Community detection
    communities = {}
    if HAS_LOUVAIN and len(G.edges) > 0:
        communities = community_louvain.best_partition(G)

    issues = []
    score = 0.0

    if rider_id in G:
        neighbors = list(G.neighbors(rider_id))
        num_connections = len(neighbors)

        if num_connections > MAX_SHARED_ATTRIBUTES:
            score += min(num_connections * 4.0, 15.0)
            issues.append(f"Connected to {num_connections} other riders (max allowed: {MAX_SHARED_ATTRIBUTES})")

        if communities and rider_id in communities:
            community_id = communities[rider_id]
            community_members = [rid for rid, cid in communities.items() if cid == community_id]
            ring_size = len(community_members)
            if ring_size >= FRAUD_RING_MIN_SIZE:
                score += min(ring_size * 2.0, 10.0)
                issues.append(f"Part of a cluster of {ring_size} linked accounts")

    connections = []
    if rider_id in G:
        for neighbor in G.neighbors(rider_id):
            edge_data = G.get_edge_data(rider_id, neighbor)
            connections.append({
                "linked_rider_id": neighbor,
                "reason": edge_data.get("reason", "unknown") if edge_data else "unknown",
            })

    score = min(score, 20.0)
    return {"passed": score < 10.0, "score": round(score, 1), "details": {
        "total_connections": len(connections),
        "connections": connections[:10],
        "graph_nodes": G.number_of_nodes(),
        "graph_edges": G.number_of_edges(),
        "issues": issues,
    }}
