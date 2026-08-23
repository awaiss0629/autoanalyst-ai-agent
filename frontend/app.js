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

    // Extract raw text or HTML content
    const rawContent = reportElement.getAttribute('data-raw-markdown') || reportElement.innerText;
    
    // Parse Markdown into structured HTML elements
    const parsedHTML = typeof marked !== 'undefined' ? marked.parse(rawContent) : reportElement.innerHTML;

    // Build print container with clean document typography and pagination rules
    const printContainer = document.createElement('div');
    printContainer.style.backgroundColor = '#ffffff';
    printContainer.style.color = '#111827';
    printContainer.style.padding = '20px 24px';
    printContainer.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    printContainer.style.fontSize = '13px';
    printContainer.style.lineHeight = '1.6';

    printContainer.innerHTML = `
        <style>
            * { color: #111827 !important; box-sizing: border-box; }
            h1, h2, h3, h4 { color: #0f172a !important; font-weight: 700 !important; page-break-after: avoid; }
            h1 { font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 0; margin-bottom: 12px; }
            h2 { font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 16px; margin-bottom: 8px; }
            h3 { font-size: 13px; margin-top: 12px; margin-bottom: 6px; }
            p { margin: 0 0 10px 0; color: #334155 !important; page-break-inside: avoid; }
            strong, b { color: #0f172a !important; font-weight: 600 !important; }
            ul, ol { padding-left: 20px; margin: 0 0 10px 0; }
            li { margin-bottom: 4px; color: #334155 !important; page-break-inside: avoid; }
            a { color: #2563eb !important; text-decoration: underline !important; word-break: break-all; }
            hr { border: 0; border-top: 1px solid #e2e8f0; margin: 14px 0; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; page-break-inside: avoid; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: 600; }
            code { background-color: #f1f5f9; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 11px; }
        </style>
        ${parsedHTML}
    `;

    const options = {
        margin:       [12, 12, 12, 12],
        filename:     'AI_Research_Report.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2, 
            backgroundColor: '#ffffff',
            useCORS: true,
            scrollY: 0
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(options).from(printContainer).save();
}

// Example in your research completion callback:
const reportData = data.final_report || data.draft || "";
document.getElementById('reportOutput').innerHTML = marked.parse(reportData);

function copyReport() {
  const reportText = document.getElementById("reportOutput").textContent;
  navigator.clipboard.writeText(reportText).then(() => {
    alert("Report copied to clipboard!");
  });
}