'use server';

/**
 * @fileOverview A voice profile generation AI agent.
 *
 * - generateVoiceProfile - A function that handles the voice profile generation process.
 * - GenerateVoiceProfileInput - The input type for the generateVoiceProfile function.
 * - GenerateVoiceProfileOutput - The return type for the generateVoiceProfile function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import wav from 'wav';

const GenerateVoiceProfileInputSchema = z.object({
  gender: z
    .enum(['male', 'female', 'custom'])
    .describe('The desired gender for the voice profile.'),
  voiceName: z.string().optional().describe('The specific voice name to use (optional).'),
  text: z.string().describe('The text to be spoken in the generated voice.'),
});

export type GenerateVoiceProfileInput = z.infer<typeof GenerateVoiceProfileInputSchema>;

const GenerateVoiceProfileOutputSchema = z.object({
  audioDataUri: z.string().describe('The generated voice profile as a data URI.'),
});

export type GenerateVoiceProfileOutput = z.infer<typeof GenerateVoiceProfileOutputSchema>;

export async function generateVoiceProfile(
  input: GenerateVoiceProfileInput
): Promise<GenerateVoiceProfileOutput> {
  return generateVoiceProfileFlow(input);
}

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    let bufs = [] as any[];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

const generateVoiceProfileFlow = ai.defineFlow(
  {
    name: 'generateVoiceProfileFlow',
    inputSchema: GenerateVoiceProfileInputSchema,
    outputSchema: GenerateVoiceProfileOutputSchema,
  },
  async input => {
    const {
      gender,
      voiceName,
      text,
    } = input;

    const voiceConfig: any = {};

    if (voiceName) {
      voiceConfig.prebuiltVoiceConfig = {voiceName};
    }

    const {media} = await ai.generate({
      model: 'googleai/gemini-2.5-flash-preview-tts',
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig,
        },
      },
      prompt: text,
    });

    if (!media) {
      throw new Error('No media returned');
    }

    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );

    return {
      audioDataUri: 'data:audio/wav;base64,' + (await toWav(audioBuffer)),
    };
  }
);
