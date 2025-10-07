'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Mic,
  MicOff,
  PhoneOff,
  Save,
  Shield,
  Square,
  Volume2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { getAlteredVoiceAction, saveVoiceProfileAction } from '@/app/actions';
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
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const formSchema = z.object({
  gender: z.enum(['hero', 'incognito', 'robot'], {
    required_error: 'You need to select a voice type.',
  }),
});

type RecordingState = 'idle' | 'recording' | 'playing' | 'loading' | 'saved';
type PermissionState = 'prompt' | 'granted' | 'denied' | 'not_found';

const SAMPLE_TEXT = "Hello, this is a test of the SecureCall voice alteration system. Your privacy is our priority.";


export default function CallScreen() {
  const [isEffectOn, setIsEffectOn] = useState(true);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [callTime, setCallTime] = useState(0);
  const [permissionState, setPermissionState] =
    useState<PermissionState>('prompt');
  
  const [isSaving, setIsSaving] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { toast } = useToast();
  const { user } = useFirebase();

  const avatar = PlaceHolderImages.find((img) => img.id === 'avatar-1');

  const requestMicrophonePermission = async () => {
    // On server, navigator is not available.
    if (typeof navigator === 'undefined') {
      setPermissionState('not_found');
      return;
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionState('not_found');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionState('granted');
    } catch (error: any) {
        if (error.name === 'NotFoundError') {
            setPermissionState('not_found');
        } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            setPermissionState('denied');
        } else {
            console.error('Microphone access error:', error.name, error.message);
            setPermissionState('denied'); 
        }
    }
  };

  useEffect(() => {
    requestMicrophonePermission();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    timer = setInterval(() => {
        setCallTime((prevTime) => prevTime + 1);
    }, 1000);
    
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
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

  const handleSaveVoice = async () => {
    if (!user || !audioSrc) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar el perfil de voz. Inténtalo de nuevo.',
      });
      return;
    }
    setIsSaving(true);
    setRecordingState('loading');
  
    const result = await saveVoiceProfileAction({
      userId: user.uid,
      gender: form.getValues('gender'),
      audioSrc: audioSrc,
    });
  
    setIsSaving(false);
  
    if (result.success && result.profileName) {
      toast({
        title: 'Voz Guardada',
        description: `El perfil de voz "${result.profileName}" ha sido guardado.`,
      });
      setRecordingState('saved');
    } else {
      toast({
        variant: 'destructive',
        title: 'Error al Guardar',
        description: result.error || 'No se pudo guardar el perfil de voz.',
      });
      setRecordingState('playing'); // Revert to a state where they can try again
    }
  };
  
  
  const simulateRecordingAndAlteration = async () => {
    setRecordingState('loading');
    
    if (permissionState === 'granted') {
       toast({
        title: 'Grabación en curso...',
        description: 'En un entorno real, estaríamos grabando tu voz.',
      });
    } else {
       toast({
        title: 'Simulación de Grabación',
        description: 'Usando texto de muestra para generar voz alterada...',
      });
    }


    const values = form.getValues();
    const result = await getAlteredVoiceAction({
      ...values,
      text: SAMPLE_TEXT,
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

  const startRecording = async () => {
    if (permissionState !== 'granted') {
       await simulateRecordingAndAlteration();
       return;
    }
      
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setRecordingState('loading');
        await simulateRecordingAndAlteration();
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setRecordingState('recording');
    } catch (error) {
      console.error('Microphone access error:', error);
      toast({
        variant: 'destructive',
        title: 'Error Inesperado',
        description:
          'Ocurrió un error al intentar iniciar la grabación.',
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

  if (permissionState === 'denied' || permissionState === 'prompt' || (permissionState === 'not_found' && typeof navigator !== 'undefined')) {
    return (
      <Card className="w-full max-w-md mx-auto rounded-3xl shadow-2xl overflow-hidden border-4 border-card text-center">
        <CardHeader>
          <div className="flex justify-center">
            <MicOff size={48} className="text-destructive" />
          </div>
          <CardTitle className="text-2xl pt-4">Micrófono Requerido</CardTitle>
           {permissionState !== 'not_found' && (
            <CardDescription>
              Para modificar tu voz, SecureCall necesita acceso al micrófono.
            </CardDescription>
           )}
        </CardHeader>
        <CardContent>
          {permissionState === 'not_found' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Micrófono no encontrado</AlertTitle>
              <AlertDescription>
                No hemos podido detectar ningún micrófono. Asegúrate de que uno esté conectado y habilitado.
              </AlertDescription>
            </Alert>
          )}
          {permissionState === 'denied' && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Acceso Denegado</AlertTitle>
              <AlertDescription>
                Debes habilitar el permiso del micrófono en la configuración de
                tu navegador para continuar.
              </AlertDescription>
            </Alert>
          )}
          {permissionState === 'prompt' && (
            <div className="bg-muted p-4 rounded-lg text-left space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mr-3">
                  1
                </div>
                <p className="text-sm">
                  Haz clic en "Permitir Micrófono" para activar la protección.
                </p>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center mr-3">
                  2
                </div>
                <p className="text-sm">
                  Selecciona "Permitir" en la ventana que aparecerá en tu
                  navegador.
                </p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button
            onClick={requestMicrophonePermission}
            className="w-full"
            size="lg"
            disabled={permissionState === 'not_found'}
          >
            <Mic className="mr-2 h-5 w-5" />
            Permitir Micrófono
          </Button>
          <p className="text-xs text-muted-foreground">
            Tu privacidad es importante. Solo accedemos al micrófono cuando grabas.
          </p>
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
        {permissionState === 'not_found' && (
             <Alert variant="destructive" className="mt-4 mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No se encontró micrófono</AlertTitle>
                <AlertDescription>
                  Se usará audio de muestra para las pruebas.
                </AlertDescription>
              </Alert>
        )}
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
            <fieldset
              disabled={
                !isEffectOn ||
                (recordingState !== 'idle' && recordingState !== 'saved')
              }
            >
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
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
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
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
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
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
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
                {recordingState === 'recording' &&
                  'Grabando... pulsa para parar.'}
                {(recordingState === 'idle' || recordingState === 'saved') &&
                  'Pulsa para grabar y probar un perfil.'}
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
            {recordingState !== 'recording' &&
              recordingState !== 'loading' && (
                <Button
                  onClick={handleSaveVoice}
                  disabled={!user || recordingState === 'saved' || isSaving}
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {recordingState === 'saved'
                    ? '¡Voz Guardada!'
                    : 'Guardar Voz'}
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
          className="flex-1 font-bold"
          aria-label="End call"
        >
          <PhoneOff className="h-5 w-5 mr-2" />
          Finalizar
        </Button>
      </CardFooter>
    </Card>
  );
}
