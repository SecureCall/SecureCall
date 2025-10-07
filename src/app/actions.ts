'use server';

import {
  generateVoiceProfile,
  type GenerateVoiceProfileInput,
} from '@/ai/flows/generate-voice-profile';
import { initializeFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';


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
    // Provide a more helpful error message for deployment environments
    if (e.message?.includes('API key')) {
        return { error: 'Error de IA: La clave de API no está configurada en el servidor. Asegúrate de añadir la variable de entorno GEMINI_API_KEY en Vercel.' };
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
