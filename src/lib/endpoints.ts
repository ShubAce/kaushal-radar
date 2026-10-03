// One description of the public API, used by the docs screen and by the
// machine-readable OpenAPI document, so the two cannot drift apart.

export interface Param { name: string; values: string; required?: boolean }
export interface Endpoint {
  id: string;
  method: "GET" | "POST";
  path: string;
  summaryKey: string;                 // i18n key under api.*
  summary: string;                    // English, for OpenAPI
  params: Param[];
  example: string;                    // query string for GET, JSON body for POST
}

const SCOPE: Param[] = [
  { name: "state", values: "MH | TN | UP | GJ" },
  { name: "district", values: "district id, e.g. mh-pune" },
  { name: "sector", values: "sector id, e.g. ELEC" },
  { name: "trade", values: "trade id, e.g. ems-operator" },
];

export const ENDPOINTS: Endpoint[] = [
  { id: "meta", method: "GET", path: "/api/v1/meta", summaryKey: "eMeta", summary: "Scope, time window and headline totals", params: [], example: "" },
  { id: "geo", method: "GET", path: "/api/v1/geo", summaryKey: "eGeo", summary: "States and districts with population", params: [SCOPE[0]], example: "state=GJ" },
  { id: "trades", method: "GET", path: "/api/v1/trades", summaryKey: "eTrades", summary: "Sectors and trades with NCO-2015 and NSQF codes", params: [SCOPE[2]], example: "sector=GREEN" },
  {
    id: "gaps", method: "GET", path: "/api/v1/gaps", summaryKey: "eGaps", summary: "Demand, supply and balance score at any level",
    params: [
      { name: "level", values: "cell | state-trade | national-trade | district | state | sector" },
      ...SCOPE,
      { name: "sort", values: "gap | score | demand | supply | momentum | priority" },
      { name: "order", values: "desc | asc" },
      { name: "minSize", values: "hide rows with fewer openings and entrants than this" },
      { name: "limit", values: "1 to 20000 (default 100)" },
      { name: "offset", values: "rows to skip" },
      { name: "format", values: "json | csv" },
    ],
    example: "state=UP&sector=ELEC&sort=gap&limit=5",
  },
  {
    id: "forecast", method: "GET", path: "/api/v1/forecast", summaryKey: "eForecast", summary: "Monthly demand and supply series with forecast range",
    params: [...SCOPE, { name: "format", values: "json | csv" }], example: "district=tn-krishnagiri&trade=ems-operator",
  },
  {
    id: "flags", method: "GET", path: "/api/v1/flags", summaryKey: "eFlags", summary: "Early-warning flags, most severe first",
    params: [...SCOPE, { name: "severity", values: "critical | warning | watch" }, { name: "level", values: "district | state" }, { name: "limit", values: "1 to 5000" }, { name: "format", values: "json | csv" }],
    example: "state=GJ&severity=critical",
  },
  {
    id: "plan", method: "GET", path: "/api/v1/plan", summaryKey: "ePlan", summary: "Seat recommendations (target sheet) for a state",
    params: [
      { name: "state", values: "MH | TN | UP | GJ", required: true },
      { name: "budget", values: "neutral | plus5 | plus10 | free" },
      { name: "changes", values: "only" },
      { name: "format", values: "json | csv | xlsx" },
    ],
    example: "state=MH&budget=neutral&changes=only",
  },
  {
    id: "classify", method: "POST", path: "/api/v1/ai/classify", summaryKey: "eClassify", summary: "Map a job advertisement to an NCO-2015 family and a trade",
    params: [{ name: "text", values: "the advertisement", required: true }, { name: "locale", values: "en | hi | mr | ta | gu" }],
    example: JSON.stringify({ text: "Hiring CNC turning operators for an auto parts unit in Chakan, Pune. ITI machinist, 1 year experience." }, null, 2),
  },
  {
    id: "ask", method: "POST", path: "/api/v1/ai/ask", summaryKey: "eAsk", summary: "Ask a question; the answer is grounded in this system's figures",
    params: [{ name: "question", values: "plain language", required: true }, { name: "locale", values: "en | hi | mr | ta | gu" }],
    example: JSON.stringify({ question: "Which warnings are critical in Gujarat?" }, null, 2),
  },
];
