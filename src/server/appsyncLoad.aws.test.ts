import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Sha256 } from "@aws-crypto/sha256-js";
import { CognitoIdentityClient, GetCredentialsForIdentityCommand, GetIdCommand } from "@aws-sdk/client-cognito-identity";
import { AdminAddUserToGroupCommand, AdminCreateUserCommand, AdminDeleteUserCommand,
  AdminSetUserPasswordCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { Amplify } from "aws-amplify";
import { fetchAuthSession, signIn, signOut } from "aws-amplify/auth";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

const outputsPath = process.env.QUIZRUSH_LIVE_OUTPUTS;
describe.skipIf(process.env.QUIZRUSH_APPSYNC_LOAD_TEST !== "1" || !outputsPath)("100 Teilnehmende (AppSync)", () => {
  const username = `quizrush-load-${randomUUID()}@example.invalid`;
  const password = `A1!b${randomBytes(18).toString("base64url")}`;
  let userPoolId = "";
  let poolId = "";
  let region = "";
  let endpoint = "";
  let provider: CognitoIdentityProviderClient;
  let identity: CognitoIdentityClient;
  let userCreated = false;
  let token = "";
  beforeAll(async () => {
    if (!outputsPath) throw new Error("Sandbox-Ausgabe fehlt.");
    const outputs = z.object({
      version: z.string(),
      auth: z.object({ user_pool_id: z.string(), user_pool_client_id: z.string(), identity_pool_id: z.string(),
        aws_region: z.string(), unauthenticated_identities_enabled: z.boolean() }).passthrough(),
      data: z.object({ url: z.string(), aws_region: z.string(), default_authorization_type: z.string(),
        authorization_types: z.array(z.string()) }).passthrough(),
    }).passthrough().parse(JSON.parse(await readFile(outputsPath, "utf8")));
    userPoolId = outputs.auth.user_pool_id; poolId = outputs.auth.identity_pool_id;
    region = outputs.auth.aws_region; endpoint = outputs.data.url;
    provider = new CognitoIdentityProviderClient({ region });
    identity = new CognitoIdentityClient({ region });
    Amplify.configure(outputs);
    await provider.send(new AdminCreateUserCommand({ UserPoolId: userPoolId, Username: username,
      MessageAction: "SUPPRESS", UserAttributes: [{ Name: "email", Value: username }, { Name: "email_verified", Value: "true" }] }));
    userCreated = true;
    await provider.send(new AdminSetUserPasswordCommand({ UserPoolId: userPoolId, Username: username, Password: password, Permanent: true }));
    await provider.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: "Quizmasters" }));
    const signedIn = await signIn({ username, password });
    if (!signedIn.isSignedIn) throw new Error("Testanmeldung nicht abgeschlossen.");
    const idToken = (await fetchAuthSession()).tokens?.idToken;
    if (!idToken) throw new Error("ID-Token fehlt.");
    token = idToken.toString();
  }, 90_000);
  afterAll(async () => {
    try { if (userCreated) await provider.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username })); }
    finally { await signOut(); provider?.destroy(); identity?.destroy(); }
  }, 30_000);

  it("verarbeitet 100 Gastidentitäten und deren gleichzeitige Antworten", async () => {
    async function admin(query: string, variables: Record<string, unknown> = {}) {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", authorization: token },
        body: JSON.stringify({ query, variables }) });
      if (!response.ok) throw new Error(`Admin-API HTTP ${response.status}`);
      const payload = z.object({ data: z.record(z.string(), z.unknown()).optional(),
        errors: z.array(z.object({ message: z.string() })).optional() }).parse(await response.json());
      if (payload.errors?.length || !payload.data) throw new Error(payload.errors?.map((error) => error.message).join("; ") || "Admin-API ohne Daten.");
      return payload.data;
    }
    const quiz = z.object({ createQuiz: z.object({ quizId: z.string() }) }).parse(await admin(
      "mutation Create($quiz: QuizInput!) { createQuiz(quiz: $quiz) { quizId } }",
      { quiz: { title: "AppSync-Lasttest", description: "", questions: [{
        text: "Test?", durationSeconds: 120, explanation: "", answers: [{ text: "Ja", correct: true }, { text: "Nein", correct: false }],
      }] } })).createQuiz;
    const session = z.object({ createSession: z.object({ sessionId: z.string(), joinCode: z.string() }) }).parse(await admin(
      "mutation Create($quizId: ID!) { createSession(quizId: $quizId) { sessionId joinCode } }", { quizId: quiz.quizId })).createSession;
    const url = new URL(endpoint);
    const signers: SignatureV4[] = [];
    for (let batch = 0; batch < 10; batch++) {
      const prepared = await Promise.all(Array.from({ length: 10 }, async () => {
        const id = (await identity.send(new GetIdCommand({ IdentityPoolId: poolId }))).IdentityId;
        if (!id) throw new Error("Gastidentität fehlt.");
        const credentials = (await identity.send(new GetCredentialsForIdentityCommand({ IdentityId: id }))).Credentials;
        if (!credentials?.AccessKeyId || !credentials.SecretKey || !credentials.SessionToken) throw new Error("Gastzugangsdaten fehlen.");
        return new SignatureV4({ service: "appsync", region, sha256: Sha256, credentials: {
          accessKeyId: credentials.AccessKeyId, secretAccessKey: credentials.SecretKey, sessionToken: credentials.SessionToken,
        } });
      }));
      signers.push(...prepared);
    }
    async function guest(signer: SignatureV4, query: string, variables: Record<string, unknown>) {
      const body = JSON.stringify({ query, variables });
      const signed = await signer.sign(new HttpRequest({ protocol: url.protocol, hostname: url.hostname, path: url.pathname,
        method: "POST", headers: { host: url.host, "content-type": "application/json" }, body }));
      const response = await fetch(url, { method: "POST", headers: signed.headers, body });
      if (!response.ok) throw new Error(`Gast-API HTTP ${response.status}`);
      const payload = z.object({ data: z.record(z.string(), z.unknown()).optional(),
        errors: z.array(z.object({ message: z.string() })).optional() }).parse(await response.json());
      if (payload.errors?.length || !payload.data) throw new Error(payload.errors?.map((error) => error.message).join("; ") || "Gast-API ohne Daten.");
      return payload.data;
    }
    const beforeJoin = Date.now();
    const joined = await Promise.all(signers.map((signer) => guest(signer,
      "mutation Join($code: String!) { joinSession(joinCode: $code) { participantId } }", { code: session.joinCode })));
    const joinMs = Date.now() - beforeJoin;
    const participants = joined.map((data) => z.object({ joinSession: z.object({ participantId: z.string() }) }).parse(data).joinSession.participantId);
    expect(new Set(participants).size).toBe(100);
    const sockets: WebSocket[] = [];
    const latestVersions = new Array<number>(100).fill(-1);
    const socketErrors: string[] = [];
    async function subscribe(signer: SignatureV4, index: number) {
      const baseHeaders = { host: url.host, accept: "application/json, text/javascript",
        "content-encoding": "amz-1.0", "content-type": "application/json; charset=UTF-8" };
      async function sign(path: string, body: string) {
        return (await signer.sign(new HttpRequest({ protocol: url.protocol, hostname: url.hostname, path,
          method: "POST", headers: baseHeaders, body }))).headers;
      }
      const connectionHeaders = await sign(`${url.pathname}/connect`, "{}");
      const encoded = Buffer.from(JSON.stringify(connectionHeaders)).toString("base64url");
      const subscriptionData = JSON.stringify({
        query: "subscription Game($sessionId: ID!) { onGameChange(sessionId: $sessionId) { sessionId version } }",
        variables: { sessionId: session.sessionId },
      });
      const authorization = await sign(url.pathname, subscriptionData);
      const subscriptionId = randomUUID();
      const socket = new WebSocket(`wss://${url.hostname.replace(".appsync-api.", ".appsync-realtime-api.")}${url.pathname}`,
        ["graphql-ws", `header-${encoded}`]);
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => { settled = true; reject(new Error("Subscription-Zeitüberschreitung.")); }, 40_000);
        socket.addEventListener("open", () => socket.send(JSON.stringify({ type: "connection_init" })));
        socket.addEventListener("error", () => {
          if (!settled) { settled = true; clearTimeout(timer); reject(new Error("WebSocket-Verbindung fehlgeschlagen.")); }
          else socketErrors.push(`Verbindung ${index} fehlgeschlagen.`);
        });
        socket.addEventListener("message", (event) => {
          const wire = z.object({ type: z.string(), payload: z.unknown().optional() }).parse(JSON.parse(String(event.data)));
          if (wire.type === "connection_ack") socket.send(JSON.stringify({
            id: subscriptionId, type: "start", payload: { data: subscriptionData, extensions: { authorization } },
          }));
          if (wire.type === "start_ack" && !settled) { settled = true; clearTimeout(timer); resolve(); }
          if (wire.type === "error") {
            if (!settled) { settled = true; clearTimeout(timer); reject(new Error("Subscription wurde abgelehnt.")); }
            else socketErrors.push(`Subscription ${index} wurde abgelehnt.`);
          }
          if (wire.type === "data") {
            const parsed = z.object({ data: z.object({ onGameChange: z.object({ sessionId: z.string(), version: z.number() }) }) })
              .safeParse(wire.payload);
            if (!parsed.success || parsed.data.data.onGameChange.sessionId !== session.sessionId) {
              socketErrors.push(`Ungültiges Ereignis für Subscription ${index}.`);
            } else latestVersions[index] = Math.max(latestVersions[index], parsed.data.data.onGameChange.version);
          }
        });
      });
    }
    try {
      await Promise.all(signers.map(subscribe));
      const stateQuery = "query State($sessionId: ID!) { getAdminGameState(sessionId: $sessionId) { status version answerCount participantCount } }";
      const stateSchema = z.object({ getAdminGameState: z.object({ status: z.string(), version: z.number(),
        answerCount: z.number(), participantCount: z.number() }) });
      let state = stateSchema.parse(await admin(stateQuery, { sessionId: session.sessionId })).getAdminGameState;
      expect(state.participantCount).toBe(100);
      const questions = z.object({ listSessionQuestions: z.array(z.object({ questionId: z.string() })) }).parse(await admin(
        "query Questions($sessionId: ID!) { listSessionQuestions(sessionId: $sessionId) { questionId } }", { sessionId: session.sessionId }));
      const questionId = questions.listSessionQuestions[0]?.questionId;
      if (!questionId) throw new Error("Frage fehlt.");
      await admin("mutation Start($sessionId: ID!, $questionId: ID!, $version: Int!) { startQuestion(sessionId: $sessionId, questionId: $questionId, expectedVersion: $version) { version } }",
        { sessionId: session.sessionId, questionId, version: state.version });
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        state = stateSchema.parse(await admin(stateQuery, { sessionId: session.sessionId })).getAdminGameState;
        if (state.status === "QUESTION_OPEN") break;
      }
      expect(state.status).toBe("QUESTION_OPEN");
      const beforeAnswers = Date.now();
      await Promise.all(signers.map((signer, index) => guest(signer,
        "mutation Answer($sessionId: ID!, $questionId: ID!, $choiceId: ID!) { submitAnswer(sessionId: $sessionId, questionId: $questionId, choiceId: $choiceId) { acceptedAt } }",
        { sessionId: session.sessionId, questionId, choiceId: index % 2 ? "a1" : "a0" })));
      const answerMs = Date.now() - beforeAnswers;
      state = stateSchema.parse(await admin(stateQuery, { sessionId: session.sessionId })).getAdminGameState;
      expect(state.answerCount).toBe(100);
      const deadline = Date.now() + 60_000;
      while (latestVersions.some((version) => version < state.version) && Date.now() < deadline && !socketErrors.length) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      expect(socketErrors).toEqual([]);
      expect(latestVersions.filter((version) => version >= state.version)).toHaveLength(100);
      await admin("mutation Close($sessionId: ID!, $questionId: ID!, $version: Int!) { closeQuestion(sessionId: $sessionId, questionId: $questionId, expectedVersion: $version) { version } }",
        { sessionId: session.sessionId, questionId, version: state.version });
      state = stateSchema.parse(await admin(stateQuery, { sessionId: session.sessionId })).getAdminGameState;
      expect(state.status).toBe("REVEAL");
      console.info(`100 AppSync-Beitritte: ${joinMs} ms; 100 AppSync-Antworten: ${answerMs} ms`);
    } finally {
      for (const socket of sockets) socket.close();
    }
  }, 240_000);
});
