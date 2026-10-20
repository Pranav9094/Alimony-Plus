// Integration + security tests. They run against a live backend and database:
//   BASE_URL=http://127.0.0.1:5000 node --test tests/
import test from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5000";
const run = Date.now();
const call = async (path, { method = "GET", token, body, form } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers["Content-Type"] = "application/json";
    const res = await fetch(`${BASE}/api${path}`, {
        method, headers, body: form ?? (body ? JSON.stringify(body) : undefined)
    });
    const type = res.headers.get("content-type") || "";
    return { res, status: res.status, json: type.includes("json") ? await res.json() : null };
};

const signup = async (tag) => {
    const email = `${tag}-${run}@test.example`;
    const password = "Passw0rd!test";
    await call("/auth/register", { method: "POST", body: { name: tag, email, password } });
    const { json } = await call("/auth/login", { method: "POST", body: { email, password } });
    return json.token;
};

const png = () => Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const upload = (token, caseId, { type = "image/png", bytes = png(), docType = "Identity / relationship" } = {}) => {
    const form = new FormData();
    form.append("caseId", String(caseId));
    form.append("documentType", docType);
    form.append("document", new Blob([bytes], { type }), "proof.png");
    return call("/documents/upload", { method: "POST", token, form });
};

let alice, mallory, caseId, docId;

test("setup: two separate users and one case owned by Alice", async () => {
    alice = await signup("alice");
    mallory = await signup("mallory");
    const created = await call("/cases", { method: "POST", token: alice, body: { title: "Alice case" } });
    assert.equal(created.status, 201);
    caseId = created.json.case.id;
});

test("unauthenticated requests are rejected", async () => {
    for (const path of [`/cases/${caseId}`, `/cases/${caseId}/intake`, `/cases/${caseId}/navigator`,
        `/cases/${caseId}/checklist`, `/documents/case/${caseId}`]) {
        assert.equal((await call(path)).status, 401, path);
    }
});

test("intake: invalid values are rejected, 'I do not know' is accepted", async () => {
    const bad = await call(`/cases/${caseId}/intake`, { method: "POST", token: alice, body: { marriageType: "<script>alert(1)</script>" } });
    assert.equal(bad.status, 400);
    const badList = await call(`/cases/${caseId}/intake`, { method: "POST", token: alice, body: { pendingProceedings: ["matrimonial", "x"] } });
    assert.equal(badList.status, 400);
    const badLoc = await call(`/cases/${caseId}/intake`, { method: "POST", token: alice, body: { location: "<img src=x onerror=alert(1)>" } });
    assert.equal(badLoc.status, 400);
    const partial = await call(`/cases/${caseId}/intake`, { method: "POST", token: alice, body: { relationshipStatus: "married" } });
    assert.equal(partial.status, 200);
    assert.equal(partial.json.intake.answers.marriageType, "unknown");
});

test("navigator: Hindu marriage, married, no case pending -> HAMA s.18 and BNSS s.144", async () => {
    await call(`/cases/${caseId}/intake`, { method: "POST", token: alice,
        body: { relationshipStatus: "married", marriageType: "hindu_rites", pendingProceedings: ["none"], location: "Delhi" } });
    const { status, json } = await call(`/cases/${caseId}/navigator`, { token: alice });
    assert.equal(status, 200);
    const ids = json.navigator.routes.map((r) => r.id);
    assert.deepEqual(ids.sort(), ["bnss_144", "hama_18"]);
    assert.equal(json.navigator.safetyFirst, false);
    for (const r of json.navigator.routes) {
        assert.ok(r.source.url && r.source.reviewedOn, "every route cites a source and review date");
        assert.equal(r.confidence, "possible");
    }
    assert.match(json.navigator.disclaimer, /not legal advice/);
    // The disclaimer may say the tool does not decide entitlement; it must never state an entitlement amount.
    assert.ok(!/you are entitled to\s*(INR|Rs|₹|\d)/i.test(JSON.stringify(json)));
});

test("navigator: matrimonial case pending -> HMA s.24 and s.25", async () => {
    await call(`/cases/${caseId}/intake`, { method: "POST", token: alice,
        body: { relationshipStatus: "separated", marriageType: "hindu_rites", pendingProceedings: ["matrimonial"] } });
    const { json } = await call(`/cases/${caseId}/navigator`, { token: alice });
    const ids = json.navigator.routes.map((r) => r.id);
    assert.ok(ids.includes("hma_24") && ids.includes("hma_25") && !ids.includes("hama_18"));
});

test("safety: a disclosed risk switches to the safety-first response", async () => {
    await call(`/cases/${caseId}/intake`, { method: "POST", token: alice, body: { safetyRisk: "immediate" } });
    const { json } = await call(`/cases/${caseId}/navigator`, { token: alice });
    assert.equal(json.navigator.safetyFirst, true);
    assert.ok(json.navigator.safety.contacts.length >= 1);
    assert.ok(json.navigator.routes.some((r) => r.id === "dv_s20"));
    await call(`/cases/${caseId}/intake`, { method: "POST", token: alice, body: { safetyRisk: "no", pendingProceedings: ["none"] } });
});

test("overlap: two pending proceedings are flagged for legal review", async () => {
    await call(`/cases/${caseId}/intake`, { method: "POST", token: alice, body: { pendingProceedings: ["matrimonial", "maintenance"] } });
    const { json } = await call(`/cases/${caseId}/navigator`, { token: alice });
    assert.ok(json.navigator.overlapWarning);
});

test("documents: upload works, spoofed content and unknown category are rejected", async () => {
    const ok = await upload(alice, caseId);
    assert.equal(ok.status, 201);
    docId = ok.json.document.id;
    const html = await upload(alice, caseId, { bytes: Buffer.from("<html><script>alert(1)</script></html>") });
    assert.equal(html.status, 400);
    const badType = await upload(alice, caseId, { docType: "<b>x</b>" });
    assert.equal(badType.status, 400);
});

