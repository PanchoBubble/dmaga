import { CardigannIndexerAdapter } from "@/lib/server/indexers/cardigann";
import { TorznabIndexerAdapter } from "@/lib/server/indexers/torznab";
import {
  IndexerError,
  type IndexerAdapter,
  type IndexerType,
} from "@/lib/server/indexers/types";

/**
 * Maps each {@link IndexerType} to its adapter. The search layer always
 * resolves adapters through {@link getIndexerAdapter} and never instantiates
 * them directly.
 */
const adapters: Record<IndexerType, IndexerAdapter> = {
  cardigann: new CardigannIndexerAdapter(),
  torznab: new TorznabIndexerAdapter(),
};

export function getIndexerAdapter(type: IndexerType): IndexerAdapter {
  const adapter = adapters[type];
  if (!adapter) {
    throw new IndexerError(`No indexer adapter registered for type "${type}".`);
  }
  return adapter;
}
