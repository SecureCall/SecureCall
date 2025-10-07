'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Save,
  Shield,
  Square,
  Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { getAlteredVoiceAction } from '@/app/actions';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useFirebase } from '@/firebase/provider';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc } from 'firebase/firestore';

const formSchema = z.object({
  gender: z.enum(['hero', 'incognito', 'robot'], {
    required_error: 'You need to select a voice type.',
  }),
});

type RecordingState = 'idle' | 'recording' | 'playing' | 'loading' | 'saved';

export default function CallScreen() {
  const [isEffectOn, setIsEffectOn] = useState(true);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [callTime, setCallTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { toast } = useToast();
  const { user, firestore } = useFirebase();

  const avatar = PlaceHolderImages.find((img) => img.id === 'avatar-1');

  useEffect(() => {
    const timer = setInterval(() => {
      setCallTime((prevTime) => prevTime + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gender: 'hero',
    },
  });

  const resetState = () => {
    setRecordingState('idle');
    setAudioSrc(null);
  };

  const handleSaveVoice = () => {
    if (!user || !firestore || !audioSrc) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          'No se pudo guardar el perfil de voz. Inténtalo de nuevo.',
      });
      return;
    }

    const voiceProfileId = uuidv4();
    const profileName = `Mi Voz ${form.getValues('gender')}`;
    const newVoiceProfile = {
      id: voiceProfileId,
      userId: user.uid,
      name: profileName,
      isCustom: true,
      createdBy: user.uid,
      securityLevel: 'medium',
      audioDataUri: audioSrc, // Saving the generated audio
    };

    const voiceDocRef = doc(
      firestore,
      `users/${user.uid}/voice_profiles/${voiceProfileId}`
    );

    setDocumentNonBlocking(voiceDocRef, newVoiceProfile, { merge: true });

    toast({
      title: 'Voz Guardada',
      description: `El perfil de voz "${profileName}" ha sido guardado.`,
    });
    setRecordingState('saved');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setRecordingState('loading');
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/wav',
        });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          const values = form.getValues();
          const result = await getAlteredVoiceAction({
            ...values,
            text: base64Audio,
          });

          if (result.error) {
            toast({
              variant: 'destructive',
              title: 'Error',
              description: result.error,
            });
            resetState();
          } else if (result.audioDataUri) {
            setAudioSrc(result.audioDataUri);
            toast({
              title: '¡Éxito!',
              description: 'Tu voz alterada ha sido generada.',
            });
            setRecordingState('playing');
          }
        };
      };

      mediaRecorderRef.current.start();
      setRecordingState('recording');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error de Micrófono',
        description:
          'No se pudo acceder al micrófono. Por favor, comprueba los permisos.',
      });
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    if (recordingState === 'playing' && audioSrc && audioRef.current) {
      audioRef.current.load();
      audioRef.current.play().catch((e) => {
        toast({
          variant: 'destructive',
          title: 'Error de Reproducción',
          description: 'No se pudo reproducir el audio.',
        });
        console.error('Audio play failed', e);
      });
      audioRef.current.onended = () => setRecordingState('idle');
    }
  }, [recordingState, audioSrc, toast]);

  const handleMicButtonClick = () => {
    if (recordingState === 'idle' || recordingState === 'saved') {
      setAudioSrc(null); // Clear previous audio
      startRecording();
    } else if (recordingState === 'recording') {
      stopRecording();
    }
  };

  const getRecordButtonIcon = () => {
    switch (recordingState) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin" />;
      case 'recording':
        return <Square className="h-8 w-8" />;
      case 'playing':
        return <Volume2 className="h-8 w-8" />;
      case 'idle':
      case 'saved':
      default:
        return <Mic className="h-8 w-8" />;
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto rounded-3xl shadow-2xl overflow-hidden border-4 border-card">
      <CardHeader className="items-center text-center pt-8">
        <Avatar className="w-24 h-24 border-4 border-muted">
          {avatar && (
            <AvatarImage
              src={avatar.imageUrl}
              alt={avatar.description}
              data-ai-hint={avatar.imageHint}
            />
          )}
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <CardTitle className="text-3xl font-bold pt-4">Jane Doe</CardTitle>
        <CardDescription className="text-lg text-accent">
          {formatTime(callTime)}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex items-center justify-center space-x-3 mb-6 p-3 rounded-lg bg-muted/50">
          <Shield className="text-accent h-5 w-5" />
          <Label htmlFor="effect-switch" className="font-medium">
            Protección {isEffectOn ? 'Activa' : 'Inactiva'}
          </Label>
          <Switch
            id="effect-switch"
            checked={isEffectOn}
            onCheckedChange={setIsEffectOn}
            aria-label="Toggle voice alteration effect"
          />
        </div>

        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            <fieldset disabled={!isEffectOn || (recordingState !== 'idle' && recordingState !== 'saved') }>
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Perfiles de Voz</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-3 gap-4"
                      >
                        <FormItem>
                          <RadioGroupItem
                            value="hero"
                            id="hero"
                            className="sr-only"
                          />
                          <Label
                            htmlFor="hero"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            🦸 Héroe
                          </Label>
                        </FormItem>
                        <FormItem>
                          <RadioGroupItem
                            value="incognito"
                            id="incognito"
                            className="sr-only"
                          />
                          <Label
                            htmlFor="incognito"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            🎭 Incógnito
                          </Label>
                        </FormItem>
                        <FormItem>
                          <RadioGroupItem
                            value="robot"
                            id="robot"
                            className="sr-only"
                          />
                          <Label
                            htmlFor="robot"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            🤖 Robot
                          </Label>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>

            <div className="pt-2 flex flex-col items-center">
              <Button
                type="button"
                onClick={handleMicButtonClick}
                className="w-20 h-20 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg"
                disabled={
                  !isEffectOn ||
                  recordingState === 'playing' ||
                  recordingState === 'loading'
                }
                size="icon"
              >
                {getRecordButtonIcon()}
              </Button>
              <p className="text-sm text-muted-foreground mt-2 h-4">
                {recordingState === 'recording' && 'Grabando... pulsa para parar.'}
                {(recordingState === 'idle' || recordingState === 'saved') && 'Pulsa para grabar y probar un perfil.'}
                {recordingState === 'loading' && 'Procesando...'}
                {recordingState === 'playing' && 'Reproduciendo voz alterada.'}
              </p>
            </div>
          </form>
        </Form>
        {audioSrc && (
          <div className="mt-4 flex flex-col items-center gap-4">
            <audio
              ref={audioRef}
              controls
              className="w-full hidden"
              src={audioSrc}
            >
              Your browser does not support the audio element.
            </audio>
            {recordingState !== 'recording' && recordingState !== 'loading' && (
              <Button onClick={handleSaveVoice} disabled={!user || recordingState === 'saved'}>
                <Save className="mr-2 h-4 w-4" />
                {recordingState === 'saved' ? '¡Voz Guardada!' : 'Guardar Voz'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-4 bg-muted/50 p-4">
        <Button variant="ghost" className="flex-1" aria-label="Mute">
          <MicOff className="h-5 w-5 mr-2" />
          Mute
        </Button>
        <Button
          variant="destructive"
          className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
          aria-label="End call"
        >
          <AlertTriangle className="h-5 w-5 mr-2" />
          DESCONEXIÓN
        </Button>
      </CardFooter>
    </Card>
  );
}
