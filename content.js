(() => {
  const STATE_KEY = "trustguard:lastScan";
  const scanned = new WeakSet();
  const urgencyRegex =
    /\b(hurry|act now|last chance|limited time|only \d+ left|ends? in|expires? in|don't miss|sale ends|offer expires?)\b|\b\d{1,2}\s*:\s*\d{2}(?::\s*\d{2})?\b/i;
  const priceRegex =
    /\b(additional|extra|processing|service|booking|handling)\s+(fee|charge|cost)s?\b|\bfees?\s+(may apply|added)\b/i;
  const shameRegex =
    /\b(no|not)\b.{0,25}\b(thanks?|thank you)\b|\b(i don't|i do not)\s+(want|need|like)\b|\b(don't|do not)\s+(become|be)\s+(cheap|selfish|behind)\b/i;

  const isVisible = (node) => {
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };

  const getCategory = (text) => {
    if (urgencyRegex.test(text)) return "False Urgency";
    if (priceRegex.test(text)) return "Hidden Cost";
    if (shameRegex.test(text)) return "Confirmshaming";
    return null;
  };

  const addBadge = (element, category) => {
    if (element.dataset.trustguardMarked) return;
    element.dataset.trustguardMarked = "true";
    element.style.setProperty("outline", "3px solid #ef4444", "important");
    element.style.setProperty("outline-offset", "2px", "important");
    element.style.setProperty("position", element.style.position === "static" ? "relative" : element.style.position, "important");
    const badge = document.createElement("span");
    badge.textContent = `TrustGuard · ${category}`;
    badge.setAttribute("aria-label", `TrustGuard warning: ${category}`);
    Object.assign(badge.style, {
      position: "absolute",
      top: "-12px",
      right: "-4px",
      zIndex: "2147483647",
      background: "#991b1b",
      color: "#fff",
      border: "1px solid #fecaca",
      borderRadius: "999px",
      padding: "4px 8px",
      font: "600 11px/1.1 system-ui, sans-serif",
      boxShadow: "0 2px 8px rgba(0,0,0,.25)",
      pointerEvents: "none"
    });
    element.appendChild(badge);
  };

  const scanPage = () => {
    const snippets = [];
    const candidates = document.querySelectorAll("button, a, p, span, div, label, [data-countdown], [class*='countdown'], [id*='countdown']");
    candidates.forEach((element) => {
      if (scanned.has(element) || !isVisible(element)) return;
      const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length < 4 || text.length > 300) return;
      const category = getCategory(text);
      scanned.add(element);
      if (category) {
        addBadge(element, category);
        snippets.push(text);
      }
    });
    return [...new Set(snippets)].slice(0, 50);
  };

  const saveScan = (items, flagged) => {
    const threat = flagged.length
      ? Math.round(flagged.reduce((sum, item) => sum + (item.threatScore || 0), 0) / flagged.length)
      : 0;
    chrome.storage.local.set({
      [STATE_KEY]: {
        url: window.location.href,
        domain: window.location.hostname,
        scannedAt: new Date().toISOString(),
        scannedCount: items.length,
        flaggedCount: flagged.length,
        trustScore: Math.max(0, 100 - threat),
        flagged
      }
    });
  };

  const localFallback = (items) => items.map((text) => ({
    text,
    category: getCategory(text),
    reason: "Potentially deceptive language detected on this page.",
    threatScore: getCategory(text) === "Confirmshaming" ? 82 : getCategory(text) === "Hidden Cost" ? 76 : 68,
    signals: [text]
  }));

  const runScan = async () => {
    const items = scanPage();
    if (!items.length) return;
    let flagged = localFallback(items);
    try {
      const response = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items)
      });
      if (response.ok) flagged = await response.json();
    } catch {
      // The local heuristic pass keeps the extension useful when the API is offline.
    }
    saveScan(items, flagged);
    chrome.runtime?.sendMessage?.({ type: "TRUSTGUARD_SCAN_COMPLETE" });
  };

  runScan();
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 250));
    schedule(() => {
      scheduled = false;
      runScan();
    });
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
})();