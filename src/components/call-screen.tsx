'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  MicOff,
  Phone,
  PhoneOff,
  Shield,
  Loader2,
  Plus,
} from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { getTwilioToken } from '@/app/actions';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useFirebase } from '@/firebase/provider';
import type { Device } from '@twilio/voice-sdk';

const formSchema = z.object({
  gender: z.enum(['hero', 'incognito', 'robot'], {
    required_error: 'You need to select a voice type.',
  }),
  phoneNumber: z.string().min(1, 'El número de teléfono es obligatorio.'),
});

type CallState = 'idle' | 'connecting' | 'on_call' | 'error';

export default function CallScreen() {
  const [isEffectOn, setIsEffectOn] = useState(true);
  const [callState, setCallState] = useState<CallState>('idle');
  const [callTime, setCallTime] = useState(0);

  const deviceRef = useRef<Device | null>(null);
  const { toast } = useToast();
  const { user } = useFirebase();
  const avatar = PlaceHolderImages.find((img) => img.id === 'avatar-1');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gender: 'hero',
      phoneNumber: '',
    },
  });

  const setupTwilioDevice = useCallback(async () => {
    try {
      const result = await getTwilioToken();
      if (result.error || !result.token) {
        toast({
          variant: 'destructive',
          title: 'Error de Twilio',
          description: result.error || 'No se pudo obtener el token de Twilio.',
        });
        setCallState('error');
        return;
      }
      
      const { Device } = await import('@twilio/voice-sdk');
      const device = new Device(result.token, {
        codecPreferences: ['opus', 'pcmu'],
      });

      device.on('error', (error) => {
        console.error('Twilio Device Error: ', error);
        setCallState('error');
      });

      device.on('disconnect', () => {
        setCallState('idle');
      });

      deviceRef.current = device;
    } catch (e: any) {
      console.error('Error al configurar Twilio: ', e);
      toast({
        variant: 'destructive',
        title: 'Error de Configuración',
        description: 'No se pudo inicializar el dispositivo de llamada.',
      });
      setCallState('error');
    }
  }, [toast]);

  useEffect(() => {
    setupTwilioDevice();
    return () => {
      deviceRef.current?.destroy();
    };
  }, [setupTwilioDevice]);


  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callState === 'on_call') {
      timer = setInterval(() => {
        setCallTime((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      setCallTime(0);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleCall = async (values: z.infer<typeof formSchema>) => {
    if (!deviceRef.current) {
        toast({ variant: 'destructive', title: 'Error', description: 'El dispositivo Twilio no está listo.' });
        return;
    }
    setCallState('connecting');
    try {
        const call = await deviceRef.current.connect({
            params: { To: values.phoneNumber },
        });
        call.on('accept', () => {
            setCallState('on_call');
        });
    } catch (error) {
        console.error('Error al realizar la llamada:', error);
        toast({ variant: 'destructive', title: 'Error de llamada', description: 'No se pudo iniciar la llamada.' });
        setCallState('idle');
    }
  };

  const handleHangup = () => {
    deviceRef.current?.disconnectAll();
  };

  const getActionButton = () => {
    if (callState === 'on_call') {
      return (
        <Button
          type="button"
          onClick={handleHangup}
          className="w-20 h-20 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          size="icon"
        >
          <PhoneOff className="h-8 w-8" />
        </Button>
      );
    }
    
    return (
      <Button
        type="submit"
        className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 text-white"
        disabled={callState === 'connecting' || !form.formState.isValid}
        size="icon"
      >
        {callState === 'connecting' ? <Loader2 className="h-8 w-8 animate-spin" /> : <Phone className="h-8 w-8" />}
      </Button>
    );
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
          <AvatarFallback>SC</AvatarFallback>
        </Avatar>
        <CardTitle className="text-3xl font-bold pt-4">SecureCall</CardTitle>
        <CardDescription className="text-lg text-accent h-7">
          {callState === 'on_call' ? formatTime(callTime) : (callState === 'connecting' ? 'Llamando...' : 'Listo para llamar')}
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
          <form onSubmit={form.handleSubmit(handleCall)} className="space-y-6">
            <fieldset
              disabled={callState === 'on_call' || callState === 'connecting'}
            >
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Teléfono</FormLabel>
                    <FormControl>
                      <div className="flex items-center">
                         <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm">+</span>
                         <Input type="tel" placeholder="123456789" {...field} className="rounded-l-none"/>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem className="space-y-3 mt-4">
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
              {getActionButton()}
              <p className="text-sm text-muted-foreground mt-2 h-4">
                {callState === 'idle' && 'Introduce un número y pulsa para llamar.'}
                {callState === 'connecting' && 'Estableciendo conexión...'}
                {callState === 'on_call' && 'Llamada en curso...'}
              </p>
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-4 bg-muted/50 p-4">
        <Button variant="ghost" className="flex-1" aria-label="Mute" disabled={callState !== 'on_call'}>
          <MicOff className="h-5 w-5 mr-2" />
          Mute
        </Button>
        <Button
          variant="ghost"
          className="flex-1"
          aria-label="Add person"
           disabled={callState !== 'on_call'}
        >
          <Plus className="h-5 w-5 mr-2" />
          Añadir
        </Button>
      </CardFooter>
    </Card>
  );
}
