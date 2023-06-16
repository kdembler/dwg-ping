import { GetDistributorOperatorsQuery } from "./gql/graphql.js";

export type Operator =
  GetDistributorOperatorsQuery["distributionBucketOperators"][number];
export type OperatorAvailabilityResult = {
  time: Date;
  operatorId: string;
  distributionBucketId: string;
  workerId: number;
  nodeEndpoint: string;
} & (
  | {
      status: "ok";
      nodeStatus: DistributionOperatorStatus;
      opereatorMetadata: Operator["metadata"];
      chainHeadDiff?: number;
      blocksProcessedDiff?: number;
    }
  | {
      status: "degraded";
      nodeStatus: DistributionOperatorStatus;
      opereatorMetadata: Operator["metadata"];
      refChainHead: number;
      refBlocksProcessed: number;
    }
  | { status: "not-distributing" }
  | { status: "dead"; error: string }
);

export type DistributionOperatorQueryNodeStatus = {
  url: string;
  chainHead: number;
  blocksProcessed: number;
};

export type DistributionOperatorStatus = {
  id: string;
  version: string;
  objectsInCache: number;
  storageLimit: number;
  storageUsed: number;
  uptime: number;
  downloadsInProgress: number;
  queryNodeStatus: DistributionOperatorQueryNodeStatus;
};
