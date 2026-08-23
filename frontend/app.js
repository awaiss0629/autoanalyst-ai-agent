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

    // ---- SINGLE SOURCE OF TRUTH for the report content ----
    // Check all field names your backend has used across versions.
    // TODO: once you confirm the real field name in your FastAPI response
    // model, simplify this to just that one field.
    const reportMarkdown = data.report || data.final_report || data.draft || "";

    const outputContainer = document.getElementById("reportOutput");
    // Store the RAW markdown for both copying and PDF export
    outputContainer.setAttribute("data-raw", reportMarkdown);
    // Render the PARSED markdown as HTML for on-screen display
    outputContainer.innerHTML = reportMarkdown
      ? marked.parse(reportMarkdown)
      : "<p>No report generated.</p>";

    // Populate the rest of the metrics
    document.getElementById("loopCount").textContent = data.self_correction_loops_triggered ?? 0;
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

    // Get the raw markdown (set as a single source of truth in runResearch)
    const rawMarkdown = reportElement.getAttribute('data-raw') || reportElement.innerText;
    const formattedContent = typeof marked !== 'undefined' ? marked.parse(rawMarkdown) : reportElement.innerHTML;

    // Create a standalone print document container
    const printWrapper = document.createElement('div');
    printWrapper.style.backgroundColor = '#ffffff';
    printWrapper.style.color = '#1a202c';
    printWrapper.style.padding = '24px 32px';
    printWrapper.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    printWrapper.style.fontSize = '12px';
    printWrapper.style.lineHeight = '1.75';

    printWrapper.innerHTML = `
        <style>
            * { color: #1a202c !important; box-sizing: border-box; }
            h1 { font-size: 18px; font-weight: 700; color: #111827 !important; margin: 0 0 16px 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; page-break-after: avoid; }
            h2 { font-size: 14px; font-weight: 700; color: #1f2937 !important; margin: 20px 0 10px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; page-break-after: avoid; }
            h3 { font-size: 13px; font-weight: 600; color: #374151 !important; margin: 14px 0 6px 0; page-break-after: avoid; }
            p { margin: 0 0 12px 0; color: #374151 !important; line-height: 1.75; }
            strong, b { font-weight: 700; color: #111827 !important; }
            ul, ol { margin: 0 0 14px 0; padding-left: 22px; }
            li { margin-bottom: 6px; color: #374151 !important; line-height: 1.6; }
            hr { border: 0; border-top: 1px solid #e5e7eb; margin: 18px 0; }
            a { color: #2563eb !important; text-decoration: underline !important; word-break: break-all; }
            table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 11px; }
            th, td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: 600; }
        </style>
        ${formattedContent}
    `;

    const options = {
        margin:       [14, 14, 14, 14],
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

    html2pdf().set(options).from(printWrapper).save();
}

function copyReport() {
  const reportElement = document.getElementById("reportOutput");
  // Copy the raw markdown, not the rendered HTML's plain text,
  // so pasting elsewhere preserves formatting if the target supports markdown.
  const reportText = reportElement.getAttribute("data-raw") || reportElement.textContent;
  navigator.clipboard.writeText(reportText).then(() => {
    alert("Report copied to clipboard!");
  });
}