test("checklist reflects uploaded documents and never marks anything verified", async () => {
    const { json } = await call(`/cases/${caseId}/checklist`, { token: alice });
    const identity = json.checklist.items.find((i) => i.key === "identity_marriage");
    assert.equal(identity.status, "added");
    assert.ok(json.checklist.items.every((i) => i.verified === false));
});

test("IDOR: Mallory cannot read or change any of Alice's records", async () => {
    const reads = [`/cases/${caseId}`, `/cases/${caseId}/intake`, `/cases/${caseId}/navigator`,
        `/cases/${caseId}/checklist`, `/documents/case/${caseId}`, `/documents/${docId}/download`,
        `/parties/case/${caseId}`];
    for (const path of reads) {
        const r = await call(path, { token: mallory });
        assert.ok([403, 404].includes(r.status), `${path} returned ${r.status}`);
    }
    const writes = [
        ["/cases/" + caseId + "/intake", "POST", { safetyRisk: "no" }],
        ["/cases/" + caseId, "PUT", { title: "hijacked" }],
        ["/cases/" + caseId, "DELETE"],
        ["/calculator/run", "POST", { caseId, applicantIncome: 1 }],
        ["/parties", "POST", { caseId, name: "x", role: "y" }]
    ];
    for (const [path, method, body] of writes) {
        const r = await call(path, { method, token: mallory, body });
        assert.ok([403, 404].includes(r.status), `${method} ${path} returned ${r.status}`);
    }
    assert.equal((await upload(mallory, caseId)).status, 403);
    const mine = await call("/cases", { token: mallory });
    assert.ok(!mine.json.cases.some((c) => c.id === caseId));
    const still = await call(`/cases/${caseId}`, { token: alice });
    assert.equal(still.json.case.title, "Alice case");
});

test("IDOR: id parameters are validated", async () => {
    for (const id of ["abc", "-1", "0", "1.5", "1;DROP"]) {
        assert.equal((await call(`/cases/${id}`, { token: alice })).status, 400, id);
    }
});

test("XSS: markup in titles is returned as inert JSON with safe headers", async () => {
    const payload = "<script>alert(1)</script>";
    const created = await call("/cases", { method: "POST", token: alice, body: { title: payload } });
    assert.equal(created.status, 201);
    const got = await call(`/cases/${created.json.case.id}`, { token: alice });
    assert.match(got.res.headers.get("content-type"), /application\/json/);
    assert.equal(got.res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(got.json.case.title, payload);
});

test("privacy: no password hashes or tokens leak in responses", async () => {
    for (const path of ["/cases", `/cases/${caseId}/intake`, "/protected"]) {
        const r = await call(path, { token: alice });
        const text = JSON.stringify(r.json);
        assert.ok(!/\$2[aby]\$/.test(text) && !/"password"/.test(text), path);
    }
});

test("hardening: malformed JSON and unknown routes get clean errors", async () => {
    const res = await fetch(`${BASE}/api/cases`, { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${alice}` }, body: "{bad" });
    assert.equal(res.status, 400);
    assert.equal((await call("/does-not-exist")).status, 404);
    assert.equal((await fetch(`${BASE}/api/health`)).headers.get("x-powered-by"), null);
});

test("download: filename header cannot be injected", async () => {
    const r = await fetch(`${BASE}/api/documents/${docId}/download`, { headers: { Authorization: `Bearer ${alice}` } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.match(r.headers.get("content-disposition"), /^attachment;/);
});

test("IDOR: Mallory cannot read or create under Alice's dependents, proceedings, orders and payments", async () => {
    const dep = await call("/dependents", { method: "POST", token: alice, body: { caseId, name: "Child A" } });
    const pro = await call("/proceedings", { method: "POST", token: alice, body: { caseId, courtName: "Family Court", proceedingType: "HMA 24" } });
    assert.equal(dep.status, 201, "alice dependent");
    assert.equal(pro.status, 201, "alice proceeding");
    const proId = pro.json.proceeding.id;
    const ord = await call("/orders", { method: "POST", token: alice, body: { proceedingId: proId, orderType: "Interim", amount: 1000 } });
    assert.equal(ord.status, 201, "alice order");
    const ordId = ord.json.order.id;
    const pay = await call("/payments", { method: "POST", token: alice, body: { orderId: ordId, amount: 500, paymentDate: "2026-10-01" } });
    assert.equal(pay.status, 201, "alice payment");
    const payId = pay.json.payment.id;

    const reads = [`/dependents/case/${caseId}`, `/proceedings/case/${caseId}`, `/proceedings/${proId}`,
        `/orders/proceeding/${proId}`, `/orders/${ordId}`, `/payments/order/${ordId}`, `/payments/${payId}`];
    for (const path of reads) {
        const own = await call(path, { token: alice });
        assert.equal(own.status, 200, `alice ${path} returned ${own.status}`);
        const r = await call(path, { token: mallory });
        assert.ok([403, 404].includes(r.status), `${path} returned ${r.status} for mallory`);
    }
    const writes = [
        ["/dependents", { caseId, name: "x" }],
        ["/proceedings", { caseId, courtName: "x" }],
        ["/orders", { proceedingId: proId, orderType: "x" }],
        ["/payments", { orderId: ordId, amount: 1, paymentDate: "2026-10-01" }]
    ];
    for (const [path, body] of writes) {
        const r = await call(path, { method: "POST", token: mallory, body });
        assert.ok([403, 404].includes(r.status), `POST ${path} returned ${r.status} for mallory`);
    }
});
