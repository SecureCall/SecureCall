import CallScreen from '@/components/call-screen';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background font-body text-foreground">
      <header className="flex items-center justify-between p-4 border-b border-border shadow-sm">
        <div className="flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary h-7 w-7"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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
