import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";

dotenv.config();

export const TEST_INTERVAL_MIN = process.env.TEST_INTERVAL_MIN ?? 5;

export async function getEsClient() {
  if (!process.env.ELASTICSEARCH_URL) {
    console.error("ELASTICSEARCH_URL not set");
    return null;
  }
  if (!process.env.ELASTICSEARCH_USERNAME) {
    console.error("ELASTICSEARCH_USERNAME not set");
    return null;
  }
  if (!process.env.ELASTICSEARCH_PASSWORD) {
    console.error("ELASTICSEARCH_PASSWORD not set");
    return null;
  }
  const esClient = new Client({
    node: process.env.ELASTICSEARCH_URL,
    auth: {
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD,
    },
  });
  try {
    if (!(await esClient.ping())) {
      console.error("Elasticsearch ping failed");
      return null;
    }
  } catch (e) {
    console.error("Failed to connect to Elasticsearch");
    console.error(e);
    return null;
  }

  return esClient;
}
