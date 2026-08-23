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


function downloadPDF() {
    const reportElement = document.getElementById('reportOutput');
    
    if (!reportElement || !reportElement.innerText.trim()) {
        alert("Please generate a report first before downloading.");
        return;
    }
    
    // Create an isolated container styled strictly for high-contrast document printing
    const printContainer = document.createElement('div');
    printContainer.style.backgroundColor = '#ffffff';
    printContainer.style.color = '#111827';
    printContainer.style.padding = '24px';
    printContainer.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
    printContainer.style.fontSize = '14px';
    printContainer.style.lineHeight = '1.7';

    // Inject dedicated print CSS to override dark mode styles and highlight headers/links
    printContainer.innerHTML = `
        <style>
            * { color: #111827 !important; background-color: transparent !important; }
            h1, h2, h3, h4 { color: #000000 !important; font-weight: 700 !important; margin-top: 16px; margin-bottom: 8px; }
            h1 { font-size: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
            h2 { font-size: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
            h3 { font-size: 14px; }
            p { margin-bottom: 12px; color: #1f2937 !important; }
            strong, b { color: #000000 !important; font-weight: 700 !important; }
            ul, ol { padding-left: 20px; margin-bottom: 12px; }
            li { margin-bottom: 6px; color: #1f2937 !important; }
            a { color: #1d4ed8 !important; text-decoration: underline !important; }
            code, pre { background-color: #f3f4f6 !important; color: #111827 !important; padding: 2px 5px; border-radius: 4px; font-family: monospace; }
        </style>
        ${reportElement.innerHTML}
    `;
    
    const options = {
        margin:       [12, 12, 12, 12],
        filename:     'AI_Research_Report.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2, 
            backgroundColor: '#ffffff',
            useCORS: true 
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(options).from(printContainer).save();
}

function copyReport() {
  const reportText = document.getElementById("reportOutput").textContent;
  navigator.clipboard.writeText(reportText).then(() => {
    alert("Report copied to clipboard!");
  });
}