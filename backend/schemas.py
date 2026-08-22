from pydantic import BaseModel, Field
from typing import List

# 1. Forces the Planner to return exactly a list of search queries
class Plan(BaseModel):
    sub_questions: List[str] = Field(description="3-5 search queries to investigate the main question")

# 2. Forces the Extractor to pair every extracted fact with a source URL
class Fact(BaseModel):
    claim: str = Field(description="A specific factual claim")
    source_url: str = Field(description="The URL where this fact was found")

class ExtractedFacts(BaseModel):
    facts: List[Fact]

# 3. Forces the Critic to return a strict True/False and specific feedback
class Critique(BaseModel):
    is_supported: bool = Field(description="True ONLY if every claim in the draft is backed by the extracted facts.")
    feedback: str = Field(description="If False, specify exactly which claims lack sources or need more research.")