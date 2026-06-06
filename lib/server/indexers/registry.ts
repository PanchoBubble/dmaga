import { TorznabIndexerAdapter } from "@/lib/server/indexers/torznab";
import {
  IndexerError,
  type IndexerAdapter,
  type IndexerType,
} from "@/lib/server/indexers/types";

/**
 * Maps each {@link IndexerType} to its adapter. Definition-based
 * (Cardigann-style) indexers will register their adapter here once added; the
 * search layer always resolves adapters through {@link getIndexerAdapter} and
 * never instantiates them directly.
 */
const adapters: Record<IndexerType, IndexerAdapter> = {
  torznab: new TorznabIndexerAdapter(),
};

export function getIndexerAdapter(type: IndexerType): IndexerAdapter {
  const adapter = adapters[type];
  if (!adapter) {
    throw new IndexerError(`No indexer adapter registered for type "${type}".`);
  }
  return adapter;
}
