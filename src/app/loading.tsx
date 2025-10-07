import { Logo } from '@/components/Logo';

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Logo size={60} />
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading SecureCall...</p>
        </div>
      </div>
    </div>
  );
}
