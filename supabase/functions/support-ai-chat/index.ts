type RetrievedEntry = {
  title?: string;
  problem?: string;
  likely_cause?: string;
  recommended_grit?: string;
  wet_or_dry?: string;
  steps?: string[];
  avoid?: string;
  success_check?: string;
  target_url?: string;
  sequence?: string[];
  surface?: string;
  goal?: string;
};

type ChatContext = {
  currentPath?: string;
  currentTitle?: string;
  lastQuery?: string;
  lastMatches?: Array<{
    title?: string;
    target_url?: string;
    surface?: string;
    goal?: string;
  }>;
  clickedPages?: Array<{
    path?: string;
    title?: string;
    at?: string;
  }>;
  retrievedContent?: {
    searchEntries?: RetrievedEntry[];
    solutionCards?: RetrievedEntry[];
    gritSequences?: RetrievedEntry[];
  };
  source?: string;
};

type ChatRequest = {
  sessionToken: string;
  userMessage: string;
  context?: ChatContext;
};

type AssistantOutput = {
  reply: string;
  needsClarification: boolean;
  clarifyingQuestion: string;
  matchedPages: Array<{
    title: string;
    path: string;
  }>;
};

const MODEL_NAME = "gpt-4.1-mini";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRequest(body: unknown): ChatRequest | string {
  if (!isObject(body)) {
    return "Request body must be a JSON object.";
  }

  const { sessionToken, userMessage, context } = body;

  if (typeof sessionToken !== "string" || sessionToken.trim().length === 0) {
    return "sessionToken is required.";
  }

  if (typeof userMessage !== "string" || userMessage.trim().length === 0) {
    return "userMessage is required.";
  }

  if (context !== undefined && !isObject(context)) {
    return "context must be an object when provided.";
  }

  return {
    sessionToken: sessionToken.trim(),
    userMessage: userMessage.trim(),
    context: (context || {}) as ChatContext,
  };
}

function sanitizeRetrievedItems(items: unknown, maxItems: number): RetrievedEntry[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => isObject(item))
    .slice(0, maxItems)
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        title: typeof record.title === "string" ? record.title : undefined,
        problem: typeof record.problem === "string" ? record.problem : undefined,
        likely_cause:
          typeof record.likely_cause === "string" ? record.likely_cause : undefined,
        recommended_grit:
          typeof record.recommended_grit === "string"
            ? record.recommended_grit
            : undefined,
        wet_or_dry:
          typeof record.wet_or_dry === "string" ? record.wet_or_dry : undefined,
        steps: Array.isArray(record.steps)
          ? record.steps
              .filter((step) => typeof step === "string")
              .slice(0, 6)
              .map((step) => String(step))
          : undefined,
        avoid: typeof record.avoid === "string" ? record.avoid : undefined,
        success_check:
          typeof record.success_check === "string" ? record.success_check : undefined,
        target_url:
          typeof record.target_url === "string" ? record.target_url : undefined,
        sequence: Array.isArray(record.sequence)
          ? record.sequence
              .filter((step) => typeof step === "string")
              .slice(0, 8)
              .map((step) => String(step))
          : undefined,
        surface: typeof record.surface === "string" ? record.surface : undefined,
        goal: typeof record.goal === "string" ? record.goal : undefined,
      };
    });
}

