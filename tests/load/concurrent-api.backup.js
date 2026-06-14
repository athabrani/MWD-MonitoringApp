import http from "k6/http";
import { check, sleep } from "k6";
import {
  Counter,
  Rate,
  Trend,
} from "k6/metrics";

/*
 * Concurrent-user API performance test
 *
 * Workload per iteration:
 * - 25% GET /api/mwd-sessions
 * - 50% GET /api/mwd-data
 * - 25% GET /api/historical-data
 *
 * Setiap iteration hanya mengirim SATU request.
 * Dengan pacing 1 detik:
 * - 1 VU  ≈ 1 request/second
 * - 5 VU  ≈ 5 requests/second
 * - 10 VU ≈ 10 requests/second
 */

const BASE_URL =
  __ENV.BASE_URL || "http://localhost:5002";

const SESSION_ID =
  __ENV.SESSION_ID || "1";

const USERNAME =
  __ENV.TEST_USERNAME || "engineer_test";

const PASSWORD =
  __ENV.TEST_PASSWORD || "TestPassword123!";

const PACING_SECONDS = Number(
  __ENV.PACING_SECONDS || "1",
);

const REQUEST_TIMEOUT =
  __ENV.REQUEST_TIMEOUT || "15s";

const MEASURED_FROM =
  __ENV.MEASURED_FROM ||
  "2026-06-01T00:00:00.000Z";

const MEASURED_TO =
  __ENV.MEASURED_TO ||
  "2026-06-01T00:14:55.000Z";

const DEPTH_MIN =
  __ENV.DEPTH_MIN || "";

const DEPTH_MAX =
  __ENV.DEPTH_MAX || "";

/*
 * Custom metrics.
 *
 * core_api_duration_ms:
 * Semua response API utama, termasuk response gagal.
 *
 * successful_api_duration_ms:
 * Hanya response yang memenuhi status dan JSON validation.
 *
 * core_api_error_rate:
 * Persentase request yang gagal check.
 */
const coreApiDuration = new Trend(
  "core_api_duration_ms",
  true,
);

const successfulApiDuration = new Trend(
  "successful_api_duration_ms",
  true,
);

const coreApiErrorRate = new Rate(
  "core_api_error_rate",
);

/*
 * Status counters untuk diagnosis.
 */
const responseStatus200 = new Counter(
  "response_status_200",
);

const responseStatus400 = new Counter(
  "response_status_400",
);

const responseStatus401 = new Counter(
  "response_status_401",
);

const responseStatus403 = new Counter(
  "response_status_403",
);

const responseStatus404 = new Counter(
  "response_status_404",
);

const responseStatus429 = new Counter(
  "response_status_429",
);

const responseStatus5xx = new Counter(
  "response_status_5xx",
);

const responseStatusOther = new Counter(
  "response_status_other",
);

/*
 * Nilai VU dan duration diberikan melalui command:
 *
 * k6 run --vus 10 --duration 60s ...
 */
export const options = {
  discardResponseBodies: false,

  summaryTrendStats: [
    "avg",
    "med",
    "p(90)",
    "p(95)",
    "p(99)",
    "max",
  ],

  thresholds: {
    /*
     * Target paper:
     * p95 kurang dari 500 ms.
     */
    core_api_duration_ms: [
      "p(95)<500",
    ],

    /*
     * Response sukses juga harus tetap cepat.
     */
    successful_api_duration_ms: [
      "p(95)<500",
    ],

    /*
     * Maksimal error rate kurang dari 1%.
     */
    core_api_error_rate: [
      "rate<0.01",
    ],

    http_req_failed: [
      "rate<0.01",
    ],
  },
};

/*
 * Hanya dipakai untuk membatasi log error.
 * Variabel top-level k6 bersifat per-VU.
 */
let loggedErrorCount = 0;

function safeJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

function extractToken(response) {
  const body = safeJson(response);

  if (!body) {
    return null;
  }

  return (
    body.token ||
    body.accessToken ||
    body.data?.token ||
    body.data?.accessToken ||
    null
  );
}

/*
 * Login dilakukan SATU KALI oleh setup().
 * Token yang dihasilkan dibagikan ke seluruh VU.
 */
export function setup() {
  const response = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      identifier: USERNAME,
      password: PASSWORD,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },

      timeout: REQUEST_TIMEOUT,

      tags: {
        endpoint: "setup-login",
        request_group: "setup",
      },
    },
  );

  const token = extractToken(response);

  const loginPassed = check(response, {
    "setup login status 200": (res) =>
      res.status === 200,

    "setup login response JSON": (res) =>
      safeJson(res) !== null,

    "setup token tersedia": () =>
      typeof token === "string" &&
      token.length > 0,
  });

  if (!loginPassed || !token) {
    throw new Error(
      `Setup login gagal. ` +
        `status=${response.status}, ` +
        `body=${String(response.body).slice(
          0,
          500,
        )}`,
    );
  }

  return {
    token,
  };
}

