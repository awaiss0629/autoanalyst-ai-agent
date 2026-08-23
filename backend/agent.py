import os
from typing import TypedDict, List
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END
from tavily import TavilyClient

# Import the strict schemas we just made
from backend.schemas import Plan, ExtractedFacts, Critique

# Load our API keys securely from the .env file
load_dotenv()

# Initialize AI and Search Clients
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite", temperature=0)
tavily = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

# 1. Define the "State" (The memory the agent carries between steps)
class AgentState(TypedDict):
    question: str
    plan: List[str]
    search_results: str
    extracted_facts: List[dict]
    draft: str
    critique: str
    is_supported: bool
    final_report: str
    loop_count: int

# --- 2. Define the Nodes (The Steps) ---

def planner(state: AgentState):
    prompt = f"Break this research question into 3-5 specific search queries: {state['question']}"
    res = llm.with_structured_output(Plan).invoke(prompt)
    return {"plan": res.sub_questions, "loop_count": state.get("loop_count", 0)}

def search(state: AgentState):
    all_results = []
    for query in state["plan"]:
        res = tavily.search(query=query, max_results=2)
        all_results.append(str(res))
    return {"search_results": "\n---\n".join(all_results)}

def extractor(state: AgentState):
    prompt = (
        f"Extract factual claims and their source URLs from the following search results to answer: {state['question']}\n\n"
        f"Search Results: {state['search_results']}\n"
        f"Previous Critique to address (if any): {state.get('critique', 'None')}"
    )
    res = llm.with_structured_output(ExtractedFacts).invoke(prompt)
    return {"extracted_facts": [f.model_dump() for f in res.facts]}

def writer(state: AgentState):
    facts_str = "\n".join([f"- {f['claim']} (Source: {f['source_url']})" for f in state['extracted_facts']])
    prompt = f"Write a structured, objective report answering: {state['question']}\n\nYou MUST cite your sources inline. Use ONLY these facts:\n{facts_str}"
    res = llm.invoke(prompt)
    return {"draft": res.content}

def critic(state: AgentState):
    facts_str = "\n".join([f"- {f['claim']}" for f in state['extracted_facts']])
    prompt = (
        f"Evaluate this draft against the extracted facts.\n"
        f"Draft: {state['draft']}\n\n"
        f"Extracted Facts: {facts_str}\n\n"
        f"Are there any claims in the draft that are NOT in the facts? Check strictly."
    )
    res = llm.with_structured_output(Critique).invoke(prompt)
    
    count = state.get("loop_count", 0) + 1
    return {
        "critique": res.feedback, 
        "is_supported": res.is_supported, 
        "loop_count": count, 
        "final_report": state["draft"]
    }

# --- 3. Define the Routing Logic (The Self-Correction) ---
def route_critique(state: AgentState):
    # If the draft is perfect, or we've tried 3 times (to avoid infinite loops), finish.
    if state["is_supported"] or state["loop_count"] >= 3:
        return END
    # If the AI hallucinates, send it backward to the extractor to try again.
    return "extractor"

# --- 4. Build and Compile the Graph ---
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

# Add the conditional edge where the state machine makes a decision
workflow.add_conditional_edges(
    "critic",
    route_critique,
    {"extractor": "extractor", END: END}
)

app_graph = workflow.compile()