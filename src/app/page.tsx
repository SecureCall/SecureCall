import CallScreen from '@/components/call-screen';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background font-body text-foreground">
      <header className="flex items-center justify-between p-4 border-b border-border shadow-sm">
        <div className="flex items-center gap-3">
          <svg
            width="32"
            height="32"
            viewBox="0 0 100 100"
            className="text-primary"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M50 10 L90 30 L90 70 L50 90 L10 70 L10 30 Z"
              opacity="0.9"
            />
            <circle cx="50" cy="45" r="15" fill="white" />
            <path
              d="M50 60 L50 75 M45 75 L55 75"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
            />
             <path
              d="M35 45 Q40 35 45 45 T55 45 T65 45"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
             />
          </svg>
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
