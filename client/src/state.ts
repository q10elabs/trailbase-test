// Central state management for the TrailBase client application
// Manages shared application state including client instance and subscriptions

import { initClient, Client } from 'trailbase';
import { TRAILBASE_URL } from './config';

export let client: Client = initClient(TRAILBASE_URL);
export let subscriptionReader: ReadableStreamDefaultReader | null = null;
export let backgroundImageRecordId: number | null = null;
export let refreshIntervalId: number | null = null;

export function setClient(newClient: Client) {
  client = newClient;
}

export function setSubscriptionReader(reader: ReadableStreamDefaultReader | null) {
  subscriptionReader = reader;
}

export function setBackgroundImageRecordId(id: number | null) {
  backgroundImageRecordId = id;
}

export function setRefreshIntervalId(id: number | null) {
  refreshIntervalId = id;
}

export function getRefreshIntervalId(): number | null {
  return refreshIntervalId;
}

export function getSubscriptionReader(): ReadableStreamDefaultReader | null {
  return subscriptionReader;
}

export function getBackgroundImageRecordId(): number | null {
  return backgroundImageRecordId;
}
