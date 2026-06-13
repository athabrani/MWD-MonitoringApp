import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

function requiredEnv(name) {
  const value = __ENV[name];

  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return String(value).trim();
}

function baseUrl() {
  return (__ENV.BASE_URL || "http://localhost:5002").replace(/\/$/, "");
}

function parseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

export function setup() {
  const url = `${baseUrl()}/api/auth/login`;
  const payload = JSON.stringify({
    identifier: requiredEnv("TEST_USERNAME"),
    password: requiredEnv("TEST_PASSWORD"),
  });

  const response = http.post(url, payload, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer k6-login-bootstrap",
    },
  });

  const body = parseJson(response);
  const token = body && (body.token || body.accessToken || body.data?.token || body.data?.accessToken);

  check(response, {
    "login status is 200": (res) => res.status === 200,
    "login returns token": () => Boolean(token),
  });

  if (!token) {
    throw new Error(`Login setup failed with status ${response.status}`);
  }

  return {
    token,
    baseUrl: baseUrl(),
    sessionId: requiredEnv("SESSION_ID"),
  };
}

export default function (data) {
  const response = http.get(`${data.baseUrl}/api/mwd-data?sessionId=${encodeURIComponent(data.sessionId)}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${data.token}`,
    },
  });

  const body = parseJson(response);

  check(response, {
    "mwd-data status is 200": (res) => res.status === 200,
    "mwd-data response is valid": () => Array.isArray(body) || (body && typeof body === "object"),
  });

  sleep(1);
}
