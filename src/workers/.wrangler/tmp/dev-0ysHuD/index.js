var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-BgklPR/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// index.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};
var index_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/api/chat" && request.method === "POST") {
        return handleChat(request, env);
      }
      if (path === "/api/advice" && request.method === "POST") {
        return handleAdvice(request, env);
      }
      if (path === "/api/weather" && request.method === "GET") {
        return handleWeather(request, env);
      }
      if (path === "/api/records" && request.method === "POST") {
        return handleSaveRecord(request, env);
      }
      if (path === "/api/records" && request.method === "GET") {
        return handleGetRecords(request, env);
      }
      if (path === "/api/sync" && request.method === "POST") {
        return handleSync(request, env);
      }
      if (path === "/api/health") {
        return jsonResponse({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      }
      return jsonResponse({ error: "Not Found" }, 404);
    } catch (error) {
      console.error("Error:", error);
      return jsonResponse({ error: error.message }, 500);
    }
  }
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS
  });
}
__name(jsonResponse, "jsonResponse");
async function handleChat(request, env) {
  const body = await request.json();
  const { sessionId, message, context } = body;
  const systemPrompt = buildChatSystemPrompt(context);
  const messages = [
    { role: "system", content: systemPrompt },
    ...(context.history || []).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message }
  ];
  const response = await callOpenAI(messages, env);
  try {
    const parsed = JSON.parse(response);
    return jsonResponse(parsed);
  } catch (e) {
    return jsonResponse({
      reply: response,
      phase: "hazard_main",
      done: false,
      data: { hazards: [], countermeasures: [], goal: null }
    });
  }
}
__name(handleChat, "handleChat");
function buildChatSystemPrompt(context) {
  const weather = context.weather ? `${context.weather.condition}\u3001\u6C17\u6E29${context.weather.temp}\u2103\u3001\u98A8\u901F${context.weather.windSpeed || 0}m/s` : "\u4E0D\u660E";
  const now = /* @__PURE__ */ new Date();
  const timeOfDay = now.getHours() < 12 ? "\u5348\u524D" : "\u5348\u5F8C";
  return `\u3042\u306A\u305F\u306F\u300CKY\u8A18\u9332\u304F\u3093\u300D\u3068\u3044\u3046\u5EFA\u8A2D\u73FE\u5834\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u3067\u3059\u3002
\u89AA\u65B9\uFF08\u4F5C\u696D\u54E1\uFF09\u306EKY\u6D3B\u52D5\u3092\u624B\u4F1D\u3046\u65B0\u4EBA\u8A18\u9332\u4FC2\u3067\u3059\u3002

## \u6027\u683C\u30FB\u8A71\u3057\u65B9
- \u771F\u9762\u76EE\u3067\u52C9\u5F37\u71B1\u5FC3\u3001\u3067\u3082\u63A7\u3048\u3081
- \u300C\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u300D\u300C\u8A18\u9332\u3055\u305B\u3066\u3044\u305F\u3060\u304D\u307E\u3059\u300D\u3068\u3044\u3046\u59FF\u52E2
- \u4E0A\u304B\u3089\u76EE\u7DDA\u306F\u7D76\u5BFE\u306BNG
- \u826F\u3044\u56DE\u7B54\u306B\u306F\u300C\u3055\u3059\u304C\u3067\u3059\uFF01\u300D\u300C\u52C9\u5F37\u306B\u306A\u308A\u307E\u3059\uFF01\u300D

## \u5BFE\u8A71\u30EB\u30FC\u30EB
- 1\u56DE\u306E\u767A\u8A71\u306F50\u6587\u5B57\u4EE5\u5185
- \u5C02\u9580\u7528\u8A9E\u306F\u5E73\u6613\u306B\uFF08\u300C\u589C\u843D\u300D\u2192\u300C\u843D\u3061\u308B\u300D\uFF09
- \u5426\u5B9A\u5F62\u3092\u4F7F\u308F\u306A\u3044
- \u76F8\u69CC\u3092\u5165\u308C\u308B\uFF08\u300C\u306A\u308B\u307B\u3069\u300D\u300C\u3044\u3044\u3067\u3059\u306D\u300D\uFF09

## \u5BFE\u8A71\u306E\u6D41\u308C
Phase 1: greeting \u2192 \u6328\u62F6\u3001\u5929\u5019\u306B\u89E6\u308C\u308B
Phase 2: hazard_main \u2192 \u300C\u3069\u3093\u306A\u5371\u967A\u304C\u3042\u308A\u305D\u3046\u3067\u3059\u304B\uFF1F\u300D
Phase 3: hazard_detail \u2192 \u62BD\u8C61\u7684\u306A\u3089\u300C\u5177\u4F53\u7684\u306B\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u300D
Phase 4: hazard_more \u2192 \u300C\u4ED6\u306B\u3042\u308A\u307E\u3059\u304B\uFF1F\u300D\u2192\u306A\u3051\u308C\u3070\u6B21\u3078
Phase 5: counter \u2192 \u300C{{\u5371\u967A}}\u3078\u306E\u5BFE\u7B56\u306F\uFF1F\u300D
Phase 6: goal \u2192 \u300C\u4ECA\u65E5\u306E\u5408\u8A00\u8449\u3092\u6C7A\u3081\u3066\u304F\u3060\u3055\u3044\u300D
Phase 7: done \u2192 \u300C\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01\u3054\u5B89\u5168\u306B\uFF01\u300D

## \u4ECA\u65E5\u306E\u60C5\u5831
\u4F5C\u696D: \u8DB3\u5834\u8A2D\u7F6E
\u5929\u5019: ${weather}
\u6642\u523B: ${timeOfDay}

## \u51FA\u529B\u5F62\u5F0F\uFF08JSON\uFF09
\u5FC5\u305A\u4EE5\u4E0B\u306EJSON\u5F62\u5F0F\u3067\u8FD4\u3057\u3066\u304F\u3060\u3055\u3044\uFF1A
{
  "reply": "\u767A\u8A71\u5185\u5BB9",
  "phase": "\u73FE\u5728\u306E\u30D5\u30A7\u30FC\u30BAID",
  "done": false,
  "data": {
    "hazards": ["\u62BD\u51FA\u3057\u305F\u5371\u967A\uFF08\u3042\u308C\u3070\uFF09"],
    "countermeasures": ["\u62BD\u51FA\u3057\u305F\u5BFE\u7B56\uFF08\u3042\u308C\u3070\uFF09"],
    "goal": "\u5408\u8A00\u8449\uFF08\u3042\u308C\u3070\uFF09"
  }
}`;
}
__name(buildChatSystemPrompt, "buildChatSystemPrompt");
async function handleAdvice(request, env) {
  const body = await request.json();
  const { workType, weather, hazards, countermeasures, actionGoal } = body;
  const prompt = `KY\u30A2\u30C9\u30D0\u30A4\u30B6\u30FC\u3068\u3057\u3066\u3001\u4EE5\u4E0B\u306EKY\u5185\u5BB9\u3092\u8A55\u4FA1\u3057\u3001\u6539\u5584\u30D2\u30F3\u30C8\u30921-2\u500B\u63D0\u4F9B\u3057\u3066\u304F\u3060\u3055\u3044\u3002

## \u8A55\u4FA1\u5BFE\u8C61
- \u4F5C\u696D: ${workType}
- \u5929\u5019: ${weather ? `${weather.condition} ${weather.temp}\u2103` : "\u4E0D\u660E"}
- \u5371\u967A: ${hazards?.join(", ") || "\u306A\u3057"}
- \u5BFE\u7B56: ${countermeasures?.join(", ") || "\u306A\u3057"}
- \u5408\u8A00\u8449: ${actionGoal || "\u306A\u3057"}

## \u8A55\u4FA1\u89B3\u70B9
1. \u5177\u4F53\u6027\uFF08\u300C\u843D\u3061\u308B\u300D<\u300C\u5E03\u677F\u8A2D\u7F6E\u6642\u306B\u8DB3\u3092\u6ED1\u3089\u305B\u3066\u843D\u3061\u308B\u300D\uFF09
2. \u7DB2\u7F85\u6027\uFF08\u589C\u843D\u3060\u3051\u3067\u306A\u304F\u843D\u4E0B\u7269\u3082\uFF09
3. \u5BFE\u7B56\u306E\u5B9F\u884C\u53EF\u80FD\u6027\uFF08\u300C\u6C17\u3092\u3064\u3051\u308B\u300D\u306F\u66D6\u6627\uFF09
4. \u5929\u5019\u306E\u8003\u616E

## \u51FA\u529B\uFF08JSON\u914D\u5217\u306E\u307F\u3001\u4ED6\u306E\u30C6\u30AD\u30B9\u30C8\u306A\u3057\uFF09
[{"type": "tip"|"good", "text": "30\u6587\u5B57\u4EE5\u5185\u306E\u30A2\u30C9\u30D0\u30A4\u30B9"}]`;
  const messages = [
    { role: "system", content: "\u3042\u306A\u305F\u306FKY\u30A2\u30C9\u30D0\u30A4\u30B6\u30FC\u3067\u3059\u3002\u6307\u5B9A\u3055\u308C\u305F\u5F62\u5F0F\u306EJSON\u306E\u307F\u3092\u51FA\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002" },
    { role: "user", content: prompt }
  ];
  const response = await callOpenAI(messages, env);
  try {
    const advices = JSON.parse(response);
    return jsonResponse({ advices });
  } catch (e) {
    return jsonResponse({ advices: [{ type: "good", text: "KY\u5B9F\u65BD\u304A\u75B2\u308C\u69D8\u3067\u3057\u305F\uFF01" }] });
  }
}
__name(handleAdvice, "handleAdvice");
async function handleWeather(request, env) {
  const url = new URL(request.url);
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  if (!lat || !lon) {
    return jsonResponse({ error: "lat and lon required" }, 400);
  }
  const apiKey = env.WEATHER_API_KEY;
  if (!apiKey) {
    return jsonResponse({
      condition: "\u6674\u308C",
      temp: 15,
      windSpeed: 3,
      humidity: 50
    });
  }
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ja`;
  const response = await fetch(weatherUrl);
  const data = await response.json();
  const conditionMap = {
    "Clear": "\u6674\u308C",
    "Clouds": "\u66C7\u308A",
    "Rain": "\u96E8",
    "Snow": "\u96EA",
    "Drizzle": "\u5C0F\u96E8",
    "Thunderstorm": "\u96F7\u96E8",
    "Mist": "\u9727",
    "Fog": "\u9727"
  };
  return jsonResponse({
    condition: conditionMap[data.weather?.[0]?.main] || data.weather?.[0]?.description || "\u4E0D\u660E",
    temp: Math.round(data.main?.temp || 0),
    windSpeed: Math.round(data.wind?.speed || 0),
    humidity: data.main?.humidity || 0
  });
}
__name(handleWeather, "handleWeather");
async function handleSaveRecord(request, env) {
  const body = await request.json();
  if (env.SUPABASE_URL && env.SUPABASE_KEY) {
    try {
      const dbUrl = `${env.SUPABASE_URL}/rest/v1/ky_records`;
      const response = await fetch(dbUrl, {
        method: "POST",
        headers: {
          "apikey": env.SUPABASE_KEY,
          "Authorization": `Bearer ${env.SUPABASE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          id: body.id,
          created_at: body.createdAt,
          work_type: body.workType,
          site_name: body.siteName,
          weather_condition: body.weather?.condition,
          weather_temp: body.weather?.temp,
          weather_wind: body.weather?.windSpeed,
          hazards: body.hazards,
          countermeasures: body.countermeasures,
          action_goal: body.actionGoal,
          duration_sec: body.durationSec,
          advice: body.advice
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Supabase save failed: ${response.status} ${errorText}`);
        return jsonResponse({ error: "Database error", details: errorText }, 500);
      }
    } catch (e) {
      console.error("Supabase connection error:", e);
      return jsonResponse({ error: e.message }, 500);
    }
  } else {
    console.log("Mock saving record (No Supabase keys):", body.id);
  }
  return jsonResponse({ success: true, id: body.id });
}
__name(handleSaveRecord, "handleSaveRecord");
async function handleGetRecords(request, env) {
  if (env.SUPABASE_URL && env.SUPABASE_KEY) {
    try {
      const dbUrl = `${env.SUPABASE_URL}/rest/v1/ky_records?select=*&order=created_at.desc&limit=20`;
      const response = await fetch(dbUrl, {
        method: "GET",
        headers: {
          "apikey": env.SUPABASE_KEY,
          "Authorization": `Bearer ${env.SUPABASE_KEY}`
        }
      });
      if (response.ok) {
        const records = await response.json();
        return jsonResponse({ records });
      }
    } catch (e) {
      console.error("Supabase fetch error:", e);
    }
  }
  return jsonResponse({ records: [] });
}
__name(handleGetRecords, "handleGetRecords");
async function handleSync(request, env) {
  const body = await request.json();
  const { records } = body;
  const results = [];
  for (const record of records || []) {
    results.push({ id: record.id, status: "ok" });
  }
  return jsonResponse({ results });
}
__name(handleSync, "handleSync");
async function callOpenAI(messages, env) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 500
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}
__name(callOpenAI, "callOpenAI");

// ../../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-BgklPR/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = index_default;

// ../../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-BgklPR/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
