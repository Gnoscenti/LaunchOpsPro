import asyncio
import os

import pytest

from app.agents.orchestrator import OrchestratorAgent
from app.core.business_spec import (
    BuildConstraints,
    BusinessModel,
    BusinessSpec,
    Channel,
    ICP,
    PricingTier,
    ProductType,
)
from app.settings import settings


os.environ["MOCK_MODE"] = "true"
settings.mock_mode = True


@pytest.mark.asyncio
async def test_saas_deployment() -> None:
    """A current BusinessSpec produces a non-empty mock execution plan."""
    orchestrator = OrchestratorAgent()
    spec = BusinessSpec(
        name="MockSaaS",
        description="A mock SaaS used to verify deployment planning.",
        icp=ICP(
            industry="Developer tools",
            company_size="1-50",
            role="Developer",
            pain_points=["Deployment is hard"],
        ),
        product_type=ProductType.SAAS,
        business_model=BusinessModel.SUBSCRIPTION,
        pricing_tiers=[
            PricingTier(
                name="Basic",
                price_monthly=10,
                features=["Mock deployment planning"],
            )
        ],
        channels=[Channel.SEO, Channel.SOCIAL],
        constraints=BuildConstraints(
            budget_usd=500,
            timeline_days=30,
            team_size=1,
            tech_stack=["Python", "React"],
        ),
    )

    run = orchestrator.plan_execution(spec.name, {"business_type": spec.product_type.value})

    assert run.tasks, "Mock deployment plan must contain at least one task"
    assert all(task.agent_name and task.description for task in run.tasks)

    task_descriptions = [task.description.lower() for task in run.tasks]
    assert any("stripe" in description or "payment" in description for description in task_descriptions)
    assert any("website" in description or "landing page" in description for description in task_descriptions)


if __name__ == "__main__":
    asyncio.run(test_saas_deployment())
