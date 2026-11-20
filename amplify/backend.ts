import { defineBackend } from "@aws-amplify/backend";
import { ArnFormat, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Alarm, ComparisonOperator, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { AttributeType, BillingMode, ProjectionType, StreamViewType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { CfnGraphQLApi, CfnResolver } from "aws-cdk-lib/aws-appsync";
import { CfnWebACL, CfnWebACLAssociation } from "aws-cdk-lib/aws-wafv2";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource, SqsDlq } from "aws-cdk-lib/aws-lambda-event-sources";
import { Queue, QueueEncryption } from "aws-cdk-lib/aws-sqs";
import { DefinitionBody, JsonPath, StateMachine, StateMachineType, TaskInput, Wait, WaitTime } from "aws-cdk-lib/aws-stepfunctions";
import { LambdaInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { auth } from "./auth/resource";
import { timerDispatch, timerStep, timerSweep } from "./functions/timer/resource";
import { gameApi } from "./functions/api/resource";
import { quizGenerator } from "./functions/generator/resource";
import { data } from "./data/resource";
import { eventPublisher, subscriptionAuth } from "./functions/events/resource";

const backend = defineBackend({
  auth, data, gameApi, quizGenerator, eventPublisher, subscriptionAuth, timerDispatch, timerStep, timerSweep,
});

backend.auth.resources.cfnResources.cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: false,
};
const userPoolClient = backend.auth.resources.cfnResources.cfnUserPoolClient;
userPoolClient.accessTokenValidity = 60;
userPoolClient.idTokenValidity = 60;
userPoolClient.refreshTokenValidity = 1;
userPoolClient.tokenValidityUnits = { accessToken: "minutes", idToken: "minutes", refreshToken: "days" };

const stack = Stack.of(backend.timerStep.resources.lambda);
const table = new Table(stack, "GameTable", {
  partitionKey: { name: "pk", type: AttributeType.STRING },
  sortKey: { name: "sk", type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  stream: StreamViewType.NEW_IMAGE,
  timeToLiveAttribute: "ttl",
  removalPolicy: RemovalPolicy.RETAIN,
});
table.addGlobalSecondaryIndex({
  indexName: "pending-timers",
  partitionKey: { name: "timerPartition", type: AttributeType.STRING },
  sortKey: { name: "timerDeadline", type: AttributeType.STRING },
  projectionType: ProjectionType.INCLUDE,
  nonKeyAttributes: ["sessionId", "questionId", "timerId"],
});

const stepFunction = backend.timerStep.resources.lambda;
const dispatchFunction = backend.timerDispatch.resources.lambda;
const sweepFunction = backend.timerSweep.resources.lambda;
for (const fn of [backend.timerStep, backend.timerDispatch, backend.timerSweep, backend.gameApi, backend.subscriptionAuth,
  backend.quizGenerator]) {
  fn.addEnvironment("TABLE_NAME", table.tableName);
}
table.grantReadWriteData(stepFunction);
table.grantReadWriteData(dispatchFunction);
table.grantReadWriteData(sweepFunction);
table.grantReadWriteData(backend.gameApi.resources.lambda);
// KI-Quizgenerierung läuft asynchron in einer eigenen Lambda, weil AppSync Anfragen nach 30 Sekunden abbricht.
// Fehler vermerkt die Lambda selbst am Job; automatische Wiederholungen würden nur doppelte OpenAI-Kosten erzeugen.
const generatorFunction = backend.quizGenerator.resources.lambda;
table.grantReadWriteData(generatorFunction);
generatorFunction.configureAsyncInvoke({ retryAttempts: 0, maxEventAge: Duration.minutes(15) });
generatorFunction.grantInvoke(backend.gameApi.resources.lambda);
backend.gameApi.addEnvironment("QUIZ_GENERATOR_FUNCTION_NAME", generatorFunction.functionName);
backend.gameApi.addEnvironment("IDENTITY_POOL_ID", backend.auth.resources.cfnResources.cfnIdentityPool.ref);
const maxParticipants = Number(process.env.QUIZRUSH_MAX_PARTICIPANTS ?? "100");
const retentionDays = Number(process.env.QUIZRUSH_RETENTION_DAYS ?? "7");
const asyncRetentionDays = Number(process.env.QUIZRUSH_ASYNC_RETENTION_DAYS ?? "30");
if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 1000 ||
    !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365 ||
    !Number.isInteger(asyncRetentionDays) || asyncRetentionDays < 1 || asyncRetentionDays > 365) {
  throw new Error("Invalid quiz participant limit or retention period.");
}
backend.gameApi.addEnvironment("MAX_PARTICIPANTS", String(maxParticipants));
backend.gameApi.addEnvironment("RETENTION_DAYS", String(retentionDays));
backend.gameApi.addEnvironment("ASYNC_RETENTION_DAYS", String(asyncRetentionDays));
table.grantReadData(backend.subscriptionAuth.resources.lambda);
backend.subscriptionAuth.addEnvironment("IDENTITY_POOL_ID", backend.auth.resources.cfnResources.cfnIdentityPool.ref);

const api = backend.data.resources.graphqlApi;
const graphqlResources = Stack.of(api).node.findAll().filter((node): node is CfnGraphQLApi => node instanceof CfnGraphQLApi);
if (graphqlResources.length !== 1) throw new Error("GraphQL API was not synthesized as expected.");
// 2000 Anfragen je IP in 5 Minuten reichen für Spielende inkl. Polling/Reloads; größere Gruppen hinter einer
// gemeinsamen NAT-IP (Schulen, Firmen) können den Wert per QUIZRUSH_IP_RATE_LIMIT anheben.
const ipRateLimit = Number(process.env.QUIZRUSH_IP_RATE_LIMIT ?? "2000");
if (!Number.isInteger(ipRateLimit) || ipRateLimit < 10 || ipRateLimit > 2_000_000_000) {
  throw new Error("QUIZRUSH_IP_RATE_LIMIT must be an integer between 10 and 2000000000.");
}
const firewall = new CfnWebACL(Stack.of(api), "ApiFirewall", {
  scope: "REGIONAL",
  defaultAction: { allow: {} },
  visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: "QuizRushApiFirewall", sampledRequestsEnabled: false },
  rules: [{
    name: "LimitRequestsPerIp", priority: 0, action: { block: {} },
    statement: { rateBasedStatement: { aggregateKeyType: "IP", limit: ipRateLimit, evaluationWindowSec: 300 } },
    visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: "QuizRushIpRateLimit", sampledRequestsEnabled: false },
  }],
});
new CfnWebACLAssociation(Stack.of(api), "ApiFirewallAssociation", { resourceArn: api.arn, webAclArn: firewall.attrArn });
// Eigener WAF für den Cognito User Pool (Anmeldung/Selbstregistrierung): begrenzt Missbrauch über Kosten und
// E-Mail-Versand. Liegt im Auth-Stack, um zyklische Stack-Abhängigkeiten zu vermeiden. Hinweis: Cognito Identity
// Pools (GetId/GetCredentialsForIdentity) unterstützen keine WAF-Zuordnung; dort greifen nur AppSync-WAF und die
// Rate-Limits im Handler.
const authRateLimit = Number(process.env.QUIZRUSH_AUTH_RATE_LIMIT ?? "300");
if (!Number.isInteger(authRateLimit) || authRateLimit < 10 || authRateLimit > 2_000_000_000) {
  throw new Error("QUIZRUSH_AUTH_RATE_LIMIT must be an integer between 10 and 2000000000.");
}
const userPool = backend.auth.resources.cfnResources.cfnUserPool;
const authFirewall = new CfnWebACL(Stack.of(userPool), "AuthFirewall", {
  scope: "REGIONAL",
  defaultAction: { allow: {} },
  visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: "QuizRushAuthFirewall", sampledRequestsEnabled: false },
  rules: [{
    name: "LimitAuthRequestsPerIp", priority: 0, action: { block: {} },
    statement: { rateBasedStatement: { aggregateKeyType: "IP", limit: authRateLimit, evaluationWindowSec: 300 } },
    visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: "QuizRushAuthIpRateLimit", sampledRequestsEnabled: false },
  }],
});
new CfnWebACLAssociation(Stack.of(userPool), "AuthFirewallAssociation", { resourceArn: userPool.attrArn, webAclArn: authFirewall.attrArn });
const subscriptionResolvers = Stack.of(api).node.findAll().filter(
  (node): node is CfnResolver => node instanceof CfnResolver &&
    node.typeName === "Subscription" && node.fieldName === "onGameChange",
);
if (subscriptionResolvers.length !== 1) throw new Error("Subscription resolver was not synthesized as expected.");
subscriptionResolvers[0].responseMappingTemplateS3Location = undefined;
subscriptionResolvers[0].responseMappingTemplate = `
#if($ctx.error) $util.error($ctx.error.message, $ctx.error.type) #end
#if(!$ctx.prev.result || $ctx.prev.result.sessionId != $ctx.args.sessionId) $util.unauthorized() #end
#set($filter = {"sessionId": {"eq": $ctx.prev.result.sessionId}})
$extensions.setSubscriptionFilter($util.transform.toSubscriptionFilter($filter))
$util.toJson(null)
`;
const publishArn = `${api.arn}/types/Mutation/fields/publishGameEvent`;
const publisherFunction = backend.eventPublisher.resources.lambda;
backend.eventPublisher.addEnvironment(
  "GRAPHQL_ENDPOINT",
  graphqlResources[0].attrGraphQlUrl,
);
publisherFunction.addToRolePolicy(new PolicyStatement({ actions: ["appsync:GraphQL"], resources: [publishArn] }));
new Policy(Stack.of(api), "DenyClientPublish", {
  roles: [backend.auth.resources.unauthenticatedUserIamRole, backend.auth.resources.authenticatedUserIamRole,
    backend.auth.resources.groups.Quizmasters.role],
  statements: [new PolicyStatement({ effect: Effect.DENY, actions: ["appsync:GraphQL"], resources: [publishArn] })],
});
new Policy(Stack.of(api), "QuizmasterIdentityPoolAccess", {
  roles: [backend.auth.resources.groups.Quizmasters.role],
  statements: [new PolicyStatement({
    actions: ["appsync:GraphQL"],
    resources: [
      ...["getMyParticipation", "getGameState", "getMyResult", "getMyAnswer", "getLeaderboard", "getPresentationState",
        "getAsyncPublicInfo", "getMyAsyncState", "resolveJoinCode"]
        .map((field) => `${api.arn}/types/Query/fields/${field}`),
      ...["joinSession", "deleteMyParticipation", "submitAnswer", "startAsyncQuiz", "submitAsyncAnswer"]
        .map((field) => `${api.arn}/types/Mutation/fields/${field}`),
      `${api.arn}/types/Subscription/fields/onGameChange`,
    ],
  })],
});

