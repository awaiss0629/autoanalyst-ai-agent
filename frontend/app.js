async function runResearch() {
  const questionInput = document.getElementById("questionInput");
  const question = questionInput.value.trim();

  if (!question) {
    alert("Please enter a research topic first.");
    return;
  }

  const runBtn = document.getElementById("runBtn");
  const btnText = document.getElementById("btnText");
  const btnSpinner = document.getElementById("btnSpinner");
  const statusContainer = document.getElementById("statusContainer");
  const resultsContainer = document.getElementById("resultsContainer");

  // UI state: loading
  runBtn.disabled = true;
  btnText.textContent = "Researching...";
  btnSpinner.classList.remove("hidden");
  statusContainer.classList.remove("hidden");
  resultsContainer.classList.add("hidden");

  try {
    const response = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question }),
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    const data = await response.json();

    // Populate Results
    document.getElementById("reportOutput").textContent = data.report || "No report generated.";
    document.getElementById("loopCount").textContent = data.self_correction_loops_triggered;
    document.getElementById("planCount").textContent = (data.plan && data.plan.length) || 0;
    document.getElementById("critiqueOutput").textContent = data.final_critique || "Draft verified without critical issues.";

    const statusBadge = document.getElementById("groundingStatus");
    if (data.is_supported) {
      statusBadge.textContent = "Verified";
      statusBadge.className = "metric-val text-success";
    } else {
      statusBadge.textContent = "Needs Attention";
      statusBadge.className = "metric-val";
    }

    resultsContainer.classList.remove("hidden");
  } catch (error) {
    console.error("Error executing agent:", error);
    alert("An error occurred while running the agent. Check your console logs.");
  } finally {
    runBtn.disabled = false;
    btnText.textContent = "Start Research";
    btnSpinner.classList.add("hidden");
    statusContainer.classList.add("hidden");
  }
}

function copyReport() {
  const reportText = document.getElementById("reportOutput").textContent;
  navigator.clipboard.writeText(reportText).then(() => {
    alert("Report copied to clipboard!");
  });
}