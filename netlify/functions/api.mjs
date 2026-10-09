import{createRequire as __cr}from'module';const require=__cr(import.meta.url);

// node_modules/@netlify/blobs/dist/chunk-XR3MUBBK.js
var NF_ERROR = "x-nf-error";
var NF_REQUEST_ID = "x-nf-request-id";
var BlobsInternalError = class extends Error {
  constructor(res) {
    let details = res.headers.get(NF_ERROR) || `${res.status} status code`;
    if (res.headers.has(NF_REQUEST_ID)) {
      details += `, ID: ${res.headers.get(NF_REQUEST_ID)}`;
    }
    super(`Netlify Blobs has generated an internal error (${details})`);
    this.name = "BlobsInternalError";
  }
};
var collectIterator = async (iterator) => {
  const result = [];
  for await (const item of iterator) {
    result.push(item);
  }
  return result;
};
var base64Decode = (input) => {
  const { Buffer: Buffer2 } = globalThis;
  if (Buffer2) {
    return Buffer2.from(input, "base64").toString();
  }
  return atob(input);
};
var base64Encode = (input) => {
  const { Buffer: Buffer2 } = globalThis;
  if (Buffer2) {
    return Buffer2.from(input).toString("base64");
  }
  return btoa(input);
};
var getEnvironment = () => {
  const { Deno, Netlify: Netlify2, process } = globalThis;
  return Netlify2?.env ?? Deno?.env ?? {
    delete: (key) => delete process?.env[key],
    get: (key) => process?.env[key],
    has: (key) => Boolean(process?.env[key]),
    set: (key, value) => {
      if (process?.env) {
        process.env[key] = value;
      }
    },
    toObject: () => process?.env ?? {}
  };
};
var getEnvironmentContext = () => {
  const context = globalThis.netlifyBlobsContext || getEnvironment().get("NETLIFY_BLOBS_CONTEXT");
  if (typeof context !== "string" || !context) {
    return {};
  }
  const data = base64Decode(context);
  try {
    return JSON.parse(data);
  } catch {
  }
  return {};
};
var MissingBlobsEnvironmentError = class extends Error {
  constructor(requiredProperties) {
    super(
      `The environment has not been configured to use Netlify Blobs. To use it manually, supply the following properties when creating a store: ${requiredProperties.join(
        ", "
      )}`
    );
    this.name = "MissingBlobsEnvironmentError";
  }
};
var BASE64_PREFIX = "b64;";
var METADATA_HEADER_INTERNAL = "x-amz-meta-user";
var METADATA_HEADER_EXTERNAL = "netlify-blobs-metadata";
var METADATA_MAX_SIZE = 2 * 1024;
var encodeMetadata = (metadata) => {
  if (!metadata) {
    return null;
  }
  const encodedObject = base64Encode(JSON.stringify(metadata));
  const payload = `b64;${encodedObject}`;
  if (METADATA_HEADER_EXTERNAL.length + payload.length > METADATA_MAX_SIZE) {
    throw new Error("Metadata object exceeds the maximum size");
  }
  return payload;
};
var decodeMetadata = (header) => {
  if (!header || !header.startsWith(BASE64_PREFIX)) {
    return {};
  }
  const encodedData = header.slice(BASE64_PREFIX.length);
  const decodedData = base64Decode(encodedData);
  const metadata = JSON.parse(decodedData);
  return metadata;
};
var getMetadataFromResponse = (response) => {
  if (!response.headers) {
    return {};
  }
  const value = response.headers.get(METADATA_HEADER_EXTERNAL) || response.headers.get(METADATA_HEADER_INTERNAL);
  try {
    return decodeMetadata(value);
  } catch {
    throw new Error(
      "An internal error occurred while trying to retrieve the metadata for an entry. Please try updating to the latest version of the Netlify Blobs client."
    );
  }
};
var BlobsConsistencyError = class extends Error {
  constructor() {
    super(
      `Netlify Blobs has failed to perform a read using strong consistency because the environment has not been configured with a 'uncachedEdgeURL' property`
    );
    this.name = "BlobsConsistencyError";
  }
};
var regions = {
  "us-east-1": true,
  "us-east-2": true,
  "eu-central-1": true,
  "ap-southeast-1": true,
  "ap-southeast-2": true
};
var isValidRegion = (input) => Object.keys(regions).includes(input);
var InvalidBlobsRegionError = class extends Error {
  constructor(region) {
    super(
      `${region} is not a supported Netlify Blobs region. Supported values are: ${Object.keys(regions).join(", ")}.`
    );
    this.name = "InvalidBlobsRegionError";
  }
};
var DEFAULT_RETRY_DELAY = getEnvironment().get("NODE_ENV") === "test" ? 1 : 5e3;
var MIN_RETRY_DELAY = 1e3;
var MAX_RETRY = 5;
var RATE_LIMIT_HEADER = "X-RateLimit-Reset";
var fetchAndRetry = async (fetch2, url, options, attemptsLeft = MAX_RETRY) => {
  try {
    const res = await fetch2(url, options);
    if (attemptsLeft > 0 && (res.status === 429 || res.status >= 500)) {
      const delay = getDelay(res.headers.get(RATE_LIMIT_HEADER));
      await sleep(delay);
      return fetchAndRetry(fetch2, url, options, attemptsLeft - 1);
    }
    return res;
  } catch (error) {
    if (attemptsLeft === 0) {
      throw error;
    }
    const delay = getDelay();
    await sleep(delay);
    return fetchAndRetry(fetch2, url, options, attemptsLeft - 1);
  }
};
var getDelay = (rateLimitReset) => {
  if (!rateLimitReset) {
    return DEFAULT_RETRY_DELAY;
  }
  return Math.max(Number(rateLimitReset) * 1e3 - Date.now(), MIN_RETRY_DELAY);
};
var sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
var SIGNED_URL_ACCEPT_HEADER = "application/json;type=signed-url";
var Client = class {
  constructor({ apiURL, consistency, edgeURL, fetch: fetch2, region, siteID, token, uncachedEdgeURL }) {
    this.apiURL = apiURL;
    this.consistency = consistency ?? "eventual";
    this.edgeURL = edgeURL;
    this.fetch = fetch2 ?? globalThis.fetch;
    this.region = region;
    this.siteID = siteID;
    this.token = token;
    this.uncachedEdgeURL = uncachedEdgeURL;
    if (!this.fetch) {
      throw new Error(
        "Netlify Blobs could not find a `fetch` client in the global scope. You can either update your runtime to a version that includes `fetch` (like Node.js 18.0.0 or above), or you can supply your own implementation using the `fetch` property."
      );
    }
  }
  async getFinalRequest({
    consistency: opConsistency,
    key,
    metadata,
    method,
    parameters = {},
    storeName
  }) {
    const encodedMetadata = encodeMetadata(metadata);
    const consistency = opConsistency ?? this.consistency;
    let urlPath = `/${this.siteID}`;
    if (storeName) {
      urlPath += `/${storeName}`;
    }
    if (key) {
      urlPath += `/${key}`;
    }
    if (this.edgeURL) {
      if (consistency === "strong" && !this.uncachedEdgeURL) {
        throw new BlobsConsistencyError();
      }
      const headers = {
        authorization: `Bearer ${this.token}`
      };
      if (encodedMetadata) {
        headers[METADATA_HEADER_INTERNAL] = encodedMetadata;
      }
      if (this.region) {
        urlPath = `/region:${this.region}${urlPath}`;
      }
      const url2 = new URL(urlPath, consistency === "strong" ? this.uncachedEdgeURL : this.edgeURL);
      for (const key2 in parameters) {
        url2.searchParams.set(key2, parameters[key2]);
      }
      return {
        headers,
        url: url2.toString()
      };
    }
    const apiHeaders = { authorization: `Bearer ${this.token}` };
    const url = new URL(`/api/v1/blobs${urlPath}`, this.apiURL ?? "https://api.netlify.com");
    for (const key2 in parameters) {
      url.searchParams.set(key2, parameters[key2]);
    }
    if (this.region) {
      url.searchParams.set("region", this.region);
    }
    if (storeName === void 0 || key === void 0) {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    if (encodedMetadata) {
      apiHeaders[METADATA_HEADER_EXTERNAL] = encodedMetadata;
    }
    if (method === "head" || method === "delete") {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    const res = await this.fetch(url.toString(), {
      headers: { ...apiHeaders, accept: SIGNED_URL_ACCEPT_HEADER },
      method
    });
    if (res.status !== 200) {
      throw new BlobsInternalError(res);
    }
    const { url: signedURL } = await res.json();
    const userHeaders = encodedMetadata ? { [METADATA_HEADER_INTERNAL]: encodedMetadata } : void 0;
    return {
      headers: userHeaders,
      url: signedURL
    };
  }
  async makeRequest({
    body,
    consistency,
    headers: extraHeaders,
    key,
    metadata,
    method,
    parameters,
    storeName
  }) {
    const { headers: baseHeaders = {}, url } = await this.getFinalRequest({
      consistency,
      key,
      metadata,
      method,
      parameters,
      storeName
    });
    const headers = {
      ...baseHeaders,
      ...extraHeaders
    };
    if (method === "put") {
      headers["cache-control"] = "max-age=0, stale-while-revalidate=60";
    }
    const options = {
      body,
      headers,
      method
    };
    if (body instanceof ReadableStream) {
      options.duplex = "half";
    }
    return fetchAndRetry(this.fetch, url, options);
  }
};
var getClientOptions = (options, contextOverride) => {
  const context = contextOverride ?? getEnvironmentContext();
  const siteID = context.siteID ?? options.siteID;
  const token = context.token ?? options.token;
  if (!siteID || !token) {
    throw new MissingBlobsEnvironmentError(["siteID", "token"]);
  }
  if (options.region !== void 0 && !isValidRegion(options.region)) {
    throw new InvalidBlobsRegionError(options.region);
  }
  const clientOptions = {
    apiURL: context.apiURL ?? options.apiURL,
    consistency: options.consistency,
    edgeURL: context.edgeURL ?? options.edgeURL,
    fetch: options.fetch,
    region: options.region,
    siteID,
    token,
    uncachedEdgeURL: context.uncachedEdgeURL ?? options.uncachedEdgeURL
  };
  return clientOptions;
};

// node_modules/@netlify/blobs/dist/main.js
var DEPLOY_STORE_PREFIX = "deploy:";
var LEGACY_STORE_INTERNAL_PREFIX = "netlify-internal/legacy-namespace/";
var SITE_STORE_PREFIX = "site:";
var Store = class _Store {
  constructor(options) {
    this.client = options.client;
    if ("deployID" in options) {
      _Store.validateDeployID(options.deployID);
      let name = DEPLOY_STORE_PREFIX + options.deployID;
      if (options.name) {
        name += `:${options.name}`;
      }
      this.name = name;
    } else if (options.name.startsWith(LEGACY_STORE_INTERNAL_PREFIX)) {
      const storeName = options.name.slice(LEGACY_STORE_INTERNAL_PREFIX.length);
      _Store.validateStoreName(storeName);
      this.name = storeName;
    } else {
      _Store.validateStoreName(options.name);
      this.name = SITE_STORE_PREFIX + options.name;
    }
  }
  async delete(key) {
    const res = await this.client.makeRequest({ key, method: "delete", storeName: this.name });
    if (![200, 204, 404].includes(res.status)) {
      throw new BlobsInternalError(res);
    }
  }
  async get(key, options) {
    const { consistency, type } = options ?? {};
    const res = await this.client.makeRequest({ consistency, key, method: "get", storeName: this.name });
    if (res.status === 404) {
      return null;
    }
    if (res.status !== 200) {
      throw new BlobsInternalError(res);
    }
    if (type === void 0 || type === "text") {
      return res.text();
    }
    if (type === "arrayBuffer") {
      return res.arrayBuffer();
    }
    if (type === "blob") {
      return res.blob();
    }
    if (type === "json") {
      return res.json();
    }
    if (type === "stream") {
      return res.body;
    }
    throw new BlobsInternalError(res);
  }
  async getMetadata(key, { consistency } = {}) {
    const res = await this.client.makeRequest({ consistency, key, method: "head", storeName: this.name });
    if (res.status === 404) {
      return null;
    }
    if (res.status !== 200 && res.status !== 304) {
      throw new BlobsInternalError(res);
    }
    const etag = res?.headers.get("etag") ?? void 0;
    const metadata = getMetadataFromResponse(res);
    const result = {
      etag,
      metadata
    };
    return result;
  }
  async getWithMetadata(key, options) {
    const { consistency, etag: requestETag, type } = options ?? {};
    const headers = requestETag ? { "if-none-match": requestETag } : void 0;
    const res = await this.client.makeRequest({
      consistency,
      headers,
      key,
      method: "get",
      storeName: this.name
    });
    if (res.status === 404) {
      return null;
    }
    if (res.status !== 200 && res.status !== 304) {
      throw new BlobsInternalError(res);
    }
    const responseETag = res?.headers.get("etag") ?? void 0;
    const metadata = getMetadataFromResponse(res);
    const result = {
      etag: responseETag,
      metadata
    };
    if (res.status === 304 && requestETag) {
      return { data: null, ...result };
    }
    if (type === void 0 || type === "text") {
      return { data: await res.text(), ...result };
    }
    if (type === "arrayBuffer") {
      return { data: await res.arrayBuffer(), ...result };
    }
    if (type === "blob") {
      return { data: await res.blob(), ...result };
    }
    if (type === "json") {
      return { data: await res.json(), ...result };
    }
    if (type === "stream") {
      return { data: res.body, ...result };
    }
    throw new Error(`Invalid 'type' property: ${type}. Expected: arrayBuffer, blob, json, stream, or text.`);
  }
  list(options = {}) {
    const iterator = this.getListIterator(options);
    if (options.paginate) {
      return iterator;
    }
    return collectIterator(iterator).then(
      (items) => items.reduce(
        (acc, item) => ({
          blobs: [...acc.blobs, ...item.blobs],
          directories: [...acc.directories, ...item.directories]
        }),
        { blobs: [], directories: [] }
      )
    );
  }
  async set(key, data, { metadata } = {}) {
    _Store.validateKey(key);
    const res = await this.client.makeRequest({
      body: data,
      key,
      metadata,
      method: "put",
      storeName: this.name
    });
    if (res.status !== 200) {
      throw new BlobsInternalError(res);
    }
  }
  async setJSON(key, data, { metadata } = {}) {
    _Store.validateKey(key);
    const payload = JSON.stringify(data);
    const headers = {
      "content-type": "application/json"
    };
    const res = await this.client.makeRequest({
      body: payload,
      headers,
      key,
      metadata,
      method: "put",
      storeName: this.name
    });
    if (res.status !== 200) {
      throw new BlobsInternalError(res);
    }
  }
  static formatListResultBlob(result) {
    if (!result.key) {
      return null;
    }
    return {
      etag: result.etag,
      key: result.key
    };
  }
  static validateKey(key) {
    if (key === "") {
      throw new Error("Blob key must not be empty.");
    }
    if (key.startsWith("/") || key.startsWith("%2F")) {
      throw new Error("Blob key must not start with forward slash (/).");
    }
    if (new TextEncoder().encode(key).length > 600) {
      throw new Error(
        "Blob key must be a sequence of Unicode characters whose UTF-8 encoding is at most 600 bytes long."
      );
    }
  }
  static validateDeployID(deployID) {
    if (!/^\w{1,24}$/.test(deployID)) {
      throw new Error(`'${deployID}' is not a valid Netlify deploy ID.`);
    }
  }
  static validateStoreName(name) {
    if (name.includes("/") || name.includes("%2F")) {
      throw new Error("Store name must not contain forward slashes (/).");
    }
    if (new TextEncoder().encode(name).length > 64) {
      throw new Error(
        "Store name must be a sequence of Unicode characters whose UTF-8 encoding is at most 64 bytes long."
      );
    }
  }
  getListIterator(options) {
    const { client, name: storeName } = this;
    const parameters = {};
    if (options?.prefix) {
      parameters.prefix = options.prefix;
    }
    if (options?.directories) {
      parameters.directories = "true";
    }
    return {
      [Symbol.asyncIterator]() {
        let currentCursor = null;
        let done = false;
        return {
          async next() {
            if (done) {
              return { done: true, value: void 0 };
            }
            const nextParameters = { ...parameters };
            if (currentCursor !== null) {
              nextParameters.cursor = currentCursor;
            }
            const res = await client.makeRequest({
              method: "get",
              parameters: nextParameters,
              storeName
            });
            let blobs = [];
            let directories = [];
            if (![200, 204, 404].includes(res.status)) {
              throw new BlobsInternalError(res);
            }
            if (res.status === 404) {
              done = true;
            } else {
              const page = await res.json();
              if (page.next_cursor) {
                currentCursor = page.next_cursor;
              } else {
                done = true;
              }
              blobs = (page.blobs ?? []).map(_Store.formatListResultBlob).filter(Boolean);
              directories = page.directories ?? [];
            }
            return {
              done: false,
              value: {
                blobs,
                directories
              }
            };
          }
        };
      }
    };
  }
};
var getStore = (input) => {
  if (typeof input === "string") {
    const clientOptions = getClientOptions({});
    const client = new Client(clientOptions);
    return new Store({ client, name: input });
  }
  if (typeof input?.name === "string" && typeof input?.siteID === "string" && typeof input?.token === "string") {
    const { name, siteID, token } = input;
    const clientOptions = getClientOptions(input, { siteID, token });
    if (!name || !siteID || !token) {
      throw new MissingBlobsEnvironmentError(["name", "siteID", "token"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, name });
  }
  if (typeof input?.name === "string") {
    const { name } = input;
    const clientOptions = getClientOptions(input);
    if (!name) {
      throw new MissingBlobsEnvironmentError(["name"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, name });
  }
  if (typeof input?.deployID === "string") {
    const clientOptions = getClientOptions(input);
    const { deployID } = input;
    if (!deployID) {
      throw new MissingBlobsEnvironmentError(["deployID"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, deployID });
  }
  throw new Error(
    "The `getStore` method requires the name of the store as a string or as the `name` property of an options object"
  );
};

// api.src.mjs
import { scrypt, randomBytes, createHmac, createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
var sc = promisify(scrypt);
var config = { path: "/api" };
var env = (k) => Netlify.env.get(k);
var json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
var fail = (m, s = 400) => json({ error: m }, s);
var openDb = async () => {
  const s = getStore({ name: "viraj", consistency: "strong" });
  try {
    await s.get("cfg", { type: "json" });
    return s;
  } catch (e) {
    if (e && e.name === "BlobsConsistencyError") return getStore("viraj");
    throw e;
  }
};
var okEmail = (e) => e.length < 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && /^(gmail\.com|yahoo\.com|.*viraj.*)$/.test(e.split("@")[1]);
var strong = (p) => p.length >= 8 && p.length <= 128 && /[A-Za-z]/.test(p) && /\d/.test(p);
var WEAK = "Password must be 8+ characters with letters and numbers.";
var hash = async (p, salt) => (await sc(p, salt, 64)).toString("hex");
var eq = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
var sha = (t) => createHash("sha256").update(String(t)).digest("hex");
// Administrators are decided ONLY by the ADMIN_EMAIL environment variable (comma separated list allowed).
var adminList = () => String(env("ADMIN_EMAIL") || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
var uid = () => "s" + Date.now().toString(36) + randomBytes(4).toString("hex");
var clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
var cleanDob = (v) => { v = String(v || "").trim(); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ""; };
var cleanStudent = (s, id) => ({ id: id || uid(), name: clip(s.name, 80), adm: clip(s.adm, 30), dob: cleanDob(s.dob), cls: clip(s.cls, 40), guardian: clip(s.guardian, 80), phone: clip(s.phone, 30), email: clip(s.email, 120) });
async function mail(to, link) {
  const url = env("GOOGLE_SCRIPT_URL"), secret = env("MAIL_SECRET");
  if (!url || !secret) return null;
  const html = `<div style="font-family:Arial,sans-serif"><h2 style="color:#0056ab">Viraj International Academy</h2><p>Click the button to choose a new password. The link works for 1 hour.</p><p><a href="${link}" style="background:#0056ab;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset password</a></p><p style="color:#777;font-size:12px">If you didn't ask for this, ignore this email.</p></div>`;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ secret, to, subject: "Reset your Form Tutor Portal password", html }) });
  return r.ok;
}
// ---- School data: ONE shared record that the admin writes and every form tutor reads ----
async function loadSchool(db) {
  let s = await db.get("school", { type: "json" });
  if (s) return s;
  s = { classes: [], students: [], messages: [], rev: 1 };
  const old = await db.get("school_cfg", { type: "json" }); // migrate data saved by the earlier version
  if (old) {
    s.classes = Array.isArray(old.classes) ? old.classes.map(String) : [];
    s.students = Array.isArray(old.students) ? old.students.map((x) => cleanStudent(x, String(x.id))) : [];
    if (old.notice) s.messages.push({ id: uid(), title: "Announcement", text: String(old.notice).slice(0, 2000), target: "all", at: Date.now() });
    for (const st of s.students) if (st.cls && !s.classes.includes(st.cls)) s.classes.push(st.cls);
  }
  return s;
}
async function saveSchool(db, s) { s.rev = (s.rev || 0) + 1; s.updated = Date.now(); await db.setJSON("school", s); }
var handle = async (req) => {
  if (req.method === "GET") {
    let store = "ok";
    try {
      const t2 = await openDb();
      await t2.set("health", String(Date.now()));
      await t2.get("health");
    } catch (e) {
      store = "ERROR: " + e.message;
    }
    return json({ service: "Viraj Form Tutor Portal", functionRunning: true, storage: store, recoveryEmail: !!(env("GOOGLE_SCRIPT_URL") && env("MAIL_SECRET")), customAccessCode: !!env("ACCESS_CODE"), adminConfigured: adminList().length > 0 || !!((await (async () => { try { return await (await openDb()).get("cfg", { type: "json" }); } catch { return null; } })()) || {}).admins });
  }
  if (req.method !== "POST") return fail("POST only", 405);
  const sfs = req.headers.get("sec-fetch-site");
  if (sfs && sfs !== "same-origin" && sfs !== "none") return fail("Forbidden", 403);
  if (Number(req.headers.get("content-length") || 0) > 25e5) return fail("Too large", 413);
  let b;
  try {
    b = await req.json();
  } catch {
    return fail("Bad request");
  }
  if (!b || typeof b !== "object") return fail("Bad request");
  const db = await openDb();
  let cfg = await db.get("cfg", { type: "json" });
  if (!cfg) {
    cfg = { secret: randomBytes(32).toString("hex") };
    await db.setJSON("cfg", cfg);
  }
  const admins = () => adminList().length ? adminList() : (cfg.admins || []);
  const isAdminEmail = (e) => admins().includes(String(e || "").toLowerCase());
  const roleOf = (e) => isAdminEmail(e) ? "admin" : "tutor";
  const sign = (e, v) => {
    const p = Buffer.from(JSON.stringify({ e, v, exp: Date.now() + 7 * 864e5 })).toString("base64url");
    return p + "." + createHmac("sha256", cfg.secret).update(p).digest("base64url");
  };
  const verify = (t2) => {
    try {
      const [p, s] = String(t2).split(".");
      if (!eq(s, createHmac("sha256", cfg.secret).update(p).digest("base64url"))) return null;
      const o = JSON.parse(Buffer.from(p, "base64url"));
      return o.exp > Date.now() ? o : null;
    } catch {
      return null;
    }
  };
  const ukey = (e) => "u:" + encodeURIComponent(e);
  const setPw = async (e, pw2) => {
    const old = await db.get(ukey(e), { type: "json" }) || {};
    const salt = randomBytes(16).toString("hex");
    const v = (old.v || 0) + 1;
    await db.setJSON(ukey(e), { ...old, email: e, salt, hash: await hash(pw2, salt), v, created: old.created || (/* @__PURE__ */ new Date()).toISOString() });
    return v;
  };
  const email = String(b.email || "").trim().toLowerCase(), pw = String(b.password || "");
  const ok = (e, v) => json({ token: sign(e, v), email: e, role: roleOf(e) });
  const lk = "f:" + sha(email);
  const locked = async () => {
    const f = await db.get(lk, { type: "json" });
    return f && f.until > Date.now();
  };
  const strike = async () => {
    const f = await db.get(lk, { type: "json" }) || { n: 0 };
    f.n = (f.n || 0) + 1;
    if (f.n >= 5) {
      f.until = Date.now() + 1 * 6e4;
      f.n = 0;
    }
    await db.setJSON(lk, f);
  };
  switch (b.a) {
    case "register": {
      if (!okEmail(email)) return fail("Use your Viraj school email, Gmail or Yahoo address.");
      if (await locked()) return fail("Too many attempts. Try again in 1 minute.", 429);
      const codes = await db.get("valid_codes", { type: "json" }) || [];
      const code = String(b.code || "");
      if (!codes.includes(code) && code !== (env("ACCESS_CODE") || "Viraj@2026")) {
        await strike();
        return fail("Invalid school access code.");
      }
      if (!strong(pw)) return fail(WEAK);
      if (await db.get(ukey(email))) return fail("This email is already registered \u2014 please sign in.");
      if (codes.includes(code)) await db.setJSON("valid_codes", codes.filter((c) => c !== code));
      if (!admins().length) { cfg.admins = [email]; await db.setJSON("cfg", cfg); } // nobody is admin yet: the first account registered becomes the administrator
      return ok(email, await setPw(email, pw));
    }
    case "login": {
      if (await locked()) return fail("Too many attempts. Try again in 1 minute.", 429);
      const u2 = await db.get(ukey(email), { type: "json" });
      if (!u2 || !eq(await hash(pw, u2.salt), u2.hash)) {
        await strike();
        return fail("Incorrect email or password.", 401);
      }
      await db.delete(lk);
      return ok(email, u2.v || 1);
    }
    case "forgot": {
      if (!env("GOOGLE_SCRIPT_URL") || !env("MAIL_SECRET")) return fail("Password recovery email is not set up yet. Please contact the ICT department.", 503);
      const pk = "p:" + sha(email), last = await db.get(pk, { type: "json" });
      if (okEmail(email) && !(last && Date.now() - last.t < 6e4) && await db.get(ukey(email))) {
        await db.setJSON(pk, { t: Date.now() });
        const t2 = randomBytes(24).toString("hex");
        await db.setJSON("r:" + sha(t2), { email, exp: Date.now() + 36e5 });
        await mail(email, `${req.headers.get("origin") || new URL(req.url).origin}/?reset=${t2}`);
      }
      return json({ ok: true });
    }
    case "reset": {
      const k = "r:" + sha(b.rt), r = await db.get(k, { type: "json" });
      if (!r || r.exp < Date.now()) return fail("This recovery link has expired. Please request a new one.");
      if (!strong(pw)) return fail(WEAK);
      const v = await setPw(r.email, pw);
      await db.delete(k);
      await db.delete("f:" + sha(r.email));
      return ok(r.email, v);
    }
  }
  const t = verify(b.token);
  const u = t && await db.get(ukey(t.e), { type: "json" });
  if (!u || (u.v || 1) !== t.v) return fail("Session expired \u2014 please sign in again.", 401);
  const me = t.e;
  const admin = isAdminEmail(me); // role is re-checked on EVERY request, never trusted from the token
  const act = String(b.a || "");
  if (act.startsWith("admin_") && !admin) return fail("Unauthorized: administrator access required.", 403);
  switch (act) {
    case "me":
      return ok(me, u.v || 1);
    case "load":
      return json({ data: await db.get("d:" + encodeURIComponent(me), { type: "json" }) });
    case "save": {
      const d = b.data;
      if (!d || typeof d !== "object" || !Array.isArray(d.students) || !Array.isArray(d.behavior) || typeof d.attendance !== "object" || d.events && !Array.isArray(d.events)) return fail("Invalid data");
      if (d.students.length > 600) return fail("Too many students.");
      const q = d.profile || {}, ph = String(q.photo || ""), profile = { name: String(q.name || "").slice(0, 80), subject: String(q.subject || "").slice(0, 60), cls: String(q.cls || "").slice(0, 40), emoji: String(q.emoji || "").slice(0, 8), photo: /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(ph) && ph.length < 8e4 ? ph : "" };
      const clean = { students: d.students, attendance: d.attendance, behavior: d.behavior, events: d.events || [], clubs: Array.isArray(d.clubs) ? d.clubs : [], seen: Number(d.seen) || 0, profile };
      if (JSON.stringify(clean).length > 2e6) return fail("Data too large.");
      await db.setJSON("d:" + encodeURIComponent(me), clean);
      return json({ ok: true });
    }
    case "changepw": {
      if (!strong(pw)) return fail(WEAK);
      return ok(me, await setPw(me, pw));
    }
    // ---------- TUTOR + ADMIN: live sync ----------
    // Returns the class list, ONLY the learners of the class asked for, and the messages meant for that class.
    case "sync": {
      const s = await loadSchool(db);
      const cls = clip(b.cls, 40);
      const valid = !!cls && s.classes.includes(cls);
      const classes = [...s.classes].sort((x, y) => x.localeCompare(y, void 0, { numeric: true }));
      const students = valid ? s.students.filter((x) => x.cls === cls) : [];
      const messages = s.messages.filter((m) => m.target === "all" || (valid && m.target === cls)).sort((x, y) => y.at - x.at).slice(0, 50);
      return json({ rev: s.rev || 0, classes, cls: valid ? cls : "", students, messages });
    }
    // ---------- ADMIN ----------
    case "admin_load": {
      const s = await loadSchool(db);
      return json({ data: s });
    }
    case "admin_add_class": {
      const name = clip(b.name, 40);
      if (!name) return fail("Enter a class name.");
      const s = await loadSchool(db);
      if (s.classes.some((c) => c.toLowerCase() === name.toLowerCase())) return fail("That class already exists.");
      s.classes.push(name);
      await saveSchool(db, s);
      return json({ data: s });
    }
    case "admin_del_class": {
      const name = clip(b.name, 40);
      const s = await loadSchool(db);
      s.classes = s.classes.filter((c) => c !== name);
      s.students.forEach((x) => { if (x.cls === name) x.cls = ""; });
      s.messages = s.messages.filter((m) => m.target !== name);
      await saveSchool(db, s);
      return json({ data: s });
    }
    // Typed entry OR Excel import: both send a list of learners. Classes that don't exist yet are created automatically.
    case "admin_add_students": {
      const list = Array.isArray(b.students) ? b.students : [];
      if (!list.length) return fail("No learners to add.");
      if (list.length > 2000) return fail("Import at most 2000 learners at a time.");
      const s = await loadSchool(db);
      let added = 0, updated = 0, skipped = 0;
      for (const raw of list) {
        const n = cleanStudent(raw || {});
        if (!n.name) { skipped++; continue; }
        if (n.cls && !s.classes.includes(n.cls)) s.classes.push(n.cls);
        const hit = s.students.find((x) => n.adm ? x.adm === n.adm : x.name.toLowerCase() === n.name.toLowerCase() && x.cls === n.cls);
        if (hit) { // same admission number => update the existing learner (keeps their id, so the tutor's records stay linked)
          for (const k of ["name", "dob", "cls", "guardian", "phone", "email"]) if (n[k]) hit[k] = n[k];
          updated++;
        } else { s.students.push(n); added++; }
      }
      if (s.students.length > 5000) return fail("Student database is full (5000).");
      await saveSchool(db, s);
      return json({ data: s, added, updated, skipped });
    }
    case "admin_update_student": {
      const s = await loadSchool(db);
      const st = s.students.find((x) => x.id === String(b.id));
      if (!st) return fail("Student not found.");
      const f = b.fields || {};
      const n = cleanStudent({ ...st, ...f }, st.id);
      if (!n.name) return fail("Name cannot be empty.");
      if (n.cls && !s.classes.includes(n.cls)) s.classes.push(n.cls);
      Object.assign(st, n);
      await saveSchool(db, s);
      return json({ data: s });
    }
    case "admin_del_student": {
      const s = await loadSchool(db);
      const ids = new Set((Array.isArray(b.ids) ? b.ids : [b.id]).map(String));
      s.students = s.students.filter((x) => !ids.has(x.id));
      await saveSchool(db, s);
      return json({ data: s });
    }
    case "admin_post_message": {
      const text = clip(b.text, 2000), title = clip(b.title, 80) || "Announcement";
      if (!text) return fail("Write a message first.");
      const s = await loadSchool(db);
      const target = b.target === "all" || !b.target ? "all" : clip(b.target, 40);
      if (target !== "all" && !s.classes.includes(target)) return fail("Unknown class.");
      s.messages.unshift({ id: uid(), title, text, target, at: Date.now(), by: me });
      s.messages = s.messages.slice(0, 200);
      await saveSchool(db, s);
      return json({ data: s });
    }
    case "admin_del_message": {
      const s = await loadSchool(db);
      s.messages = s.messages.filter((m) => m.id !== String(b.id));
      await saveSchool(db, s);
      return json({ data: s });
    }
    case "admin_list_users": {
      const l = await db.list({ prefix: "u:" });
      const users = [];
      for (const it of l.blobs) {
        const em = decodeURIComponent(it.key.slice(2));
        const d = await db.get("d:" + encodeURIComponent(em), { type: "json" });
        users.push({ email: em, role: roleOf(em), name: d && d.profile ? d.profile.name : "", cls: d && d.profile ? d.profile.cls : "" });
      }
      return json({ users });
    }
    case "admin_reset_pw": {
      const target = String(b.email || "").trim().toLowerCase();
      if (!target) return fail("Target email required");
      if (!await db.get(ukey(target))) return fail("No account with that email.");
      const newPw = String(b.password || "");
      if (!strong(newPw)) return fail(WEAK);
      await setPw(target, newPw);
      return json({ ok: true });
    }
    case "admin_generate_code": {
      const code = randomBytes(5).toString("hex").toUpperCase();
      const codes = await db.get("valid_codes", { type: "json" }) || [];
      codes.push(code);
      await db.setJSON("valid_codes", codes);
      return json({ code });
    }
  }
  return fail("Unknown action");
};
var api_src_default = async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    const n = e && e.name, m = e && e.message || String(e);
    if (n === "MissingBlobsEnvironmentError" || /Blobs/i.test(m)) return json({ error: "Storage is not connected to this deployment. Deploy through Git or the Netlify CLI (netlify deploy --prod), not by dragging a folder. Details: " + m }, 500);
    return json({ error: "Server error: " + m }, 500);
  }
};
export {
  config,
  api_src_default as default
};
