type ChatContext = {
  currentPath?: string;
  problemSlug?: string;
  surface?: string;
  stage?: string;
  grit?: string;
  method?: "wet" | "dry" | "unknown";
};

type ChatRequest = {
  sessionToken: string;
  userMessage: string;
  context?: ChatContext;
};

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
    context: context as ChatContext | undefined,
  };
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

  const parsed = validateRequest(body);

  if (typeof parsed === "string") {
    return jsonResponse({ error: parsed }, 400);
  }

  return jsonResponse({
    reply:
      "Support AI is not enabled yet. Use the support pages for approved troubleshooting guidance.",
    needsClarification: true,
    clarifyingQuestion:
      "What surface are you sanding, and what grit are you using now?",
    matchedPages: [],
    draftCreated: false,
  });
});
