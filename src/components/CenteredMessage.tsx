interface CenteredMessageProps {
  children: React.ReactNode;
  className?: string;
}

export function CenteredMessage({ children, className = "min-h-screen" }: CenteredMessageProps) {
  return <div className={`grid place-items-center ${className}`}>{children}</div>;
}
