import { request as graphqlRequest } from "graphql-request";
import { getOperatorsDataQueryDocument } from "./query.js";
import { fetch } from "undici";
import { GetDistributorOperatorsQuery } from "./gql/graphql.js";
import {
  DistributionOperatorStatus,
  OperatorAvailabilityResult,
} from "./types.js";
import { getEsClient } from "./config.js";

const esClient = await getEsClient();
if (!esClient) {
  process.exit(1);
}

async function sendResults(results: OperatorAvailabilityResult[]) {
  const body = results.flatMap((result) => [
    { index: { _index: "distributors-status" } },
    result,
  ]);
  try {
    await esClient!.bulk({ body });
  } catch (e) {
    console.error("Failed to send results to Elasticsearch");
    console.error(e);
  }
}

async function runTest() {
  const operators = await getDistributionOperators();
  const results = await Promise.all(
    operators.map((operator) => getOperatorStatus(operator))
  );
  const resultsWithDegradations = await findOperatorDegradations(results);

  await sendResults(resultsWithDegradations);

  // console.log(JSON.stringify(resultsWithDegradations, null, 2));

  console.log("Sent the results to Elasticsearch");
}

async function getOperatorStatus(
  operator: GetDistributorOperatorsQuery["distributionBucketOperators"][0]
): Promise<OperatorAvailabilityResult> {
  const commonFields = {
    time: new Date(),
    operatorId: operator.id,
    distributionBucketId: operator.distributionBucket.id,
    workerId: operator.workerId,
    nodeEndpoint: operator?.metadata?.nodeEndpoint ?? "",
  };

  if (!operator.distributionBucket.distributing) {
    return { ...commonFields, status: "not-distributing" };
  }

  if (!operator?.metadata?.nodeEndpoint) {
    return { ...commonFields, status: "dead", error: "No node endpoint" };
  }
  const nodeStatus = await getDistributionOpearatorStatus(
    operator?.metadata?.nodeEndpoint
  );
  if (!nodeStatus) {
    return { ...commonFields, status: "dead", error: "Failed to fetch status" };
  }

  return {
    ...commonFields,
    status: "ok",
    nodeStatus,
    opereatorMetadata: operator.metadata,
  };
}

async function findOperatorDegradations(
  operatorsResults: OperatorAvailabilityResult[]
): Promise<OperatorAvailabilityResult[]> {
  const getMedian = (values: number[]) => {
    const sorted = values.sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted[middle];
  };

  const medianBlocksProcessed = getMedian(
    operatorsResults
      .filter((result) => result.status === "ok")
      .map(
        (result) =>
          ((result as any).nodeStatus as DistributionOperatorStatus)
            .queryNodeStatus.blocksProcessed
      )
  );

  const medianChainHead = getMedian(
    operatorsResults
      .filter((result) => result.status === "ok")
      .map(
        (result) =>
          ((result as any).nodeStatus as DistributionOperatorStatus)
            .queryNodeStatus.chainHead
      )
  );

  return operatorsResults.map((result) => {
    if (result.status !== "ok") {
      return result;
    }
    const qnStatus = result.nodeStatus.queryNodeStatus;
    const blocksProcessedDiff = Math.abs(
      qnStatus.blocksProcessed - medianBlocksProcessed
    );
    const chainHeadDiff = Math.abs(qnStatus.chainHead - medianChainHead);
    const THRESHOLD = 10;

    if (blocksProcessedDiff > THRESHOLD || chainHeadDiff > THRESHOLD) {
      return {
        ...result,
        status: "degraded",
        refBlocksProcessed: medianBlocksProcessed,
        refChainHead: medianChainHead,
      };
    }
    return {
      ...result,
      blocksProcessedDiff,
      chainHeadDiff,
    };
  });
}

async function getDistributionOperators() {
  const data = await graphqlRequest(
    "https://orion.joystream.org/graphql",
    getOperatorsDataQueryDocument
  );
  return data.distributionBucketOperators;
}

async function getDistributionOpearatorStatus(
  nodeEndpoint: string
): Promise<DistributionOperatorStatus | null> {
  try {
    const response = await fetch(`${nodeEndpoint}api/v1/status`);
    if (response.status !== 200) {
      console.error(
        `Failed to fetch status from ${nodeEndpoint}, status code: ${response.status}`
      );
      return null;
    }
    const json = await response.json();
    return json as DistributionOperatorStatus;
  } catch (error) {
    console.error(`Failed to fetch status from ${nodeEndpoint}`);
    console.error(error);
    return null;
  }
}

await runTest();
