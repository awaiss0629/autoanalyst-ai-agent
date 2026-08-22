# ⚡ AutoAnalyst: Autonomous Research Agent

> Production-grade Deep Research Agent utilizing **LangGraph**, **Gemini 3.6 Flash**, and **Tavily Search** with deterministic Pydantic schema validation, adversarial Critic self-correction, Docker containerization, and automated CI/CD.

---

## 🏗️ Architecture & State Machine

```mermaid
flowchart TD
    Start([User Query]) --> Planner[Planner Node: 3-5 Sub-Questions]
    Planner --> Search[Search Node: Tavily Web Retrieval]
    Search --> Extractor[Extractor Node: Structured Fact Extraction]
    Extractor --> Writer[Writer Node: Markdown Report Synthesis]
    Writer --> Critic{Critic Node: Fact Grounding Audit}
    
    Critic -- Gaps / Hallucination Detected --> Extractor
    Critic -- Verified & Grounded --> End([Final Cited Report])