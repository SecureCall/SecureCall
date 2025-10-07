'use server';

/**
 * @fileOverview A voice profile generation AI agent.
 *
 * - generateVoiceProfile - A function that handles the voice profile generation process.
 * - GenerateVoiceProfileInput - The input type for the generateVoiceProfile function.
 * - GenerateVoiceProfileOutput - The return type for the generateVoiceProfile function.
 */

import {ai} from '@/ai/genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';
import wav from 'wav';

const GenerateVoiceProfileInputSchema = z.object({
  gender: z
    .enum(['hero', 'incognito', 'robot'])
    .describe('The desired gender for the voice profile.'),
  text: z.string().describe('The audio to be transformed, as a data URI.'),
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
    let genderPrompt;
    switch (input.gender) {
      case 'hero':
        genderPrompt = 'a deep, heroic male voice';
        break;
      case 'robot':
        genderPrompt = 'a robotic voice';
        break;
      case 'incognito':
      default:
        genderPrompt = 'a neutral, anonymous-sounding voice';
        break;
    }

    const {media} = await ai.generate({
      model: googleAI.model('gemini-2.5-flash'),
      prompt: [
        {
          text: `Transform this voice into ${genderPrompt}. The output should only be the transformed audio.`,
        },
        {media: {url: input.text}},
      ],
      config: {
        responseModalities: ['AUDIO'],
        safetySettings: [
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
        ],
      },
    });

    if (!media) {
      throw new Error('No media returned from voice transformation');
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
