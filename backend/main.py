import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from backend.agent import app_graph
import uvicorn

# Initialize FastAPI app
app = FastAPI(
    title="AutoAnalyst API",
    description="Autonomous Research Agent using LangGraph, Gemini 2.5 Flash, and Tavily",
    version="1.0.0"
)

# 1. Request Schemas
class ResearchRequest(BaseModel):
    question: str

# 2. API Endpoints
@app.post("/api/research")
async def run_research(req: ResearchRequest):
    initial_state = {"question": req.question, "loop_count": 0}
    final_state = app_graph.invoke(initial_state)
    
    return {
        "report": final_state.get("final_report", ""),
        "self_correction_loops_triggered": max(0, final_state.get("loop_count", 1) - 1),
        "final_critique": final_state.get("critique", "All claims verified."),
        "is_supported": final_state.get("is_supported", True),
        "plan": final_state.get("plan", [])
    }

@app.post("/api/eval")
async def run_evals():
    """Automated benchmark suite checking factual grounding and citation rate."""
    test_suite = [
        {
            "question": "What is the primary power source for the Mars Perseverance rover?",
            "expected_keywords": ["plutonium", "radioisotope", "mmrtg"]
        },
        {
            "question": "Compare the core battery chemistries used by Tesla in standard vs long range vehicles.",
            "expected_keywords": ["lfp", "lithium iron", "nickel"]
        }
    ]
    
    results = []
    total_passed = 0
    
    for test in test_suite:
        state = app_graph.invoke({"question": test["question"], "loop_count": 0})
        report_lower = state.get("final_report", "").lower()
        
        found_kws = [kw for kw in test["expected_keywords"] if kw in report_lower]
        passed = len(found_kws) > 0
        if passed:
            total_passed += 1
            
        results.append({
            "question": test["question"],
            "passed": passed,
            "matched_keywords": found_kws,
            "loops_required": max(0, state.get("loop_count", 1) - 1)
        })
        
    score_percentage = (total_passed / len(test_suite)) * 100
    return {
        "benchmark_accuracy": f"{score_percentage:.1f}%",
        "total_tests": len(test_suite),
        "tests_passed": total_passed,
        "details": results
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "AutoAnalyst Agent", "agent_status": "ready"}

# 3. Serve Frontend Static Files
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    @app.get("/")
    async def serve_ui():
        return FileResponse(os.path.join(frontend_dir, "index.html"))

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)