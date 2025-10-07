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
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M7 8v2a5 5 0 0 0 5 5v0a5 5 0 0 0 5-5V8" />
            <path d="M12 18v-3" />
          </svg>
          <h1 className="text-xl md:text-2xl font-bold text-primary font-headline tracking-tight">
            Secure Call
          </h1>
        </div>
      </header>
      <main className="flex-1 w-full flex items-center justify-center p-4 md:p-8">
        <CallScreen />
      </main>
      <footer className="text-center p-4 text-xs text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} Secure Call. Protect your voice,
          protect your privacy.
        </p>
      </footer>
    </div>
  );
}
