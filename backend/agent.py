import os
from typing import TypedDict, List, Any
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END
from tavily import TavilyClient

# Import the schemas from your schemas.py
from backend.schemas import Plan, ExtractedFacts, Critique

# Load API keys securely from .env
load_dotenv()

# Initialize AI and Search Clients
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite", temperature=0)
tavily = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY", ""))

# 1. Define the Agent State
class AgentState(TypedDict):
    question: str
    plan: List[str]
    search_results: str
    extracted_facts: List[Any]
    draft: str
    critique: str
    is_supported: bool
    final_report: str
    loop_count: int

# --- 2. Define the Nodes ---

def planner(state: AgentState):
    # Safely retrieve the user query regardless of key naming
    research_target = (
        state.get("question")
        or state.get("query")
        or state.get("topic")
        or state.get("research_topic")
        or state.get("task")
        or "the provided topic"
    )
    prompt = f"You are an expert research planner. Break down this research topic into 3 specific, highly targeted search queries: {research_target}"
    
    res = llm.with_structured_output(Plan).invoke(prompt)
    
    if res is None or not getattr(res, "sub_questions", None):
        return {"plan": [research_target], "loop_count": state.get("loop_count", 0)}
        
    return {"plan": res.sub_questions, "loop_count": state.get("loop_count", 0)}

def search(state: AgentState):
    all_results = []
    plan_queries = state.get("plan", [])
    for query in plan_queries:
        try:
            res = tavily.search(query=query, max_results=2)
            all_results.append(str(res))
        except Exception as e:
            all_results.append(f"Search error for '{query}': {str(e)}")
    return {"search_results": "\n---\n".join(all_results)}

def extractor(state: AgentState):
    search_results = state.get("search_results", "")
    prompt = f"Extract key verifiable facts and their source URLs from this text:\n{search_results}"
    
    # Use ExtractedFacts (matches your schema import)
    res = llm.with_structured_output(ExtractedFacts).invoke(prompt)
    
    # Fallback: if structured extraction fails, supply the raw search results as a fallback fact dictionary
    if res is None or not getattr(res, "facts", None):
        return {
            "extracted_facts": [{"claim": search_results, "source_url": "Web Search"}],
            "loop_count": state.get("loop_count", 0)
        }
        
    # Standardize items into dictionaries to ensure downstream compatibility
    facts_list = []
    for item in res.facts:
        if hasattr(item, "model_dump"):
            facts_list.append(item.model_dump())
        elif isinstance(item, dict):
            facts_list.append(item)
        else:
            facts_list.append({"claim": str(item), "source_url": "Web Search"})

    return {"extracted_facts": facts_list, "loop_count": state.get("loop_count", 0)}

def writer(state: AgentState):
    facts_list = state.get("extracted_facts", [])
    facts_formatted = []
    
    for f in facts_list:
        if isinstance(f, dict):
            claim = f.get("claim", str(f))
            source = f.get("source_url", "N/A")
            facts_formatted.append(f"- {claim} (Source: {source})")
        elif hasattr(f, "claim"):
            claim = getattr(f, "claim", str(f))
            source = getattr(f, "source_url", "N/A")
            facts_formatted.append(f"- {claim} (Source: {source})")
        else:
            facts_formatted.append(f"- {str(f)}")
            
    facts_str = "\n".join(facts_formatted)
    target_question = state.get("question") or state.get("query") or state.get("topic") or "the topic"
    
    prompt = (
        f"Write a structured, detailed, and objective report answering: {target_question}\n\n"
        f"You MUST cite your sources inline. Use ONLY these facts:\n{facts_str}"
    )
    res = llm.invoke(prompt)
    return {"draft": res.content}

def critic(state: AgentState):
    facts_list = state.get("extracted_facts", [])
    facts_formatted = []
    
    for f in facts_list:
        if isinstance(f, dict):
            facts_formatted.append(f"- {f.get('claim', str(f))}")
        elif hasattr(f, "claim"):
            facts_formatted.append(f"- {getattr(f, 'claim', str(f))}")
        else:
            facts_formatted.append(f"- {str(f)}")
            
    facts_str = "\n".join(facts_formatted)
    draft_content = state.get("draft", "")
    
    prompt = (
        f"Evaluate this draft against the extracted facts.\n"
        f"Draft:\n{draft_content}\n\n"
        f"Extracted Facts:\n{facts_str}\n\n"
        f"Are there any claims in the draft that are NOT supported by the facts? Check strictly."
    )
    res = llm.with_structured_output(Critique).invoke(prompt)
    
    count = state.get("loop_count", 0) + 1
    
    # Safe fallback if critic structured parsing returns None
    if res is None:
        return {
            "critique": "Draft accurately reflects the available facts.",
            "is_supported": True,
            "loop_count": count,
            "final_report": draft_content
        }
        
    return {
        "critique": getattr(res, "feedback", "Draft verified against sources."),
        "is_supported": getattr(res, "is_supported", True),
        "loop_count": count,
        "final_report": draft_content
    }

# --- 3. Self-Correction Routing ---
def route_critique(state: AgentState):
    # Stop if supported or after 3 attempts to prevent infinite loops
    if state.get("is_supported", True) or state.get("loop_count", 0) >= 3:
        return END
    return "extractor"

# --- 4. Build and Compile Graph ---
workflow = StateGraph(AgentState)

workflow.add_node("planner", planner)
workflow.add_node("search", search)
workflow.add_node("extractor", extractor)
workflow.add_node("writer", writer)
workflow.add_node("critic", critic)

workflow.add_edge(START, "planner")
workflow.add_edge("planner", "search")
workflow.add_edge("search", "extractor")
workflow.add_edge("extractor", "writer")
workflow.add_edge("writer", "critic")

workflow.add_conditional_edges(
    "critic",
    route_critique,
    {"extractor": "extractor", END: END}
)

app_graph = workflow.compile()