function registerStatusMetric(
  status,
  endpoint,
) {
  const tags = {
    endpoint,
    status: String(status),
  };

  if (status === 200) {
    responseStatus200.add(1, tags);
  } else if (status === 400) {
    responseStatus400.add(1, tags);
  } else if (status === 401) {
    responseStatus401.add(1, tags);
  } else if (status === 403) {
    responseStatus403.add(1, tags);
  } else if (status === 404) {
    responseStatus404.add(1, tags);
  } else if (status === 429) {
    responseStatus429.add(1, tags);
  } else if (
    status >= 500 &&
    status <= 599
  ) {
    responseStatus5xx.add(1, tags);
  } else {
    responseStatusOther.add(1, tags);
  }
}

function executeGet(
  url,
  token,
  endpoint,
) {
  const response = http.get(
    url,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },

      timeout: REQUEST_TIMEOUT,

      tags: {
        endpoint,
        request_group: "core-api",
      },
    },
  );

  registerStatusMetric(
    response.status,
    endpoint,
  );

  const responseBody = safeJson(response);

  const passed = check(response, {
    [`${endpoint} status 200`]: (res) =>
      res.status === 200,

    [`${endpoint} response JSON`]: () =>
      responseBody !== null,
  });

  const metricTags = {
    endpoint,
    status: String(response.status),
  };

  /*
   * Semua response dicatat pada metric utama.
   */
  coreApiDuration.add(
    response.timings.duration,
    metricTags,
  );

  /*
   * Hanya response valid dicatat pada successful trend.
   */
  if (passed) {
    successfulApiDuration.add(
      response.timings.duration,
      {
        endpoint,
      },
    );
  }

  coreApiErrorRate.add(
    !passed,
    metricTags,
  );

  /*
   * Tampilkan maksimal lima error dari VU pertama.
   * Ini membantu diagnosis tanpa memenuhi terminal.
   */
  if (
    !passed &&
    __VU === 1 &&
    loggedErrorCount < 5
  ) {
    console.error(
      [
        `[API ERROR]`,
        `endpoint=${endpoint}`,
        `status=${response.status}`,
        `duration=${response.timings.duration}ms`,
        `body=${String(response.body).slice(
          0,
          300,
        )}`,
      ].join(" "),
    );

    loggedErrorCount += 1;
  }

  return response;
}

function buildHistoricalUrl() {
  const parameters = [
    `sessionId=${encodeURIComponent(
      SESSION_ID,
    )}`,

    `measuredFrom=${encodeURIComponent(
      MEASURED_FROM,
    )}`,

    `measuredTo=${encodeURIComponent(
      MEASURED_TO,
    )}`,
  ];

  /*
   * Depth filter hanya ditambahkan jika diberikan.
   * Ini sesuai kondisi seed lama yang memiliki depthMd null.
   */
  if (DEPTH_MIN !== "") {
    parameters.push(
      `depthMin=${encodeURIComponent(
        DEPTH_MIN,
      )}`,
    );
  }

  if (DEPTH_MAX !== "") {
    parameters.push(
      `depthMax=${encodeURIComponent(
        DEPTH_MAX,
      )}`,
    );
  }

  return (
    `${BASE_URL}/api/historical-data?` +
    parameters.join("&")
  );
}

/*
 * Setiap iteration hanya menghasilkan satu HTTP request.
 *
 * Pola deterministik:
 * index 0 = sessions
 * index 1 = mwd-data
 * index 2 = mwd-data
 * index 3 = historical-data
 *
 * Hasil distribusi:
 * sessions        25%
 * mwd-data        50%
 * historical-data 25%
 */
export default function (data) {
  const workloadIndex =
    (__ITER + __VU) % 4;

  if (workloadIndex === 0) {
    executeGet(
      `${BASE_URL}/api/mwd-sessions`,
      data.token,
      "sessions",
    );
  } else if (
    workloadIndex === 1 ||
    workloadIndex === 2
  ) {
    executeGet(
      `${BASE_URL}/api/mwd-data` +
        `?sessionId=${encodeURIComponent(
          SESSION_ID,
        )}`,
      data.token,
      "mwd-data",
    );
  } else {
    executeGet(
      buildHistoricalUrl(),
      data.token,
      "historical-data",
    );
  }

  /*
   * Closed workload pacing.
   * Setiap VU menunggu sebelum iteration selanjutnya.
   */
  sleep(PACING_SECONDS);
}