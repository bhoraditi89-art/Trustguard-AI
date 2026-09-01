const STATE_KEY = "trustguard:lastScan";

const scoreColor = (score) => score >= 80 ? "#50d890" : score >= 55 ? "#f5bd4f" : "#f0443e";

const render = (scan) => {
  const score = Number.isFinite(scan?.trustScore) ? scan.trustScore : 0;
  const ring = document.getElementById("score-ring");
  ring.style.setProperty("--score-angle", `${score * 3.6}deg`);
  ring.style.background = `conic-gradient(${scoreColor(score)} 0deg, ${scoreColor(score)} ${score * 3.6}deg, #2c3540 ${score * 3.6}deg, #2c3540 360deg)`;
  document.getElementById("trust-score").textContent = scan ? score : "--";
  document.getElementById("scanned-count").textContent = scan?.scannedCount ?? 0;
  document.getElementById("flagged-count").textContent = scan?.flaggedCount ?? 0;
  document.getElementById("page-domain").textContent = scan?.domain || "Open a page to see its trust signals.";
  document.getElementById("scan-status").textContent = !scan ? "Waiting for scan" : score >= 75 ? "Looks trustworthy" : score >= 50 ? "Review with care" : "High-risk signals found";
  document.getElementById("scan-status").style.color = scoreColor(score);
  const list = document.getElementById("finding-list");
  list.innerHTML = "";
  if (!scan?.flagged?.length) {
    list.innerHTML = '<p class="empty">No deceptive patterns detected on this page.</p>';
    return;
  }
  scan.flagged.slice(0, 4).forEach((item) => {
    const row = document.createElement("div");
    row.className = "finding";
    row.innerHTML = `<p title="${item.text.replace(/"/g, "&quot;")}">${item.category}</p><small>${item.threatScore}/100</small>`;
    list.appendChild(row);
  });
};

const load = () => chrome.storage.local.get(STATE_KEY, (result) => render(result[STATE_KEY]));
document.getElementById("refresh").addEventListener("click", load);
load();