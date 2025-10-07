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
    const {
      gender,
      voiceName,
      text, // This is now a data URI
    } = input;

    // For this example, we'll use a simple prompt instructing the model to "speak" the audio.
    // In a real scenario, you might have a more complex voice-to-voice model or flow.
    // Since we are still using a TTS model, we'll convert the intent of the audio to text and then generate speech.
    
    const whatIsSaid = await ai.generate({
      prompt: [
        {text: 'Listen to the following audio and transcribe what is being said. Output only the transcribed text.'},
        {media: {url: text}}
      ]
    });

    const voiceConfig: any = {};

    if (voiceName) {
      voiceConfig.prebuiltVoiceConfig = {voiceName};
    } else {
       // Simple logic to pick a voice based on gender
       if (gender === 'male') {
        voiceConfig.prebuiltVoiceConfig = { voiceName: 'en-US-Standard-D' };
      } else if (gender === 'female') {
        voiceConfig.prebuiltVoiceConfig = { voiceName: 'en-US-Standard-W' };
      }
    }

    const {media} = await ai.generate({
      model: 'googleai/gemini-2.5-flash-preview-tts',
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig,
        },
      },
      prompt: whatIsSaid.text,
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
