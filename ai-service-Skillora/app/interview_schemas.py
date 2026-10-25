from typing import Literal

from pydantic import BaseModel, Field


class Evaluation(BaseModel):
    verdict: Literal["correct", "partiel", "incorrect"]
    score: int = Field(ge=0, le=100)
    feedback: str
    missing_points: list[str] = []


class MockFeedback(BaseModel):
    strengths: list[str]
    improvements: list[str]
    summary: str


class MockResponse(BaseModel):
    message: str
    finished: bool
    feedback: MockFeedback | None = None


class MockQuestion(BaseModel):
    message: str