function timerTask(id: string, action: "open" | "finalize") {
  const task = new LambdaInvoke(stack, id, {
    lambdaFunction: stepFunction,
    payload: TaskInput.fromObject({ action, timer: JsonPath.entirePayload }),
    outputPath: "$.Payload",
  });
  task.addRetry({ interval: Duration.seconds(2), backoffRate: 2, maxAttempts: 6 });
  return task;
}

const machine = new StateMachine(stack, "QuestionTimer", {
  stateMachineType: StateMachineType.STANDARD,
  timeout: Duration.minutes(15),
  definitionBody: DefinitionBody.fromChainable(new Wait(stack, "WaitForQuestion", { time: WaitTime.timestampPath("$.openAt") })
    .next(timerTask("OpenQuestion", "open"))
    .next(new Wait(stack, "WaitForDeadline", { time: WaitTime.timestampPath("$.deadlineAt") }))
    .next(timerTask("FinalizeQuestion", "finalize"))),
});

const executionArn = stack.formatArn({
  service: "states", resource: "execution", resourceName: `${machine.stateMachineName}:*`,
  arnFormat: ArnFormat.COLON_RESOURCE_NAME,
});
for (const fn of [backend.timerDispatch, backend.timerSweep]) {
  fn.addEnvironment("STATE_MACHINE_ARN", machine.stateMachineArn);
}
for (const fn of [dispatchFunction, sweepFunction]) {
  machine.grantStartExecution(fn);
  fn.addToRolePolicy(new PolicyStatement({ effect: Effect.ALLOW, actions: ["states:DescribeExecution"], resources: [executionArn] }));
}

