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
  AlertCircle,
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
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

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
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { toast } = useToast();
  const { user, firestore } = useFirebase();

  const avatar = PlaceHolderImages.find((img) => img.id === 'avatar-1');

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop()); // We only need to request permission
      setHasMicPermission(true);
    } catch (error) {
      console.error('Microphone access was denied.', error);
      setHasMicPermission(false);
      toast({
        variant: 'destructive',
        title: 'Microphone Access Denied',
        description: 'Please enable microphone access in your browser settings to use this feature.',
      });
    }
  };
  
  useEffect(() => {
    // On initial load, check for permission status silently if possible
    navigator.permissions?.query({ name: 'microphone' }).then(permissionStatus => {
      if (permissionStatus.state === 'granted') {
        setHasMicPermission(true);
      } else if (permissionStatus.state === 'denied') {
        setHasMicPermission(false);
      } else {
        setHasMicPermission(null); // Prompt needed
      }
      permissionStatus.onchange = () => {
        setHasMicPermission(permissionStatus.state === 'granted');
      };
    }).catch(() => {
      // Fallback for browsers that don't support Permissions API
      setHasMicPermission(null);
    });
  }, []);
  
  useEffect(() => {
    if (hasMicPermission) {
      const timer = setInterval(() => {
        setCallTime((prevTime) => prevTime + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [hasMicPermission]);

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
      audioDataUri: audioSrc,
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
  
  const startRecording = () => {
    if (!hasMicPermission) {
      toast({
        variant: 'destructive',
        title: 'Error de Micrófono',
        description: 'No se puede grabar sin acceso al micrófono. Por favor, comprueba los permisos.',
      });
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
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
           stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
        setRecordingState('recording');
      })
      .catch((error) => {
        console.error('Microphone access error:', error);
        toast({
          variant: 'destructive',
          title: 'Error de Micrófono',
          description:
            'No se pudo acceder al micrófono. Por favor, comprueba los permisos.',
        });
      });
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
      setAudioSrc(null);
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

  if (hasMicPermission === null || hasMicPermission === false) {
    return (
      <Card className="w-full max-w-md mx-auto rounded-3xl shadow-2xl overflow-hidden border-4 border-card text-center">
        <CardHeader>
          <div className="flex justify-center">
             <MicOff size={48} className="text-destructive" />
          </div>
          <CardTitle className="text-2xl pt-4">Micrófono No Disponible</CardTitle>
          <CardDescription>
            Para modificar tu voz, SecureCall necesita acceso al micrófono.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg text-left space-y-4">
              <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mr-3">1</div>
                  <p className="text-sm">Haz clic en "Permitir Micrófono" para activar la protección.</p>
              </div>
              <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mr-3">2</div>
                  <p className="text-sm">Selecciona "Permitir" en la ventana que aparecerá en tu navegador.</p>
              </div>
          </div>
           {hasMicPermission === false && (
             <Alert variant="destructive" className="mt-4">
               <AlertCircle className="h-4 w-4" />
                <AlertTitle>Acceso Denegado</AlertTitle>
                <AlertDescription>
                  Debes habilitar el permiso del micrófono en la configuración de tu navegador para continuar.
                </AlertDescription>
            </Alert>
           )}
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button onClick={requestMicrophonePermission} className="w-full" size="lg">
            <Mic className="mr-2 h-5 w-5" />
            Permitir Micrófono
          </Button>
           <p className="text-xs text-muted-foreground">Tu privacidad es importante. Solo accedemos al micrófono cuando grabas.</p>
        </CardFooter>
      </Card>
    );
  }


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
