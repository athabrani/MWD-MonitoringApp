import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

/**
 * Test ini sengaja tidak melakukan login.
 *
 * Token harus diperoleh satu kali oleh run-api-performance.ps1,
 * kemudian diberikan melalui environment TEST_TOKEN.
 */

const endpointDuration = new Trend("endpoint_duration_ms", true);
const endpointErrorRate = new Rate("endpoint_error_rate");

function parsePositiveInteger(value, fallback) {
  const parsed = parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseNonNegativeNumber(value, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

const VUS = parsePositiveInteger(__ENV.VUS, 1);
const ITERATIONS = parsePositiveInteger(__ENV.ITERATIONS, 30);
const SLEEP_SECONDS = parseNonNegativeNumber(__ENV.SLEEP_SECONDS, 1);

export const options = {
  vus: VUS,
  iterations: ITERATIONS,
  maxDuration: "10m",

  thresholds: {
    endpoint_duration_ms: ["p(95)<500"],
    endpoint_error_rate: ["rate<0.01"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

function requireEnvironmentVariable(name) {
  const value = __ENV[name];

  if (typeof value !== "string" || value.trim() === "") {
    fail(`Environment variable ${name} belum diatur.`);
  }

  return value.trim();
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function appendQueryParameter(parts, name, value) {
  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    parts.push(
      `${encodeURIComponent(name)}=${encodeURIComponent(value.trim())}`,
    );
  }
}

function safeJson(response) {
  try {
    return response.json();
  } catch (error) {
    return null;
  }
}

function isArrayResponse(body) {
  if (Array.isArray(body)) {
    return true;
  }

  if (
    body !== null &&
    typeof body === "object" &&
    Array.isArray(body.data)
  ) {
    return true;
  }

  return false;
}

function buildEndpointUrl(baseUrl, target, sessionId) {
  switch (target) {
    case "sessions":
      return `${baseUrl}/api/mwd-sessions`;

    case "mwd-data": {
      const query = [
        `sessionId=${encodeURIComponent(sessionId)}`,
      ];

      return `${baseUrl}/api/mwd-data?${query.join("&")}`;
    }

    case "historical-data": {
      const query = [
        `sessionId=${encodeURIComponent(sessionId)}`,
      ];

      appendQueryParameter(
        query,
        "measuredFrom",
        __ENV.MEASURED_FROM,
      );

      appendQueryParameter(
        query,
        "measuredTo",
        __ENV.MEASURED_TO,
      );

      /**
       * Depth hanya dikirim bila DEPTH_MIN dan DEPTH_MAX
       * sama-sama tersedia.
       *
       * Ini penting karena data test saat ini memiliki
       * depthMd dan hole_depth bernilai null.
       */
      const depthMin = __ENV.DEPTH_MIN;
      const depthMax = __ENV.DEPTH_MAX;

      if (
        typeof depthMin === "string" &&
        depthMin.trim() !== "" &&
        typeof depthMax === "string" &&
        depthMax.trim() !== ""
      ) {
        appendQueryParameter(query, "depthMin", depthMin);
        appendQueryParameter(query, "depthMax", depthMax);
      }

      return (
        `${baseUrl}/api/historical-data?` +
        query.join("&")
      );
    }

    case "export": {
      const query = [
        `sessionId=${encodeURIComponent(sessionId)}`,
      ];

      appendQueryParameter(
        query,
        "measuredFrom",
        __ENV.MEASURED_FROM,
      );

      appendQueryParameter(
        query,
        "measuredTo",
        __ENV.MEASURED_TO,
      );

      const depthMin = __ENV.DEPTH_MIN;
      const depthMax = __ENV.DEPTH_MAX;

      if (
        typeof depthMin === "string" &&
        depthMin.trim() !== "" &&
        typeof depthMax === "string" &&
        depthMax.trim() !== ""
      ) {
        appendQueryParameter(query, "depthMin", depthMin);
        appendQueryParameter(query, "depthMax", depthMax);
      }

      return (
        `${baseUrl}/api/exports/historical?` +
        query.join("&")
      );
    }

    default:
      fail(
        `TARGET_ENDPOINT tidak didukung: ${target}. ` +
        "Nilai yang valid: sessions, mwd-data, historical-data, export.",
      );

      return "";
  }
}

function validateSessionsResponse(response) {
  const body = safeJson(response);

  return check(body, {
    "sessions response JSON valid": (value) => value !== null,

    "sessions response berbentuk list": (value) =>
      isArrayResponse(value),
  });
}

function validateMwdDataResponse(response) {
  const body = safeJson(response);

  return check(body, {
    "mwd-data response JSON valid": (value) =>
      value !== null,

    "mwd-data response memiliki data": (value) => {
      if (Array.isArray(value)) {
        return true;
      }

      if (
        value !== null &&
        typeof value === "object"
      ) {
        return (
          Array.isArray(value.data) ||
          Array.isArray(value.rows) ||
          Object.prototype.hasOwnProperty.call(value, "count")
        );
      }

      return false;
    },
  });
}

function validateHistoricalResponse(response) {
  const body = safeJson(response);

  return check(body, {
    "historical response JSON valid": (value) =>
      value !== null,

    "historical response memiliki array data": (value) =>
      value !== null &&
      typeof value === "object" &&
      Array.isArray(value.data),

    "historical response memiliki count": (value) =>
      value !== null &&
      typeof value === "object" &&
      typeof value.count === "number",

    "historical response count konsisten": (value) => {
      if (
        value === null ||
        typeof value !== "object" ||
        !Array.isArray(value.data) ||
        typeof value.count !== "number"
      ) {
        return false;
      }

      return value.count === value.data.length;
    },
  });
}

function validateExportResponse(response) {
  const contentType = String(
    response.headers["Content-Type"] ||
    response.headers["content-type"] ||
    "",
  ).toLowerCase();

  return check(response, {
    "export content-type valid": () =>
      contentType.includes("text/csv") ||
      contentType.includes("application/csv") ||
      contentType.includes("application/octet-stream"),

    "export body tidak kosong": (value) =>
      typeof value.body === "string" &&
      value.body.length > 0,
  });
}

export function setup() {
  const baseUrl = normalizeBaseUrl(
    requireEnvironmentVariable("BASE_URL"),
  );

  const token = requireEnvironmentVariable("TEST_TOKEN");
  const sessionId = requireEnvironmentVariable("SESSION_ID");
  const target = requireEnvironmentVariable("TARGET_ENDPOINT");

  const supportedTargets = [
    "sessions",
    "mwd-data",
    "historical-data",
    "export",
  ];

  if (!supportedTargets.includes(target)) {
    fail(
      `TARGET_ENDPOINT '${target}' tidak didukung. ` +
      `Nilai valid: ${supportedTargets.join(", ")}`,
    );
  }

  return {
    baseUrl,
    token,
    sessionId,
    target,
  };
}

export default function (data) {
  const url = buildEndpointUrl(
    data.baseUrl,
    data.target,
    data.sessionId,
  );

  const response = http.get(url, {
    headers: {
      Authorization: `Bearer ${data.token}`,
      Accept:
        data.target === "export"
          ? "text/csv,application/octet-stream"
          : "application/json",
    },

    tags: {
      endpoint: data.target,
      test_run: __ENV.TEST_RUN_NAME || "unknown",
    },

    timeout: "30s",
  });

  endpointDuration.add(
    response.timings.duration,
    {
      endpoint: data.target,
    },
  );

  const statusSuccessful = check(response, {
    [`${data.target} status 200`]: (value) =>
      value.status === 200,
  });

  let bodySuccessful = false;

  if (response.status === 200) {
    switch (data.target) {
      case "sessions":
        bodySuccessful = validateSessionsResponse(response);
        break;

      case "mwd-data":
        bodySuccessful = validateMwdDataResponse(response);
        break;

      case "historical-data":
        bodySuccessful = validateHistoricalResponse(response);
        break;

      case "export":
        bodySuccessful = validateExportResponse(response);
        break;

      default:
        bodySuccessful = false;
    }
  }

  const requestSuccessful =
    statusSuccessful && bodySuccessful;

  endpointErrorRate.add(
    !requestSuccessful,
    {
      endpoint: data.target,
    },
  );

  /**
   * Cetak detail error hanya pada iterasi pertama agar terminal
   * tidak dipenuhi puluhan response yang sama.
   */
  if (!requestSuccessful && __ITER === 0) {
    const responsePreview =
      typeof response.body === "string"
        ? response.body.substring(0, 1000)
        : String(response.body);

    console.error(
      [
        `Endpoint test gagal: ${data.target}`,
        `URL: ${url}`,
        `Status: ${response.status}`,
        `Response: ${responsePreview}`,
      ].join("\n"),
    );
  }

  sleep(SLEEP_SECONDS);
}