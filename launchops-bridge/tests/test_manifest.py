"""Tests for the Action Manifest models and export/import logic."""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.manifest.models import (
    ActionManifest,
    Action,
    ManifestSource,
    BusinessContext,
    ExecutionConfig,
    ManifestMetadata,
    ActionResult,
    ManifestExecutionResult,
)
from src.export.exporter import export_manifest_from_execution, export_manifest_from_template


def test_action_manifest_creation():
    """Test creating a basic Action Manifest."""
    manifest = ActionManifest(
        source=ManifestSource(
            system="launchops-pro",
            execution_id="exec_123",
            workflow_name="Test Pipeline",
        ),
        business_context=BusinessContext(
            business_name="TestCorp",
            business_type="saas",
            goal="Launch MVP",
        ),
        actions=[
            Action(
                agent_id="repo-agent",
                label="Setup Repository",
                description="Create GitHub repo with CI/CD",
            ),
            Action(
                agent_id="security-agent",
                label="Security Setup",
                description="Configure SSL and firewall",
                dependencies=[],
            ),
        ],
    )

    assert manifest.manifest_id is not None
    assert manifest.version == "1.0.0"
    assert len(manifest.actions) == 2
    assert manifest.business_context.business_name == "TestCorp"
    assert manifest.actions[0].agent_id == "repo-agent"

    # Test JSON serialization
    json_str = manifest.model_dump_json(indent=2)
    parsed = json.loads(json_str)
    assert parsed["source"]["system"] == "launchops-pro"
    print("✓ Action Manifest creation works")


def test_dependency_validation():
    """Test dependency validation logic."""
    manifest = ActionManifest(
        source=ManifestSource(system="launchops-pro", execution_id="exec_456"),
        business_context=BusinessContext(
            business_name="TestCorp",
            business_type="saas",
            goal="Test",
        ),
        actions=[
            Action(
                action_id="action_1",
                agent_id="repo-agent",
                label="Step 1",
            ),
            Action(
                action_id="action_2",
                agent_id="security-agent",
                label="Step 2",
                dependencies=["action_1"],
            ),
            Action(
                action_id="action_3",
                agent_id="stripe-agent",
                label="Step 3",
                dependencies=["action_nonexistent"],  # Bad dependency
            ),
        ],
    )

    errors = manifest.validate_dependencies()
    assert len(errors) == 1
    assert "action_nonexistent" in errors[0]
    print("✓ Dependency validation works")


def test_ready_actions():
    """Test getting ready actions based on completed set."""
    manifest = ActionManifest(
        source=ManifestSource(system="launchops-pro", execution_id="exec_789"),
        business_context=BusinessContext(
            business_name="TestCorp",
            business_type="saas",
            goal="Test",
        ),
        actions=[
            Action(action_id="a1", agent_id="repo-agent", label="Step 1"),
            Action(action_id="a2", agent_id="security-agent", label="Step 2", dependencies=["a1"]),
            Action(action_id="a3", agent_id="stripe-agent", label="Step 3", dependencies=["a1"]),
            Action(action_id="a4", agent_id="growth-agent", label="Step 4", dependencies=["a2", "a3"]),
        ],
    )

    # Initially only a1 is ready (no dependencies)
    ready = manifest.get_ready_actions(set())
    assert len(ready) == 1
    assert ready[0].action_id == "a1"

    # After a1 completes, a2 and a3 are ready
    ready = manifest.get_ready_actions({"a1"})
    assert len(ready) == 2
    ids = {a.action_id for a in ready}
    assert ids == {"a2", "a3"}

    # After a1, a2, a3 complete, a4 is ready
    ready = manifest.get_ready_actions({"a1", "a2", "a3"})
    assert len(ready) == 1
    assert ready[0].action_id == "a4"
    print("✓ Ready actions logic works")


def test_export_from_execution():
    """Test exporting a manifest from execution data."""
    execution_data = {
        "id": "exec_001",
        "workflowId": "wf_001",
        "workflowName": "Business Launch Pipeline",
        "businessName": "MyCorp",
        "businessType": "saas",
        "goal": "Launch SaaS product",
        "industry": "fintech",
        "constraints": {"budget": 5000},
    }

    steps = [
        {
            "agentId": "business-builder",
            "label": "Build Spec Intake",
            "description": "Define your business",
            "sortOrder": 0,
        },
        {
            "agentId": "execai-coach",
            "label": "Strategic Assessment",
            "description": "Harvard-framework analysis",
            "sortOrder": 1,
        },
        {
            "agentId": "repo-agent",
            "label": "Repository Setup",
            "description": "GitHub repo with CI/CD",
            "sortOrder": 2,
        },
    ]

    manifest = export_manifest_from_execution(
        execution_data=execution_data,
        steps=steps,
        context_chain={"steps": []},
        callback_url="http://localhost:3000/api/bridge/callback",
    )

    assert manifest.source.execution_id == "exec_001"
    assert manifest.business_context.business_name == "MyCorp"
    assert len(manifest.actions) == 3
    assert manifest.actions[0].agent_id == "business-builder"
    assert manifest.actions[2].agent_id == "repo-agent"
    assert manifest.execution_config.callback_url == "http://localhost:3000/api/bridge/callback"
    print("✓ Export from execution works")


def test_export_from_template():
    """Test exporting a manifest from a workflow template."""
    template_definition = {
        "steps": [
            {"agentId": "business-builder", "label": "Product Definition", "description": "Define SaaS product", "sortOrder": 0},
            {"agentId": "repo-agent", "label": "Technical Stack", "description": "Repository setup", "sortOrder": 1},
            {"agentId": "stripe-agent", "label": "Subscription Billing", "description": "Stripe setup", "sortOrder": 2},
        ]
    }

    business_context = {
        "business_name": "TemplateCorp",
        "business_type": "saas",
        "goal": "Launch from template",
        "workflow_name": "SaaS Product Launch",
    }

    manifest = export_manifest_from_template(
        template_definition=template_definition,
        business_context=business_context,
    )

    assert manifest.business_context.business_name == "TemplateCorp"
    assert len(manifest.actions) == 3
    assert manifest.source.workflow_name == "SaaS Product Launch"
    print("✓ Export from template works")


def test_json_roundtrip():
    """Test that manifests survive JSON serialization/deserialization."""
    manifest = ActionManifest(
        source=ManifestSource(system="launchops-pro", execution_id="exec_rt"),
        business_context=BusinessContext(
            business_name="RoundTrip Inc",
            business_type="ecommerce",
            goal="Test roundtrip",
        ),
        actions=[
            Action(
                agent_id="wordpress-agent",
                label="Deploy Store",
                config={"theme": "storefront", "plugins": ["woocommerce"]},
            ),
        ],
    )

    # Serialize
    json_str = manifest.model_dump_json()

    # Deserialize
    restored = ActionManifest.model_validate_json(json_str)

    assert restored.manifest_id == manifest.manifest_id
    assert restored.business_context.business_name == "RoundTrip Inc"
    assert restored.actions[0].config["theme"] == "storefront"
    print("✓ JSON roundtrip works")


if __name__ == "__main__":
    test_action_manifest_creation()
    test_dependency_validation()
    test_ready_actions()
    test_export_from_execution()
    test_export_from_template()
    test_json_roundtrip()
    print("\n✅ All tests passed!")
