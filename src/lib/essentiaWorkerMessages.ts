import type { Features } from './annPipeline';

export interface EssentiaFeatureExtractionReply {
  type: string;
  requestId?: string | null;
  songId?: string;
  features?: Features;
  error?: string;
}

export type EssentiaWorkerSendMessage =
  | { type: 'featureExtractionComplete'; songId: string; features: Features; requestId?: string }
  | { type: 'featureExtractionError'; songId: string; error: string; requestId?: string };

export function withEssentiaRequestId<T extends object>(message: T, requestId?: string): T & { requestId?: string } {
  return requestId ? { ...message, requestId } : message;
}

export function getEssentiaFeatureExtractionResult(
  message: EssentiaFeatureExtractionReply,
  expectedSongId: string
): Features {
  if (message.songId !== expectedSongId) {
    throw new Error(`Essentia reply songId mismatch: expected ${expectedSongId}, received ${message.songId ?? 'none'}.`);
  }
  if (!message.features || typeof message.features !== 'object') {
    throw new Error('Essentia feature extraction returned no features.');
  }
  return message.features;
}

export function getEssentiaFeatureExtractionError(message: EssentiaFeatureExtractionReply): string {
  return message.error ?? 'Essentia feature extraction failed.';
}
