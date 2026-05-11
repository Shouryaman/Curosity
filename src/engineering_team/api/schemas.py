from pydantic import BaseModel, Field


class RunCreate(BaseModel):
    requirements: str = Field(
        ...,
        description="Product / module requirements passed to the crew.",
    )
    module_name: str = Field(
        default="module.py",
        description="Target Python module file name.",
    )
    class_name: str = Field(
        default="Main",
        description="Primary class name implemented in the module.",
    )


class RunCreated(BaseModel):
    run_id: str


class HealthResponse(BaseModel):
    status: str = "ok"
    openai_configured: bool = Field(
        default=False,
        description="True when OPENAI_API_KEY is set (non-empty).",
    )