function sanitizeContext(context: ChatContext | undefined): ChatContext {
  const raw = isObject(context) ? context : {};

  const rawRetrieved = isObject(raw.retrievedContent)
    ? (raw.retrievedContent as Record<string, unknown>)
    : {};

  const lastMatches = Array.isArray(raw.lastMatches)
    ? raw.lastMatches
        .filter((item) => isObject(item))
        .slice(0, 7)
        .map((item) => {
          const record = item as Record<string, unknown>;
          return {
            title: typeof record.title === "string" ? record.title : undefined,
            target_url:
              typeof record.target_url === "string"
                ? record.target_url
                : undefined,
            surface:
              typeof record.surface === "string" ? record.surface : undefined,
            goal: typeof record.goal === "string" ? record.goal : undefined,
          };
        })
    : [];

  const clickedPages = Array.isArray(raw.clickedPages)
    ? raw.clickedPages
        .filter((item) => isObject(item))
        .slice(-10)
        .map((item) => {
          const record = item as Record<string, unknown>;
          return {
            path: typeof record.path === "string" ? record.path : undefined,
            title: typeof record.title === "string" ? record.title : undefined,
            at: typeof record.at === "string" ? record.at : undefined,
          };
        })
    : [];

  return {
    currentPath:
      typeof raw.currentPath === "string" ? raw.currentPath.slice(0, 200) : undefined,
    currentTitle:
      typeof raw.currentTitle === "string"
        ? raw.currentTitle.slice(0, 160)
        : undefined,
    lastQuery:
      typeof raw.lastQuery === "string" ? raw.lastQuery.slice(0, 220) : undefined,
    lastMatches: lastMatches,
    clickedPages: clickedPages,
    retrievedContent: {
      searchEntries: sanitizeRetrievedItems(rawRetrieved.searchEntries, 5),
      solutionCards: sanitizeRetrievedItems(rawRetrieved.solutionCards, 5),
      gritSequences: sanitizeRetrievedItems(rawRetrieved.gritSequences, 2),
    },
    source: typeof raw.source === "string" ? raw.source.slice(0, 64) : undefined,
  };
}

function fallbackMatchedPages(context: ChatContext): Array<{ title: string; path: string }> {
  const pages: Array<{ title: string; path: string }> = [];

  (context.lastMatches || []).forEach((item) => {
    const title = item.title || "Support page";
    const path = item.target_url || "";

    if (!path || pages.some((page) => page.path === path)) {
      return;
    }

    pages.push({
      title,
      path,
    });
  });

  return pages.slice(0, 4);
}

function isOrderTrackingQuery(message: string): boolean {
  const text = message.toLowerCase();
  const phrases = [
    "where is my order",
    "track my order",
    "tracking number",
    "order status",
    "shipping status",
    "my shipment",
    "delivery status",
    "when will it arrive",
  ];
  if (phrases.some((phrase) => text.includes(phrase))) {
    return true;
  }
  return /\bpackage\b/.test(text);
}

function parseAssistantOutput(rawText: string): AssistantOutput | null {
  try {
    const parsed = JSON.parse(rawText) as AssistantOutput;

    if (!parsed || typeof parsed.reply !== "string") {
      return null;
    }

    const matchedPages = Array.isArray(parsed.matchedPages)
      ? parsed.matchedPages
          .filter((item) => isObject(item))
          .map((item) => {
            const record = item as Record<string, unknown>;
            return {
              title:
                typeof record.title === "string" && record.title.trim().length
                  ? record.title
                  : "Support page",
              path:
                typeof record.path === "string" && record.path.trim().length
                  ? record.path
                  : "",
            };
          })
          .filter((item) => item.path)
          .slice(0, 5)
      : [];

    return {
      reply: parsed.reply.trim(),
      needsClarification: Boolean(parsed.needsClarification),
      clarifyingQuestion: typeof parsed.clarifyingQuestion === "string"
        ? parsed.clarifyingQuestion.trim()
        : "",
      matchedPages,
    };
  } catch {
    return null;
  }
}

function extractOutputText(openAiBody: Record<string, unknown>): string {
  if (typeof openAiBody.output_text === "string" && openAiBody.output_text.trim()) {
    return openAiBody.output_text;
  }

  const output = Array.isArray(openAiBody.output) ? openAiBody.output : [];

  for (const item of output) {
    if (!isObject(item)) {
      continue;
    }

    const content = Array.isArray(item.content)
      ? item.content
      : [];

    for (const part of content) {
      if (!isObject(part)) {
        continue;
      }
      if (typeof part.text === "string" && part.text.trim()) {
        return part.text;
      }
    }
  }

  return "";
}