const failedTimerEvents = new Queue(stack, "FailedTimerEvents", {
  retentionPeriod: Duration.days(14), encryption: QueueEncryption.SQS_MANAGED, enforceSSL: true,
});
const failedGameEvents = new Queue(stack, "FailedGameEvents", {
  retentionPeriod: Duration.days(14), encryption: QueueEncryption.SQS_MANAGED, enforceSSL: true,
});
dispatchFunction.addEventSource(new DynamoEventSource(table, {
  startingPosition: StartingPosition.TRIM_HORIZON,
  batchSize: 10,
  bisectBatchOnError: true,
  retryAttempts: 5,
  onFailure: new SqsDlq(failedTimerEvents),
}));
// startingPosition ist bei Event-Source-Mappings unveränderlich: Eine Änderung erzwingt einen Austausch, der für
// dieselbe Stream/Lambda-Kombination mit "mapping already exists" (409) scheitert. Daher bleibt TRIM_HORIZON.
// Das Batching-Fenster bündelt viele Antworten/Beitritte derselben Sitzung zu einem Event je Batch (siehe publisher.ts).
publisherFunction.addEventSource(new DynamoEventSource(table, {
  startingPosition: StartingPosition.TRIM_HORIZON,
  batchSize: 100,
  maxBatchingWindow: Duration.seconds(1),
  bisectBatchOnError: true,
  retryAttempts: 10,
  onFailure: new SqsDlq(failedGameEvents),
}));
new Alarm(stack, "TimerDispatchFailures", {
  metric: failedTimerEvents.metricApproximateNumberOfMessagesVisible(),
  threshold: 1, evaluationPeriods: 1, comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  treatMissingData: TreatMissingData.NOT_BREACHING,
});
new Alarm(stack, "GameEventPublishFailures", {
  metric: failedGameEvents.metricApproximateNumberOfMessagesVisible(),
  threshold: 1, evaluationPeriods: 1, comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  treatMissingData: TreatMissingData.NOT_BREACHING,
});
new Alarm(stack, "TimerSweepErrors", {
  metric: sweepFunction.metricErrors(), threshold: 1, evaluationPeriods: 1,
  comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  treatMissingData: TreatMissingData.NOT_BREACHING,
});
new Alarm(stack, "TimerWorkflowErrors", {
  metric: machine.metricFailed(), threshold: 1, evaluationPeriods: 1,
  comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  treatMissingData: TreatMissingData.NOT_BREACHING,
});
