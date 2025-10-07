import CallScreen from '@/components/call-screen';
import { Logo } from '@/components/Logo';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background font-body text-foreground">
      <header className="flex items-center justify-between p-4 border-b border-border shadow-sm">
        <div className="flex items-center gap-3">
          <Logo />
          <h1 className="text-xl md:text-2xl font-bold text-primary font-headline tracking-tight">
            SecureCall
          </h1>
        </div>
      </header>
      <main className="flex-1 w-full flex items-center justify-center p-4 md:p-8">
        <CallScreen />
      </main>
      <footer className="text-center p-4 text-xs text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} SecureCall. Tu voz real, solo para
          quienes tú quieras.
        </p>
      </footer>
    </div>
  );
}
