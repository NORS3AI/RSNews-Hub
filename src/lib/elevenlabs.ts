import { chunkForTts } from './articleSpeech';

// Thin ElevenLabs text-to-speech client. Reads config from env so the feature
// stays dormant (and safe) until a key + voice are set:
//   ELEVENLABS_API_KEY   — account API key
//   ELEVENLABS_VOICE_ID  — the voice to narrate with (pick one in your account)
//   ELEVENLABS_MODEL_ID  — optional; defaults to the cost-efficient turbo model
// Nothing here is called unless elevenLabsConfigured() is true.

const API = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_MODEL = 'eleven_turbo_v2_5';

export function elevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY && !!process.env.ELEVENLABS_VOICE_ID;
}

/** Synthesize spoken text to a single MP3 buffer. Long text is chunked at
 *  sentence boundaries and the returned MP3s are concatenated (MP3 frames join
 *  cleanly). Throws if not configured or if any chunk request fails. */
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) throw new Error('ElevenLabs is not configured (ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID)');
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL;

  const chunks = chunkForTts(text);
  if (!chunks.length) throw new Error('Nothing to synthesize');

  const parts: Buffer[] = [];
  for (const chunk of chunks) {
    const res = await fetch(`${API}/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: chunk, model_id: modelId, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 300)}`);
    }
    parts.push(Buffer.from(await res.arrayBuffer()));
  }
  return Buffer.concat(parts);
}
