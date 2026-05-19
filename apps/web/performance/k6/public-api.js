import http from "k6/http";
import { check, group, sleep } from "k6";
import {
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

export default function () {
  group("GET /api/widgets", () => {
    const response = http.get(`${baseUrl}/api/widgets`);
    check(response, {
      "widgets status is 200": (res) => res.status === 200,
    });
  });

  group("POST /api/widgets/search", () => {
    const response = http.post(
      `${baseUrl}/api/widgets/search`,
      JSON.stringify({
        query: __ENV.K6_WIDGET_QUERY || "widget",
      }),
      {
        headers: withJsonHeaders(),
      },
    );

    check(response, {
      "widget search status is 200": (res) => res.status === 200,
    });
  });

  if (__ENV.K6_WIDGET_USER_ID) {
    group("GET /api/widgets/users/[userId]", () => {
      const response = http.get(
        `${baseUrl}/api/widgets/users/${encodeURIComponent(__ENV.K6_WIDGET_USER_ID)}`,
      );
      check(response, {
        "widgets by user status is 200": (res) => res.status === 200,
      });
    });
  }

  if (__ENV.K6_LESSON_NODE_ID) {
    group("GET /api/class/assignment", () => {
      const response = http.get(
        `${baseUrl}/api/class/assignment?lessonNodeId=${encodeURIComponent(__ENV.K6_LESSON_NODE_ID)}`,
      );
      check(response, {
        "class assignment status is 200 or 404": (res) =>
          res.status === 200 || res.status === 404,
      });
    });
  }

  sleep(1);
}
