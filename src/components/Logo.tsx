import Image from 'next/image';

export function Logo({ size = 40, className }: { size?: number, className?: string }) {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <Image
        src="/logo.png"
        alt="SecureCall Logo"
        width={size}
        height={size}
        style={{ width: '100%', height: 'auto' }}
        priority
      />
    </div>
  );
}
