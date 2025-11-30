// Lightweight UI wiring for demo state.
(function () {
  const dateLabel = document.getElementById("dateLabel");
  const statusTitle = document.getElementById("statusTitle");
  const statusSubtitle = document.getElementById("statusSubtitle");
  const incubationBar = document.getElementById("incubationBar");
  const incubationPct = document.getElementById("incubationPct");
  const incubationText = document.getElementById("incubationText");

  // Format and show today's date.
  if (dateLabel) {
    const today = new Date();
    dateLabel.textContent = today.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  // Demo values; replace with real data when backend is ready.
  const demoIncubation = 35; // percent
  const isHatched = demoIncubation >= 100;

  if (incubationBar && incubationPct) {
    incubationBar.style.width = `${Math.min(Math.max(demoIncubation, 0), 100)}%`;
    incubationPct.textContent = `${demoIncubation}%`;
  }

  if (incubationText) {
    incubationText.textContent = isHatched ? "Hatching complete" : "Hatching in progress";
  }

  if (statusTitle && statusSubtitle) {
    statusTitle.textContent = isHatched ? "Hatched" : "Hatching...";
    statusSubtitle.textContent = isHatched
      ? "Pet is active — upload to update mood"
      : "Awaiting today’s mood upload";
  }
})();