async function callOpenAI(
  apiKey: string,
  userMessage: string,
  context: ChatContext,
): Promise<AssistantOutput> {
  const systemInstruction =
    "You are eQualle Sandpaper Support Assistant. " +
    "Answer only using the approved support context provided. " +
    "Do not invent product claims. " +
    "If context is insufficient, ask one short clarifying question. " +
    "Keep answer short, practical, and structured.";

  const policyRules = [
    "Respond in English.",
    "Brand facts allowed: eQualle sandpaper sheets, 9 x 11 inch, silicon carbide, wet or dry use, grits 60 through 3000, assorted kit 60 through 3000.",
    "Avoid unsupported marketing claims.",
    "Do not use words: premium, best, professional-grade, superior.",
    "Do not recommend unsafe or unrelated uses.",
    "Prefer linking to approved pages over long free-form text.",
    "Ask only one clarifying question when truly needed.",
    "One user message must produce one assistant answer.",
    "Do not return a full separate second answer as clarifyingQuestion.",
    "If clarification is needed, keep reply short and include the question naturally.",
    "For order tracking, shipping status, delivery status, package location, or retailer-specific purchase questions, reply exactly: I can’t track orders here. Please check your order confirmation email or the retailer where you purchased the sandpaper. Set needsClarification=false, clarifyingQuestion=\"\", matchedPages=[].",
    "Use this reply template when possible: Likely issue / Why it happens / Recommended next step / Suggested grit sequence / Wet or dry / Avoid / Related guides.",
  ].join("\n");

  const promptPayload = {
    userMessage,
    context,
    outputRequirements: {
      format: {
        reply: "string",
        needsClarification: "boolean",
        clarifyingQuestion: "string",
        matchedPages: "array of up to 5 items with {title, path}",
      },
      guidance:
        "When context is enough, answer directly and set needsClarification=false with empty clarifyingQuestion. Return one unified assistant answer per user message.",
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `${systemInstruction}\n\nRules:\n${policyRules}`,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(promptPayload),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "support_response",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              reply: { type: "string" },
              needsClarification: { type: "boolean" },
              clarifyingQuestion: { type: "string" },
              matchedPages: {
                type: "array",
                maxItems: 5,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    path: { type: "string" },
                  },
                  required: ["title", "path"],
                },
              },
            },
            required: [
              "reply",
              "needsClarification",
              "clarifyingQuestion",
              "matchedPages",
            ],
          },
          strict: true,
        },
      },
    }),
  });

  const openAiBody = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    const message =
      typeof openAiBody.error === "object" && openAiBody.error
        ? (openAiBody.error as Record<string, unknown>).message
        : "OpenAI request failed.";

    throw new Error(typeof message === "string" ? message : "OpenAI request failed.");
  }

  const outputText = extractOutputText(openAiBody);
  const parsed = parseAssistantOutput(outputText);

  if (!parsed) {
    throw new Error("Assistant response could not be parsed.");
  }

  return parsed;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: jsonHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const parsedRequest = validateRequest(body);

  if (typeof parsedRequest === "string") {
    return jsonResponse({ error: parsedRequest }, 400);
  }

  const context = sanitizeContext(parsedRequest.context);
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  if (isOrderTrackingQuery(parsedRequest.userMessage)) {
    return jsonResponse({
      reply:
        "I can’t track orders here. Please check your order confirmation email or the retailer where you purchased the sandpaper.",
      needsClarification: false,
      clarifyingQuestion: "",
      matchedPages: [],
      draftCreated: false,
      model: MODEL_NAME,
    });
  }

  if (!apiKey) {
    return jsonResponse(
      {
        error:
          "OPENAI_API_KEY is not configured for support-ai-chat. Please set it in Supabase Function environment variables.",
      },
      500,
    );
  }

  try {
    const assistant = await callOpenAI(apiKey, parsedRequest.userMessage, context);

    return jsonResponse({
      reply: assistant.reply,
      needsClarification: assistant.needsClarification,
      clarifyingQuestion: assistant.clarifyingQuestion,
      matchedPages: assistant.matchedPages.length
        ? assistant.matchedPages
        : fallbackMatchedPages(context),
      draftCreated: false,
      model: MODEL_NAME,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assistant request failed.";

    return jsonResponse(
      {
        error: "assistant_request_failed",
        message,
      },
      502,
    );
  }
});
