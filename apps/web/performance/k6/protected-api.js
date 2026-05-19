import http from "k6/http";
import { check, group, sleep } from "k6";
import {
  buildAuthHeaders,
  defaultThresholds,
  getBaseUrl,
  getProfileOptions,
  withJsonHeaders,
} from "./lib/config.js";

export const options = {
  ...getProfileOptions(),
  thresholds: defaultThresholds,
};

const baseUrl = getBaseUrl();

function requireEnv(name) {
  if (!__ENV[name]) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return __ENV[name];
}

export function setup() {
  requireEnv("K6_SESSION_COOKIE");
  return {
    authHeaders: buildAuthHeaders(),
  };
}

export default function (data) {
  const authHeaders = data.authHeaders;
  group("GET /api/mobile/classes", () => {
    const response = http.get(`${baseUrl}/api/mobile/classes`, {
      headers: authHeaders,
    });
    check(response, {
      "mobile classes status is 200": (res) => res.status === 200,
    });
  });

  if (__ENV.K6_CLASS_ID) {
    group("GET /api/mobile/class", () => {
      const response = http.get(
        `${baseUrl}/api/mobile/class?classId=${encodeURIComponent(__ENV.K6_CLASS_ID)}`,
        { headers: authHeaders },
      );
      check(response, {
        "mobile class status is 200": (res) => res.status === 200,
      });
    });

    group("GET /api/mobile/class/pending-assignments", () => {
      const response = http.get(
        `${baseUrl}/api/mobile/class/pending-assignments?classId=${encodeURIComponent(__ENV.K6_CLASS_ID)}`,
        { headers: authHeaders },
      );
      check(response, {
        "mobile class pending assignments status is 200": (res) =>
          res.status === 200,
      });
    });

    group("POST /api/mobile/classes/pending-assignments", () => {
      const response = http.post(
        `${baseUrl}/api/mobile/classes/pending-assignments`,
        JSON.stringify({
          classIds: [__ENV.K6_CLASS_ID],
        }),
        {
          headers: withJsonHeaders(authHeaders),
        },
      );
      check(response, {
        "mobile classes pending assignments status is 200": (res) =>
          res.status === 200,
      });
    });
  }

  if (__ENV.K6_CLASS_ID && __ENV.K6_COURSE_ID) {
    group("GET /api/mobile/class/homework-status", () => {
      const response = http.get(
        `${baseUrl}/api/mobile/class/homework-status?classId=${encodeURIComponent(__ENV.K6_CLASS_ID)}&courseId=${encodeURIComponent(__ENV.K6_COURSE_ID)}`,
        { headers: authHeaders },
      );
      check(response, {
        "mobile homework status is 200": (res) => res.status === 200,
      });
    });
  }

  if (__ENV.K6_CLASS_ID && __ENV.K6_HOMEWORK_NODE_ID) {
    group("GET /api/mobile/homework/assignments", () => {
      const response = http.get(
        `${baseUrl}/api/mobile/homework/assignments?classId=${encodeURIComponent(__ENV.K6_CLASS_ID)}&homeworkNodeId=${encodeURIComponent(__ENV.K6_HOMEWORK_NODE_ID)}`,
        { headers: authHeaders },
      );
      check(response, {
        "mobile homework assignments is 200": (res) => res.status === 200,
      });
    });
  }

  if (__ENV.K6_WIDGET_ID) {
    group("GET /api/widgets/[id]/status", () => {
      const response = http.get(
        `${baseUrl}/api/widgets/${encodeURIComponent(__ENV.K6_WIDGET_ID)}/status`,
        {
          headers: authHeaders,
          responseCallback: http.expectedStatuses(200, 404),
        },
      );
      check(response, {
        "widget status is 200 or 404": (res) =>
          res.status === 200 || res.status === 404,
      });
    });
  }

  sleep(1);
}
