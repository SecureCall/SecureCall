'use server';

import {
  generateVoiceProfile,
  type GenerateVoiceProfileInput,
} from '@/ai/flows/generate-voice-profile';
import { initializeFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AccessToken } from 'twilio/lib/jwt/AccessToken';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

const VoiceGrant = AccessToken.VoiceGrant;

export async function getTwilioToken() {
  // Access your Twilio Account SID and API Key credentials from environment variables
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioApiKey = process.env.TWILIO_API_KEY_SID;
  const twilioApiSecret = process.env.TWILIO_API_SECRET;
  const outgoingAppSid = process.env.TWILIO_APP_SID;
  const identity = `user_${uuidv4()}`; // A unique identity for the client

  if (!twilioAccountSid || !twilioApiKey || !twilioApiSecret || !outgoingAppSid) {
    return { error: 'Twilio environment variables are not configured.' };
  }

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: outgoingAppSid,
    incomingAllow: true, // Allow incoming calls
  });

  const token = new AccessToken(twilioAccountSid, twilioApiKey, twilioApiSecret, {
    identity: identity,
  });
  token.addGrant(voiceGrant);

  return { token: token.toJwt() };
}


const VoiceSchema = z.object({
  text: z.string(),
  gender: z.enum(['hero', 'incognito', 'robot']),
});

export async function getAlteredVoiceAction(
  input: GenerateVoiceProfileInput
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
  } catch (e: any) {
    console.error('AI Error:', e.message);
    if (e.message?.includes('API key')) {
        return { error: 'Error de IA: La clave de API no está configurada en el servidor. Asegúrate de añadir la variable de entorno GEMINI_API_KEY.' };
    }
    return { error: 'No se pudo generar la voz. Por favor, inténtalo de nuevo más tarde.' };
  }
}

const SaveVoiceProfileSchema = z.object({
    userId: z.string(),
    gender: z.string(),
    audioSrc: z.string(),
});

export async function saveVoiceProfileAction(
    input: z.infer<typeof SaveVoiceProfileSchema>
): Promise<{ success: boolean, profileName?: string, error?: string }> {
    const validatedFields = SaveVoiceProfileSchema.safeParse(input);

    if (!validatedFields.success) {
        return { success: false, error: "Invalid input." };
    }

    const { userId, gender, audioSrc } = validatedFields.data;
    
    try {
        const { firestore } = initializeFirebase();
        const voiceProfileId = uuidv4();
        const profileName = `Mi Voz ${gender}`;

        const newVoiceProfile = {
            id: voiceProfileId,
            userId: userId,
            name: profileName,
            isCustom: true,
            createdBy: userId,
            securityLevel: 'medium',
            audioDataUri: audioSrc,
        };

        const voiceDocRef = doc(
            firestore,
            `users/${userId}/voice_profiles/${voiceProfileId}`
        );

        await setDoc(voiceDocRef, newVoiceProfile, { merge: true });

        return { success: true, profileName };

    } catch (e: any) {
        console.error("Save Voice Error:", e);
        return { success: false, error: e.message || 'Failed to save voice profile.' };
    }
}