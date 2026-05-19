function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getBaseUrl() {
  return (__ENV.K6_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getProfileOptions() {
  const profile = (__ENV.K6_PROFILE || "load").toLowerCase();

  if (profile === "smoke") {
    return {
      vus: toPositiveInt(__ENV.K6_VUS, 1),
      duration: __ENV.K6_DURATION || "10s",
    };
  }

  if (profile === "stress") {
    return {
      stages: [
        { duration: "20s", target: toPositiveInt(__ENV.K6_STRESS_STAGE_1, 10) },
        { duration: "30s", target: toPositiveInt(__ENV.K6_STRESS_STAGE_2, 25) },
        { duration: "20s", target: 0 },
      ],
    };
  }

  return {
    vus: toPositiveInt(__ENV.K6_VUS, 5),
    duration: __ENV.K6_DURATION || "30s",
  };
}

export function buildAuthHeaders() {
  const headers = {};

  if (__ENV.K6_SESSION_COOKIE) {
    headers.Cookie = __ENV.K6_SESSION_COOKIE;
  }

  if (__ENV.K6_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${__ENV.K6_BEARER_TOKEN}`;
  }

  return headers;
}

export function withJsonHeaders(headers = {}) {
  return {
    ...headers,
    "Content-Type": "application/json",
  };
}

export const defaultThresholds = {
  http_req_failed: ["rate<0.05"],
  http_req_duration: ["p(95)<1000", "avg<600"],
};
