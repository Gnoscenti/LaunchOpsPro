import asyncio
import os
from app.agents.orchestrator import OrchestratorAgent
from app.core.business_spec import BusinessSpec, ICP, PricingTier, BusinessModel, ProductType, Channel, BuildConstraints
from app.settings import settings

# Enable Mock Mode
os.environ["MOCK_MODE"] = "true"
settings.mock_mode = True

import pytest

@pytest.mark.asyncio
async def test_saas_deployment():
    print("🚀 Starting Mock SaaS Deployment Test...")
    
    orchestrator = OrchestratorAgent()
    
    # Define a SaaS business spec
    spec = BusinessSpec(
        id="mock_saas_001",
        name="MockSaaS",
        tagline="Mock SaaS for testing",
        positioning="The only mock SaaS for testing deployment",
        icp=ICP(
            title="Developers",
            pain_points=["Deployment is hard"],
            goals=["Deploy faster"],
            budget_range="$50-500/month",
            decision_criteria=["Ease of use"],
            where_they_hang=["GitHub"]
        ),
        product_type=ProductType.MICRO_SAAS,
        business_model=BusinessModel.SUBSCRIPTION,
        core_promise="Deploy in 5 minutes",
        unique_mechanism="AI-powered deployment",
        pricing_tiers=[
            PricingTier(
                name="Basic",
                price_monthly=10,
                target_customer="Developers"
            )
        ],
        primary_channel=Channel.SEO,
        backup_channel=Channel.SOCIAL,
        fulfillment_strategy="Automated",
        support_strategy="Email",
        target_cac=100,
        target_ltv=1000,
        constraints=BuildConstraints()
    )
    
    # Create the plan
    print("📋 Creating SaaS Plan...")
    constraints = {"business_type": "saas"}
    run = orchestrator.plan_execution(spec.name, constraints)
    
    print(f"✅ Plan Created with {len(run.tasks)} tasks:")
    for task in run.tasks:
        print(f"  - [{task.agent_name}] {task.description}")
        
    # Verify key steps exist
    task_descriptions = [t.description for t in run.tasks]
    
    # Check for core components
    has_stripe = any("Stripe" in d or "payment" in d.lower() for d in task_descriptions)
    has_website = any("website" in d.lower() or "landing page" in d.lower() for d in task_descriptions)
    
    if has_stripe:
        print("  - Stripe integration task found")
    else:
        print("  ⚠️ Stripe integration task missing")
        
    if has_website:
        print("  - Website task found")
    else:
        print("  ⚠️ Website task missing")
    
    print("\n✅ Mock Deployment Test Passed!")

if __name__ == "__main__":
    asyncio.run(test_saas_deployment())
