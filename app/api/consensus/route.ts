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
    gpt: openai('gpt-4o'),
    claude: anthropic('claude-3-5-sonnet-20240620'),
    gemini: google('gemini-1.5-pro-latest'),
    // Synthesis now uses Gemini 1.5 Pro to ensure neutral, unbiased filtering/summary
    synthesizer: google('gemini-1.5-pro-latest'),
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
    // PHASE 1: THE FAN-OUT
    // We fire all three requests in parallel to save time.
    // Promise.allSettled ensures one failure doesn't kill the others.
    console.log("2. Fetching answers from GPT-4o, Claude 3.5, and Gemini 1.5...");
    
    const [gptRes, claudeRes, geminiRes] = await Promise.allSettled([
      generateText({ 
        model: models.gpt, 
        prompt,
        system: "You are a helpful expert assistant. Be concise." 
      }),
      generateText({ 
        model: models.claude, 
        prompt,
        system: "You are a helpful expert assistant. Be concise."
      }),
      generateText({ 
        model: models.gemini, 
        prompt,
        system: "You are a helpful expert assistant. Be concise."
      })
    ]);

    const gptText = gptRes.status === 'fulfilled' ? gptRes.value.text : null;
    const claudeText = claudeRes.status === 'fulfilled' ? claudeRes.value.text : null;
    const geminiText = geminiRes.status === 'fulfilled' ? geminiRes.value.text : null;

    // We need at least two models to form a meaningful consensus
    const successCount = [gptText, claudeText, geminiText].filter(Boolean).length;
    if (successCount < 2) {
      const failures = [
        gptRes.status === 'rejected' ? `GPT-4o: ${gptRes.reason}` : null,
        claudeRes.status === 'rejected' ? `Claude 3.5: ${claudeRes.reason}` : null,
        geminiRes.status === 'rejected' ? `Gemini 1.5: ${geminiRes.reason}` : null,
      ].filter(Boolean);
      console.error("Too many model failures:", failures);
      return Response.json(
        { error: "Not enough models responded to form a consensus.", failures },
        { status: 502 }
      );
    }

    // PHASE 2: THE SYNTHESIS (The "Judge")
    // We feed the available answers into GPT-4o to generate the structured JSON.
    console.log("3. Synthesizing consensus...");

    const synthesis = await generateObject({
      model: models.synthesizer,
      schema: z.object({
        consensus_score: z.number().describe("0-100 score of how much the models agree"),
        consensus_level: z.enum(['High', 'Medium', 'Low']).describe("Text label for the score"),
        summary: z.string().describe("A single, cohesive answer blending the best parts."),
        claims: z.array(z.object({
          text: z.string().describe("A specific fact or statement from the summary"),
          supporters: z.array(z.enum(['GPT-4o', 'Claude 3.5', 'Gemini 1.5'])),
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
        MODEL A (GPT-4o): 
        ${gptText ?? "[MODEL UNAVAILABLE]"}

        ---
        MODEL B (Claude 3.5): 
        ${claudeText ?? "[MODEL UNAVAILABLE]"}

        ---
        MODEL C (Gemini 1.5): 
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