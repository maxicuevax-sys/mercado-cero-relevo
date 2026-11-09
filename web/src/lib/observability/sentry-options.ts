import type { Event, EventHint, Integration, SpanJSON, StackFrame, StreamedSpanJSON } from "@sentry/core";
import { withStaticSpan } from "@sentry/core";

// Shared by browser, Node and Edge. No request/body/voice/payment data belongs here.
const ERROR_TYPES = new Set(["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "URIError", "AggregateError"]);
const OPERATIONS = new Set(["http.server", "http.client", "pageload", "navigation", "ui.action", "ui.load", "function"]);
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

const sessionPrivacy: Integration = {
  name: "TranguiSessionPrivacy",
  setup(client) {
    // Sessions are a separate envelope pipeline and do not run beforeSend.
    client.on("beforeSendSession", session => {
      if ("toJSON" in session) {
        session.did = undefined; session.ipAddress = undefined; session.userAgent = undefined;
      }
    });
  },
};

function codeFile(value: string | undefined) {
  if (!value) return undefined;
  // Reject page/customer URLs and eval sourceURL text: retain only code locations.
  if (!/(?:\/_next\/static\/|[/\\]\.next[/\\]server[/\\]|[/\\]node_modules[/\\]|[/\\]src[/\\])/.test(value)
      || !/\.[cm]?[jt]sx?(?:[?#].*)?$/.test(value)) return undefined;
  value = value.replace(/([/\\](?:Users|home)[/\\])[^/\\]+/gi, "$1local");
  try {
    const url = new URL(value);
    url.username = ""; url.password = ""; url.search = ""; url.hash = "";
    return url.toString();
  } catch {
    return value.split(/[?#]/, 1)[0].replace(/([A-Za-z]:[\\/]Users[\\/])[^\\/]+/i, "$1local");
  }
}

function frame(input: StackFrame): StackFrame {
  return {
    filename: codeFile(input.filename), abs_path: codeFile(input.abs_path),
    function: "<application>", lineno: input.lineno, colno: input.colno, in_app: input.in_app,
  };
}

function publicAttributes(input: Record<string, unknown> = {}) {
  const data: Record<string, string | number> = {};
  const method = input["http.request.method"];
  const status = input["http.response.status_code"];
  if (typeof method === "string" && METHODS.has(method)) data["http.request.method"] = method;
  if (typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599) data["http.response.status_code"] = status;
  return data;
}

export function sanitizeSentrySpan<T extends SpanJSON | StreamedSpanJSON>(span: T): T {
  const base = {
    trace_id: span.trace_id, span_id: span.span_id, parent_span_id: span.parent_span_id,
    start_timestamp: span.start_timestamp, status: span.status,
  };
  if ("attributes" in span) {
    const op = span.attributes["sentry.op"];
    return {
      ...base, end_timestamp: span.end_timestamp, is_segment: span.is_segment,
      name: typeof op === "string" && OPERATIONS.has(op) ? op : "app.operation",
      attributes: publicAttributes(span.attributes),
    } as T;
  }
  const op = span.op && OPERATIONS.has(span.op) ? span.op : "app.operation";
  return { ...base, timestamp: span.timestamp, op, description: op, data: publicAttributes(span.data) } as T;
}

/** Allowlist protocol/debug fields instead of attempting to redact arbitrary text. */
export function sanitizeSentryEvent<T extends Event>(event: T, hint?: EventHint): T {
  if (hint) hint.attachments = [];
  const trace = event.contexts?.trace;
  const safeTrace = trace && /^[a-f0-9]{32}$/.test(trace.trace_id ?? "") && /^[a-f0-9]{16}$/.test(trace.span_id ?? "")
    ? { trace_id: trace.trace_id, span_id: trace.span_id } : undefined;
  const diagnostic = event.tags?.sentry_test;
  return {
    type: event.type, event_id: event.event_id, timestamp: event.timestamp,
    platform: event.platform, level: event.level, release: event.release, environment: event.environment,
    dist: event.dist,
    message: event.message ? "Trangui application error" : undefined,
    transaction: event.transaction ? "Trangui application" : undefined,
    start_timestamp: event.start_timestamp,
    contexts: safeTrace ? { trace: safeTrace } : undefined,
    tags: diagnostic === "browser" || diagnostic === "server" ? { sentry_test: diagnostic } : undefined,
    exception: event.exception ? { values: event.exception.values?.map(value => ({
      type: value.type && ERROR_TYPES.has(value.type) ? value.type : "Error",
      value: "Trangui application error",
      mechanism: value.mechanism ? { type: "generic", handled: value.mechanism.handled } : undefined,
      stacktrace: value.stacktrace ? { frames: value.stacktrace.frames?.map(frame) } : undefined,
    })) } : undefined,
    spans: event.spans?.map(sanitizeSentrySpan),
    debug_meta: event.debug_meta ? { images: event.debug_meta.images?.filter(image => image.type === "sourcemap").map(image => ({
      type: "sourcemap", debug_id: image.debug_id, code_file: codeFile(image.code_file) ?? "",
    })) } : undefined,
  } as T;
}

export function createSentryOptions(input: {
  dsn?: string; release?: string; environment?: string; production?: boolean;
}) {
  return {
    dsn: input.dsn || undefined,
    enabled: Boolean(input.dsn),
    release: input.release,
    environment: input.environment || (input.production ? "production" : "development"),
    tracesSampleRate: input.production ? 0.05 : 1,
    // Keep the transaction privacy hook active on SDK 11; streaming ignores it.
    traceLifecycle: "static",
    dataCollection: {
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
      graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false }, databaseQueryData: false, queues: false,
      stackFrameVariables: false, frameContextLines: 0,
    },
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    beforeSend: sanitizeSentryEvent,
    beforeSendTransaction: sanitizeSentryEvent,
    beforeSendSpan: withStaticSpan(sanitizeSentrySpan),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    profileSessionSampleRate: 0,
    integrations: (defaults: Integration[]) => [
      ...defaults.filter(integration => integration.name !== "BrowserSession"),
      sessionPrivacy,
    ],
  } satisfies Parameters<typeof import("@sentry/nextjs").init>[0];
}
