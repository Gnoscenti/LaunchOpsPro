#!/usr/bin/env node
/**
 * End-to-End Business Launch Pipeline Test
 *
 * Simulates the full 4-agent chain that the user requested:
 *   Business Builder → Funding Intelligence → ExecAI Coach → Documentary Tracker
 *
 * Each agent receives the accumulated context from prior steps (context chaining).
 * This test runs through the Python bridge the same way the execution engine does.
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_RUNNER = path.join(__dirname, "agentRunner.py");
const FOUNDER_DIR = path.resolve(__dirname, "..", "..", "launchops-founder-edition");

// The 4-step pipeline matching the user's request
const PIPELINE_STEPS = [
  {
    agentId: "business-builder",
    label: "Build Spec Intake",
    description: "Define business: name, domain, industry, value proposition",
    config: {
      _method: "build_spec_intake",
      business_name: "SoloPreneurForge",
      industry: "AI-powered business automation",
      target_market: "Solo founders and small teams",
      value_proposition: "Agentic workflow orchestration for non-technical founders",
    },
  },
  {
    agentId: "funding-intelligence",
    label: "Funding Strategy",
    description: "Analyze all funding pathways: grants, SBIR, angel, VC",
    config: {
      _method: "readiness_report",
      business_name: "SoloPreneurForge",
      industry: "AI SaaS",
      monthly_revenue: 8500,
      state: "California",
      entity_type: "LLC",
    },
  },
  {
    agentId: "execai-coach",
    label: "Strategic Assessment",
    description: "Harvard-framework strategic analysis and coaching",
    config: {
      _method: "strategic_review",
      business_name: "SoloPreneurForge",
      industry: "AI SaaS",
      monthly_revenue: 8500,
    },
  },
  {
    agentId: "documentary-tracker",
    label: "Documentary Entry",
    description: "Log launch milestone for solopreneur documentary",
    config: {
      _method: "log_milestone",
      title: "Business Launch Pipeline Complete",
      description: "Successfully ran the full 4-agent pipeline with Forge LLM",
      category: "launch",
    },
  },
];

function runStep(step, accumulatedContext) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      FOUNDER_EDITION_DIR: FOUNDER_DIR,
      FORGE_API_URL: process.env.BUILT_IN_FORGE_API_URL || "",
      FORGE_API_KEY: process.env.BUILT_IN_FORGE_API_KEY || "",
      PYTHONUNBUFFERED: "1",
    };

    const proc = spawn("python3", [AGENT_RUNNER], {
      cwd: FOUNDER_DIR,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const payload = {
      agentId: step.agentId,
      label: step.label,
      description: step.description,
      config: step.config,
      context: accumulatedContext,
    };

    let stdout = "";
    let stderr = "";
    const events = [];

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      // Parse JSON lines
      const lines = stdout.split("\n").filter((l) => l.trim());
      let result = null;
      for (const line of lines) {
        try {
          const evt = JSON.parse(line);
          events.push(evt);
          if (evt.event === "result") result = evt;
        } catch {}
      }

      if (result) {
        resolve({ step, result, events, code });
      } else {
        reject(
          new Error(
            `Step "${step.label}" failed (code ${code}): ${stderr.slice(0, 300)}`
          )
        );
      }
    });

    proc.on("error", (err) => reject(err));

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Step "${step.label}" timed out after 120s`));
    }, 120_000);

    proc.on("close", () => clearTimeout(timer));

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  BUSINESS LAUNCH PIPELINE — End-to-End Test");
  console.log("  Chain: Business Builder → Funding Intelligence → ExecAI Coach → Documentary Tracker");
  console.log("═══════════════════════════════════════════════════════════\n");

  const accumulatedContext = {};
  const results = [];
  let allPassed = true;

  for (let i = 0; i < PIPELINE_STEPS.length; i++) {
    const step = PIPELINE_STEPS[i];
    const stepNum = i + 1;
    console.log(`\n─── Step ${stepNum}/${PIPELINE_STEPS.length}: ${step.label} (${step.agentId}) ───`);

    try {
      const { result, events } = await runStep(step, accumulatedContext);

      const success = result.success;
      const data = result.data || {};
      const llmInit = events.find((e) => e.message?.includes("LLM client initialized"));
      const provider = llmInit?.message || "unknown";

      console.log(`  ✅ Success: ${success}`);
      console.log(`  🔌 Provider: ${provider}`);
      console.log(`  📊 Method: ${data.method || "N/A"}`);

      // Show a preview of the output
      const preview = data.analysis || data.summary || data.response || JSON.stringify(data).slice(0, 200);
      console.log(`  📝 Output preview: ${String(preview).slice(0, 150)}...`);

      // Accumulate context for the next step
      accumulatedContext[`step_${stepNum}_${step.agentId}`] = {
        label: step.label,
        agentId: step.agentId,
        success,
        output: data,
      };

      results.push({ step: step.label, agent: step.agentId, success, provider });
    } catch (err) {
      console.log(`  ❌ FAILED: ${err.message}`);
      allPassed = false;
      results.push({ step: step.label, agent: step.agentId, success: false, error: err.message });
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  PIPELINE RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════════════════");
  for (const r of results) {
    const icon = r.success ? "✅" : "❌";
    console.log(`  ${icon} ${r.step} (${r.agent}) — ${r.success ? "PASSED" : "FAILED"}`);
  }

  const contextKeys = Object.keys(accumulatedContext);
  console.log(`\n  Context chain: ${contextKeys.length} steps accumulated`);
  for (const key of contextKeys) {
    console.log(`    → ${key}: ${accumulatedContext[key].label}`);
  }

  console.log(`\n  Overall: ${allPassed ? "✅ ALL STEPS PASSED" : "❌ SOME STEPS FAILED"}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Pipeline test crashed:", err);
  process.exit(1);
});
