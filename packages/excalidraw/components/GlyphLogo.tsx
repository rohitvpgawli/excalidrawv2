import "./ExcalidrawLogo.scss";

const GlyphLogoIcon = () => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="ExcalidrawLogo-icon"
  >
    <rect
      x="4"
      y="4"
      width="32"
      height="32"
      rx="8"
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
    />
    <path
      d="M12 20h16M20 12v16"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

const GlyphLogoText = () => (
  <svg
    viewBox="0 0 120 32"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    className="ExcalidrawLogo-text"
  >
    <text
      x="0"
      y="24"
      fill="currentColor"
      fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      fontSize="26"
      fontWeight="600"
      letterSpacing="-0.02em"
    >
      Glyph
    </text>
  </svg>
);

type LogoSize = "xs" | "small" | "normal" | "large" | "custom" | "mobile";

interface LogoProps {
  size?: LogoSize;
  withText?: boolean;
  style?: React.CSSProperties;
  isNotLink?: boolean;
}

export const GlyphLogo = ({
  style,
  size = "small",
  withText,
}: LogoProps) => {
  return (
    <div className={`ExcalidrawLogo is-${size}`} style={style}>
      <GlyphLogoIcon />
      {withText && <GlyphLogoText />}
    </div>
  );
};
