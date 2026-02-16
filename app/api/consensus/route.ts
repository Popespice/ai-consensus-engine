import { generateObject, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

// Allow this route to run for up to 60 seconds (synthesis takes time)
export const maxDuration = 60;

// Build model instances — use the user's key if provided, otherwise fall back to env vars
function buildModels(keys: { openai?: string; anthropic?: string; google?: string }) {
  const openai = createOpenAI({
    apiKey: keys.openai || process.env.OPENAI_API_KEY || '',
  });
  const anthropic = createAnthropic({
    apiKey: keys.anthropic || process.env.ANTHROPIC_API_KEY || '',
  });
  const google = createGoogleGenerativeAI({
    apiKey: keys.google || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
  });

  return {
    gpt: openai('gpt-4o-mini'),
    claude: anthropic('claude-3-5-sonnet-20241022'),
    gemini: google('gemini-2.0-flash'),
    // Synthesis now uses GPT-4o Mini (Label: GPT-5.2) to reduce rate limit issues and improve synthesis speed
    synthesizer: openai('gpt-4o-mini'),
  };
}

export async function POST(req: Request) {
  let prompt: string;
  let userKeys: { openai?: string; anthropic?: string; google?: string } = {};

  try {
    const body = await req.json();
    prompt = body?.prompt;
    userKeys = body?.keys ?? {};
  } catch {
    return Response.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return Response.json({ error: "A non-empty 'prompt' field is required." }, { status: 400 });
  }

  const models = buildModels(userKeys);

  console.log("1. Received Prompt:", prompt);
  console.log("   Using custom keys:", {
    openai: !!userKeys.openai,
    anthropic: !!userKeys.anthropic,
    google: !!userKeys.google,
  });

  try {
    // PHASE 1: SEQUENTIAL EXECUTION (Gentler on Rate Limits)
    // We execute requests one by one to avoid hitting "Requests Per Minute" limits on free tiers.
    console.log("2. Fetching answers sequentially...");

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. GPT-5.2 (GPT-4o Mini)
    let gptText: string | null = null;
    let gptError: string | null = null;
    try {
      console.log("   -> Querying GPT-5.2...");
      const res = await generateText({ 
        model: models.gpt, 
        prompt,
        system: "You are a helpful expert assistant. Be concise." 
      });
      gptText = res.text;
    } catch (err: any) {
      console.error("      GPT-5.2 failed:", err.message);
      gptError = err.message;
    }

    // Small delay between requests
    await sleep(500);

    // 2. Claude 3.5 Sonnet
    let claudeText: string | null = null;
    let claudeError: string | null = null;
    try {
      console.log("   -> Querying Claude 3.5 Sonnet...");
      const res = await generateText({ 
        model: models.claude, 
        prompt,
        system: "You are a helpful expert assistant. Be concise."
      });
      claudeText = res.text;
    } catch (err: any) {
      console.error("      Claude 3.5 failed:", err.message);
      claudeError = err.message;
    }

    // Small delay between requests
    await sleep(500);

    // 3. Gemini 2 Flash
    let geminiText: string | null = null;
    let geminiError: string | null = null;
    try {
      console.log("   -> Querying Gemini 2 Flash...");
      const res = await generateText({ 
        model: models.gemini, 
        prompt,
        system: "You are a helpful expert assistant. Be concise."
      });
      geminiText = res.text;
    } catch (err: any) {
      console.error("      Gemini failed:", err.message);
      geminiError = err.message;
    }

    // We need at least one model to form a result (Consensus of 1 is just an answer)
    // Previously required 2, but for debugging/reliability, 1 is fine.
    const successCount = [gptText, claudeText, geminiText].filter(Boolean).length;

    if (successCount === 0) {
      const failures = [
        gptError ? `GPT-5.2: ${gptError}` : null,
        claudeError ? `Claude 3.5 Sonnet: ${claudeError}` : null,
        geminiError ? `Gemini 2 Flash: ${geminiError}` : null,
      ].filter(Boolean);
      
      return Response.json(
        { error: "All models failed to respond.", failures },
        { status: 502 }
      );
    }
    
    // PHASE 2: THE SYNTHESIS (The "Judge")
    // We feed the available answers into GPT-4o to generate the structured JSON.
    // However, if GPT-4o keys are dead, we should fallback to Gemini if available.
    console.log("3. Synthesizing consensus...");

    // Pick the best available model for synthesis
    const synthesizerModel = (!gptError) ? models.gpt : (!geminiError) ? models.gemini : models.claude;
    console.log(`   -> Using ${(!gptError) ? 'GPT' : (!geminiError) ? 'Gemini' : 'Claude'} for synthesis.`);

    const synthesis = await generateObject({
      model: synthesizerModel,
      schema: z.object({
        consensus_score: z.number().describe("0-100 score of how much the models agree"),
        consensus_level: z.enum(['High', 'Medium', 'Low']).describe("Text label for the score"),
        summary: z.string().describe("A single, cohesive answer blending the best parts."),
        claims: z.array(z.object({
          text: z.string().describe("A specific fact or statement from the summary"),
          supporters: z.array(z.enum(['GPT-5.2', 'Claude 3.5 Sonnet', 'Gemini 2 Flash'])),
          dissenters: z.array(z.string()).describe("Names of models that disagree"),
          warning: z.string().optional().describe("If there is dissent, explain why briefly."),
        })),
        conflicts: z.array(z.object({
          topic: z.string(),
          description: z.string(),
        })).optional(),
      }),
      prompt: `
        USER QUESTION: "${prompt}"

        ---
        MODEL A (GPT-5.2): 
        ${gptText ?? "[MODEL UNAVAILABLE]"}

        ---
        MODEL B (Claude 3.5 Sonnet): 
        ${claudeText ?? "[MODEL UNAVAILABLE]"}

        ---
        MODEL C (Gemini 2 Flash): 
        ${geminiText ?? "[MODEL UNAVAILABLE]"}

        ---
        INSTRUCTIONS:
        1. Compare the available answers (ignore any marked [MODEL UNAVAILABLE]).
        2. Identify facts agreed upon by all responding models (Consensus).
        3. Identify any direct contradictions (Conflicts).
        4. Generate a "Meta-Answer" broken down into distinct claims/sentences.
        5. For EACH claim, strictly attribute which models support it.
      `
    });

    console.log("4. Synthesis Complete.");
    
    // Return the structured JSON to the frontend
    return Response.json({
      ...synthesis.object,
      raw_answers: {
        gpt: gptText ?? "[unavailable]",
        claude: claudeText ?? "[unavailable]",
        gemini: geminiText ?? "[unavailable]"
      }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in consensus generation:", message);
    return Response.json({ error: "Failed to generate consensus.", details: message }, { status: 500 });
  }
}