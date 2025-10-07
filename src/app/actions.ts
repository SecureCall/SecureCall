'use server';

import {
  generateVoiceProfile,
  type GenerateVoiceProfileInput,
} from '@/ai/flows/generate-voice-profile';
import { z } from 'zod';

const VoiceSchema = z.object({
  text: z.string(), // This is now a data URI
  gender: z.enum(['hero', 'incognito', 'robot']),
});

export async function getAlteredVoiceAction(
  input: GenerateVoiceProfileInput & { text: string }
): Promise<{ audioDataUri?: string; error?: string }> {
  const validatedFields = VoiceSchema.safeParse(input);

  if (!validatedFields.success) {
    const errorMessages = validatedFields.error.errors
      .map((e) => e.message)
      .join(' ');
    return { error: errorMessages };
  }

  try {
    const result = await generateVoiceProfile(validatedFields.data);
    return { audioDataUri: result.audioDataUri };
  } catch (e) {
    console.error('AI Error:', e);
    return { error: 'Failed to generate voice. Please try again later.' };
  }
}
