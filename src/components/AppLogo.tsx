const FALLBACK_SRC =
  "https://e-crimebureau.com/wp-content/uploads/2025/10/cropped-APPROVED-NEW-LOGO.png";

interface AppLogoProps {
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function AppLogo({
  alt = "Atrium",
  className = "h-full w-auto object-contain",
  style,
}: AppLogoProps) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      className={className}
      style={style}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.src = FALLBACK_SRC;
      }}
    />
  );
}
