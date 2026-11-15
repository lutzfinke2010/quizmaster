import { defineBackend } from "@aws-amplify/backend";
import { ArnFormat, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Alarm, ComparisonOperator, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { AttributeType, BillingMode, ProjectionType, StreamViewType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { CfnGraphQLApi, CfnResolver } from "aws-cdk-lib/aws-appsync";
import { CfnWebACL, CfnWebACLAssociation } from "aws-cdk-lib/aws-wafv2";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource, SqsDlq } from "aws-cdk-lib/aws-lambda-event-sources";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { DefinitionBody, JsonPath, StateMachine, StateMachineType, TaskInput, Wait, WaitTime } from "aws-cdk-lib/aws-stepfunctions";
import { LambdaInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { auth } from "./auth/resource";
import { timerDispatch, timerStep, timerSweep } from "./functions/timer/resource";
import { gameApi } from "./functions/api/resource";
import { data } from "./data/resource";
import { eventPublisher, subscriptionAuth } from "./functions/events/resource";

const backend = defineBackend({ auth, data, gameApi, eventPublisher, subscriptionAuth, timerDispatch, timerStep, timerSweep });

backend.auth.resources.cfnResources.cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: false,
};

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
for (const fn of [backend.timerStep, backend.timerDispatch, backend.timerSweep, backend.gameApi, backend.subscriptionAuth]) {
  fn.addEnvironment("TABLE_NAME", table.tableName);
}
table.grantReadWriteData(stepFunction);
table.grantReadWriteData(dispatchFunction);
table.grantReadWriteData(sweepFunction);
table.grantReadWriteData(backend.gameApi.resources.lambda);
backend.gameApi.addEnvironment("IDENTITY_POOL_ID", backend.auth.resources.cfnResources.cfnIdentityPool.ref);
const maxParticipants = Number(process.env.QUIZRUSH_MAX_PARTICIPANTS ?? "100");
const retentionDays = Number(process.env.QUIZRUSH_RETENTION_DAYS ?? "7");
if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 1000 ||
    !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) {
  throw new Error("Invalid quiz participant limit or retention period.");
}
backend.gameApi.addEnvironment("MAX_PARTICIPANTS", String(maxParticipants));
backend.gameApi.addEnvironment("RETENTION_DAYS", String(retentionDays));
table.grantReadData(backend.subscriptionAuth.resources.lambda);
backend.subscriptionAuth.addEnvironment("IDENTITY_POOL_ID", backend.auth.resources.cfnResources.cfnIdentityPool.ref);

const api = backend.data.resources.graphqlApi;
const graphqlResources = Stack.of(api).node.findAll().filter((node): node is CfnGraphQLApi => node instanceof CfnGraphQLApi);
if (graphqlResources.length !== 1) throw new Error("GraphQL API was not synthesized as expected.");
const ipRateLimit = Number(process.env.QUIZRUSH_IP_RATE_LIMIT ?? "10000");
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
      ...["getMyParticipation", "getGameState", "getMyResult", "getMyAnswer", "getLeaderboard", "getPresentationState"]
        .map((field) => `${api.arn}/types/Query/fields/${field}`),
      ...["joinSession", "submitAnswer"].map((field) => `${api.arn}/types/Mutation/fields/${field}`),
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

const failedEvents = new Queue(stack, "FailedTimerEvents", { retentionPeriod: Duration.days(14) });
dispatchFunction.addEventSource(new DynamoEventSource(table, {
  startingPosition: StartingPosition.TRIM_HORIZON,
  batchSize: 10,
  bisectBatchOnError: true,
  retryAttempts: 5,
  onFailure: new SqsDlq(failedEvents),
}));
publisherFunction.addEventSource(new DynamoEventSource(table, {
  startingPosition: StartingPosition.TRIM_HORIZON,
  batchSize: 10,
  bisectBatchOnError: true,
  retryAttempts: 10,
  onFailure: new SqsDlq(failedEvents),
}));
new Alarm(stack, "TimerDispatchFailures", {
  metric: failedEvents.metricApproximateNumberOfMessagesVisible(),
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
