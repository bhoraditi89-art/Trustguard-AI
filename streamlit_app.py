"""Optional standalone dashboard for running TrustGuard without the web artifact.

Run from the repository root:
    streamlit run dashboard/streamlit_app.py
"""

from __future__ import annotations

import os
from collections import Counter

import requests
import streamlit as st

st.set_page_config(page_title="TrustGuard AI", page_icon="TG", layout="wide")

st.title("TrustGuard AI")
st.caption("A clearer read on the language trying to move you.")

api_url = os.getenv("TRUSTGUARD_API_URL", "http://localhost:8000")

with st.sidebar:
    st.subheader("Live analyzer")
    copy = st.text_area(
        "Paste page copy",
        placeholder="Only 2 left — hurry!\nNo thanks, I prefer to miss out.",
        height=180,
    )
    scan = st.button("Analyze content", type="primary", use_container_width=True)

if scan:
    items = [line.strip() for line in copy.splitlines() if line.strip()]
    if not items:
        st.warning("Add at least one line of page copy.")
    else:
        try:
            response = requests.post(f"{api_url}/analyze", json=items, timeout=8)
            response.raise_for_status()
            st.session_state["results"] = response.json()
        except requests.RequestException as error:
            st.error(f"Analyzer unavailable: {error}")

results = st.session_state.get("results", [])
counts = Counter(item["category"] for item in results)
average = round(sum(item["threatScore"] for item in results) / len(results)) if results else 0

metric_a, metric_b, metric_c = st.columns(3)
metric_a.metric("Trust score", f"{max(0, 100 - average)}/100")
metric_b.metric("Items flagged", len(results))
metric_c.metric("API", "Connected" if results or scan else "Ready")

left, right = st.columns([1.4, 1])
with left:
    st.subheader("Recent scans")
    st.dataframe(
        [
            {"domain": "pricing.example.test", "flags": 3, "risk": 72, "when": "8 min ago"},
            {"domain": "dailybrief.example.test", "flags": 2, "risk": 44, "when": "1 hr ago"},
            {"domain": "workspace.example.test", "flags": 1, "risk": 38, "when": "Yesterday"},
        ],
        use_container_width=True,
        hide_index=True,
    )
with right:
    st.subheader("Pattern distribution")
    chart_data = {category: counts.get(category, 0) for category in ["False Urgency", "Hidden Cost", "Confirmshaming"]}
    st.bar_chart(chart_data, horizontal=True)

st.subheader("Current scan readout")
if results:
    for item in results:
        with st.expander(f"{item['category']} · {item['threatScore']}/100"):
            st.write(item["text"])
            st.caption(item["reason"])
            st.write("Signals:", ", ".join(item["signals"]))
else:
    st.info("Run a scan to see explainable findings here.")