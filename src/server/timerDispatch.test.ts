import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DescribeExecutionCommand, SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { ensureTimerStarted } from "./timerDispatch";

const key = { sessionId: "session", questionId: "question", timerId: "timer" };
const arn = "arn:aws:states:eu-central-1:123456789012:stateMachine:QuizTimer";
const job = { ...key, pk: "SESSION#session", sk: "TIMER#question#timer", status: "PENDING",
  opensAt: 4001, closesAt: 9001, deadlineAt: new Date(10_000).toISOString(), attempt: 0 };
const database = mockClient(DynamoDBDocumentClient);
const workflow = mockClient(SFNClient);
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" }));
const sfn = new SFNClient({ region: "eu-central-1" });

describe("Timerdispatch", () => {
  beforeEach(() => { database.reset(); workflow.reset(); });

  it("startet einen Standard-Workflow mit stabiler Kennung und aufgerundeten Zeitpunkten", async () => {
    database.on(GetCommand).resolves({ Item: job });
    workflow.on(StartExecutionCommand).resolves({});
    await ensureTimerStarted(db, sfn, "table", arn, key);
    const input = workflow.commandCalls(StartExecutionCommand)[0].args[0].input;
    expect(input).toMatchObject({ name: "timer-0", stateMachineArn: arn });
    expect(JSON.parse(input.input ?? "")).toEqual({
      ...key, openAt: new Date(5000).toISOString(), deadlineAt: new Date(10_000).toISOString(),
    });
  });

  it("startet nach fehlgeschlagener Ausführung eine neue Version", async () => {
    database.on(GetCommand).resolvesOnce({ Item: job }).resolvesOnce({ Item: { ...job, attempt: 1 } });
    database.on(UpdateCommand).resolves({});
    const existing = Object.assign(new Error("exists"), { name: "ExecutionAlreadyExists" });
    workflow.on(StartExecutionCommand).rejectsOnce(existing).resolves({});
    workflow.on(DescribeExecutionCommand).resolves({ status: "FAILED" });
    await ensureTimerStarted(db, sfn, "table", arn, key);
    expect(workflow.commandCalls(DescribeExecutionCommand)[0].args[0].input).toMatchObject({
      executionArn: "arn:aws:states:eu-central-1:123456789012:execution:QuizTimer:timer-0",
    });
    expect(database.commandCalls(UpdateCommand)).toHaveLength(1);
    expect(workflow.commandCalls(StartExecutionCommand)[1].args[0].input).toMatchObject({ name: "timer-1" });
  });

  it("meldet unerwartete AWS-Fehler statt sie zu verschlucken", async () => {
    database.on(GetCommand).resolves({ Item: job });
    const error = new Error("AWS unavailable");
    workflow.on(StartExecutionCommand).rejects(error);
    await expect(ensureTimerStarted(db, sfn, "table", arn, key)).rejects.toBe(error);
  });
});
