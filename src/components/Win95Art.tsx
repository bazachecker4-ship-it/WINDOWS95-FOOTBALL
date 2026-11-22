import React from "react";
import { HairStyle, JERSEY_THEME_STYLES, PlayerRole, RoleAppearance, Team } from "../types/game";

const SKIN_TONES = [
  { base: "#f3c19d", shade: "#cf936e", hair: "#3d2516" },
  { base: "#e2a87e", shade: "#b87a52", hair: "#1f1b18" },
  { base: "#b7774e", shade: "#8d5431", hair: "#111827" },
  { base: "#78462e", shade: "#522b1a", hair: "#090d16" },
];

export const PixelClubCrest: React.FC<{
  team: Team;
  label?: string;
  className?: string;
}> = ({ team, label, className = "w-8 h-9" }) => {
  const isBlue = team === "blue";
  const primary = isBlue ? "#ffffff" : "#dc2626";
  const secondary = isBlue ? "#1d4ed8" : "#1e3a8a";
  const trim = isBlue ? "#facc15" : "#fbbf24";
  const text = (label || (isBlue ? "ФК" : "ИИ")).slice(0, 3).toUpperCase();

  return (
    <svg
      viewBox="0 0 24 26"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {/* Gold Crown / Top */}
      <rect x="7" y="1" width="10" height="2" fill={trim} />
      <rect x="6" y="2" width="12" height="1" fill="#92400e" />
      {/* Outer Shield Outline */}
      <path
        d="M3 3h18v12l-9 9-9-9V3z"
        fill="#090d16"
      />
      {/* Shield Trim */}
      <path
        d="M4 4h16v10l-8 8-8-8V4z"
        fill={trim}
      />
      {/* Shield Interior Stripes */}
      <path
        d="M5 5h14v8.5l-7 7-7-7V5z"
        fill={primary}
      />
      <rect x="8" y="5" width="3" height="10" fill={secondary} />
      <rect x="13" y="5" width="3" height="10" fill={secondary} />
      <path d="M7 15h10l-5 5-5-5z" fill={secondary} />
      {/* Center Ribbon Band */}
      <rect x="4" y="9" width="16" height="5" fill="#0f172a" />
      <rect x="5" y="10" width="14" height="3" fill={trim} />
      <text
        x="12"
        y="12.5"
        textAnchor="middle"
        fontSize="4.2"
        fontWeight="bold"
        fontFamily="monospace"
        fill="#090d16"
      >
        {text}
      </text>
    </svg>
  );
};

export const PixelPlayerPortrait: React.FC<{
  role: PlayerRole;
  team: Team;
  skinTone: number;
  appearance?: RoleAppearance;
  className?: string;
}> = ({ role, team, skinTone, appearance, className = "w-16 h-16" }) => {
  const skin = SKIN_TONES[Math.abs(skinTone) % SKIN_TONES.length];
  const isGK = role === "GK";
  const jersey =
    team === "red"
      ? isGK
        ? "#16a34a"
        : "#dc2626"
      : isGK
      ? "#16a34a"
      : appearance
      ? JERSEY_THEME_STYLES[appearance.jerseyTheme].swatch
      : "#ffffff";
  const collar = team === "blue" && !isGK ? "#1d4ed8" : "#facc15";
  const hair: HairStyle = team === "blue" && appearance ? appearance.hairStyle : "classic";

  return (
    <svg viewBox="0 0 32 32" shapeRendering="crispEdges" className={className} aria-hidden="true">
      {/* Studio Backdrop */}
      <rect width="32" height="32" fill="#d8e2ee" />
      <rect y="21" width="32" height="11" fill="#bcc9da" />
      <rect x="1" y="1" width="30" height="30" fill="none" stroke="#64748b" strokeWidth="1" />

      {/* Shoulders & Jersey */}
      <rect x="5" y="24" width="22" height="8" fill="#090d16" />
      <rect x="6" y="25" width="20" height="7" fill={jersey} />
      <rect x="9" y="25" width="3" height="7" fill={team === "red" ? "#1e3a8a" : collar} />
      <rect x="20" y="25" width="3" height="7" fill={team === "red" ? "#1e3a8a" : collar} />
      {/* Collar V */}
      <rect x="12" y="23" width="8" height="3" fill={collar} />
      <rect x="13" y="24" width="6" height="2" fill={skin.shade} />

      {/* Neck */}
      <rect x="13" y="19" width="6" height="5" fill={skin.shade} />
      <rect x="14" y="19" width="4" height="4" fill={skin.base} />

      {/* Ears */}
      <rect x="9" y="12" width="2" height="4" fill={skin.shade} />
      <rect x="21" y="12" width="2" height="4" fill={skin.shade} />

      {/* Head Base */}
      <rect x="10" y="6" width="12" height="14" fill="#090d16" />
      <rect x="11" y="7" width="10" height="12" fill={skin.base} />
      {/* Jaw & Cheek Shading */}
      <rect x="11" y="17" width="10" height="2" fill={skin.shade} />
      <rect x="19" y="10" width="2" height="7" fill={skin.shade} />

      {/* Eyebrows & Eyes */}
      <rect x="12" y="11" width="3" height="1" fill={skin.hair} />
      <rect x="17" y="11" width="3" height="1" fill={skin.hair} />
      <rect x="13" y="12" width="2" height="2" fill="#0f172a" />
      <rect x="17" y="12" width="2" height="2" fill="#0f172a" />
      <rect x="13" y="12" width="1" height="1" fill="#ffffff" />
      <rect x="17" y="12" width="1" height="1" fill="#ffffff" />

      {/* Nose & Mouth */}
      <rect x="15" y="13" width="2" height="2" fill={skin.shade} />
      <rect x="14" y="17" width="4" height="1" fill="#7c2d12" />

      {/* Hair Styles */}
      {hair === "mohawk" ? (
        <>
          <rect x="14" y="3" width="4" height="5" fill="#eab308" />
          <rect x="11" y="6" width="10" height="2" fill={skin.hair} />
        </>
      ) : hair === "curly" ? (
        <>
          <rect x="9" y="4" width="14" height="4" fill={skin.hair} />
          <rect x="10" y="3" width="12" height="2" fill={skin.hair} />
          <rect x="9" y="8" width="2" height="4" fill={skin.hair} />
          <rect x="21" y="8" width="2" height="4" fill={skin.hair} />
        </>
      ) : hair === "headband" ? (
        <>
          <rect x="10" y="5" width="12" height="3" fill={skin.hair} />
          <rect x="10" y="8" width="12" height="2" fill="#e11d48" />
          <rect x="14" y="8" width="4" height="1" fill="#ffffff" />
        </>
      ) : hair === "helmet" ? (
        <>
          <rect x="9" y="5" width="14" height="5" fill="#0f172a" />
          <rect x="10" y="8" width="12" height="1" fill="#38bdf8" />
        </>
      ) : (
        <>
          <rect x="10" y="5" width="12" height="4" fill={skin.hair} />
          <rect x="11" y="4" width="10" height="2" fill={skin.hair} />
          <rect x="10" y="8" width="2" height="4" fill={skin.hair} />
          <rect x="20" y="8" width="2" height="4" fill={skin.hair} />
        </>
      )}
    </svg>
  );
};

export const PixelCommentatorPortrait: React.FC<{ className?: string }> = ({
  className = "w-14 h-14",
}) => (
  <svg viewBox="0 0 32 32" shapeRendering="crispEdges" className={className} aria-hidden="true">
    {/* Stadium Broadcast Booth Background */}
    <rect width="32" height="32" fill="#1e3a8a" />
    <rect y="16" width="32" height="16" fill="#0f172a" />
    <rect x="2" y="18" width="28" height="1" fill="#38bdf8" opacity="0.45" />
    {/* Suit & Tie */}
    <rect x="6" y="23" width="20" height="9" fill="#334155" />
    <rect x="12" y="23" width="8" height="9" fill="#f8fafc" />
    <rect x="15" y="24" width="2" height="8" fill="#1d4ed8" />
    <rect x="14" y="23" width="4" height="2" fill="#1e40af" />
    {/* Neck & Face */}
    <rect x="13" y="19" width="6" height="4" fill="#d99b78" />
    <rect x="10" y="7" width="12" height="13" fill="#090d16" />
    <rect x="11" y="8" width="10" height="11" fill="#f5c6a5" />
    <rect x="19" y="10" width="2" height="7" fill="#d99b78" />
    {/* Hair */}
    <rect x="10" y="5" width="12" height="4" fill="#3b2314" />
    <rect x="11" y="4" width="10" height="2" fill="#5c3a21" />
    {/* Eyes & Enthusiastic Mouth */}
    <rect x="13" y="12" width="2" height="2" fill="#0f172a" />
    <rect x="17" y="12" width="2" height="2" fill="#0f172a" />
    <rect x="14" y="16" width="4" height="2" fill="#991b1b" />
    <rect x="15" y="16" width="2" height="1" fill="#ffffff" />
    {/* Headset + Mic */}
    <rect x="9" y="5" width="1" height="9" fill="#0f172a" />
    <rect x="22" y="5" width="1" height="9" fill="#0f172a" />
    <rect x="10" y="3" width="12" height="2" fill="#0f172a" />
    <rect x="8" y="11" width="3" height="5" fill="#1e293b" />
    <rect x="21" y="11" width="3" height="5" fill="#1e293b" />
    <rect x="9" y="12" width="1" height="3" fill="#38bdf8" />
    <rect x="9" y="15" width="4" height="1" fill="#0f172a" />
    <rect x="12" y="16" width="3" height="2" fill="#0f172a" />
  </svg>
);

export const PixelCoachPortrait: React.FC<{ className?: string }> = ({
  className = "w-24 h-24",
}) => (
  <svg viewBox="0 0 36 36" shapeRendering="crispEdges" className={className} aria-hidden="true">
    {/* Win95 Sky Backdrop */}
    <rect width="36" height="36" fill="#7da7e2" />
    <rect y="20" width="36" height="16" fill="#5986ca" />
    {/* Dark Navy Coach Suit */}
    <rect x="4" y="24" width="24" height="12" fill="#1e293b" />
    <rect x="6" y="25" width="20" height="11" fill="#334155" />
    <rect x="12" y="24" width="8" height="12" fill="#f8fafc" />
    <rect x="15" y="25" width="2" height="11" fill="#1d4ed8" />
    {/* Face & Silver Hair */}
    <rect x="13" y="19" width="6" height="5" fill="#d99b78" />
    <rect x="10" y="6" width="12" height="14" fill="#090d16" />
    <rect x="11" y="7" width="10" height="12" fill="#f5c6a5" />
    <rect x="10" y="4" width="12" height="4" fill="#cbd5e1" />
    <rect x="11" y="3" width="10" height="2" fill="#f1f5f9" />
    <rect x="12" y="11" width="3" height="1" fill="#94a3b8" />
    <rect x="17" y="11" width="3" height="1" fill="#94a3b8" />
    <rect x="13" y="12" width="2" height="2" fill="#0f172a" />
    <rect x="17" y="12" width="2" height="2" fill="#0f172a" />
    <rect x="14" y="16" width="4" height="1" fill="#7c2d12" />
    {/* Pointing Tactical Finger */}
    <rect x="26" y="16" width="4" height="8" fill="#f5c6a5" />
    <rect x="27" y="14" width="2" height="4" fill="#f5c6a5" />
    <rect x="25" y="24" width="6" height="12" fill="#334155" />
  </svg>
);

export const PixelTrophyIllustration: React.FC<{ className?: string }> = ({
  className = "w-full h-36",
}) => (
  <svg viewBox="0 0 96 72" shapeRendering="crispEdges" className={className} aria-hidden="true">
    {/* Stadium Lights & Stands */}
    <rect width="96" height="72" fill="#1d4ed8" />
    <rect y="18" width="96" height="28" fill="#1e293b" />
    <rect y="44" width="96" height="28" fill="#16a34a" />
    <rect y="44" width="96" height="4" fill="#15803d" />
    {/* Floodlights */}
    <rect x="8" y="4" width="14" height="7" fill="#fef08a" />
    <rect x="74" y="4" width="14" height="7" fill="#fef08a" />
    {/* Crowd dots */}
    {[6, 14, 22, 30, 64, 72, 80, 88].map((x) => (
      <React.Fragment key={x}>
        <rect x={x} y="24" width="3" height="3" fill="#f87171" />
        <rect x={x + 4} y="29" width="3" height="3" fill="#60a5fa" />
        <rect x={x + 1} y="34" width="3" height="3" fill="#fde047" />
      </React.Fragment>
    ))}
    {/* Golden Trophy Pedestal & Cup */}
    <rect x="34" y="54" width="28" height="10" fill="#78350f" />
    <rect x="36" y="55" width="24" height="8" fill="#92400e" />
    <rect x="38" y="57" width="20" height="3" fill="#fbbf24" />
    {/* Stem */}
    <rect x="42" y="34" width="12" height="20" fill="#d97706" />
    <rect x="44" y="34" width="8" height="20" fill="#facc15" />
    {/* Globe Bowl */}
    <rect x="36" y="10" width="24" height="24" fill="#d97706" />
    <rect x="38" y="8" width="20" height="26" fill="#facc15" />
    <rect x="41" y="11" width="10" height="10" fill="#fef08a" />
    <rect x="52" y="16" width="5" height="14" fill="#b45309" />
    {/* Sparkles */}
    <rect x="28" y="14" width="2" height="2" fill="#ffffff" />
    <rect x="66" y="12" width="2" height="2" fill="#ffffff" />
    <rect x="62" y="28" width="2" height="2" fill="#fef08a" />
  </svg>
);

export const MainMenuHeroArtwork: React.FC<{ clubName: string }> = ({ clubName }) => (
  <div className="relative w-full h-full min-h-[250px] flex flex-col justify-between bg-[#0f172a] overflow-hidden border-2 border-t-[#808080] border-l-[#808080] border-r-white border-b-white select-none shadow-inner">
    <svg
      viewBox="0 0 220 210"
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges"
      className="w-full flex-1 block"
      aria-hidden="true"
    >
      {/* Twilight Floodlit Sky */}
      <rect width="220" height="72" fill="#0f2557" />
      <rect y="28" width="220" height="24" fill="#1d4ed8" />
      <rect y="50" width="220" height="22" fill="#2563eb" />
      {/* Subtle Pixel Stars */}
      <rect x="52" y="10" width="2" height="2" fill="#e0f2fe" />
      <rect x="166" y="11" width="2" height="2" fill="#fef9c3" />
      <rect x="46" y="28" width="1" height="1" fill="#ffffff" />
      <rect x="172" y="25" width="1" height="1" fill="#ffffff" />

      {/* Stadium Upper Roof & Double Tiered Stands */}
      <rect y="56" width="220" height="36" fill="#1e293b" />
      <rect y="54" width="220" height="4" fill="#94a3b8" />
      <rect y="74" width="220" height="2" fill="#334155" />

      {/* Floodlight Light Beams */}
      <polygon points="14,34 42,34 104,164 0,164" fill="#fef9c3" opacity="0.1" />
      <polygon points="178,34 206,34 220,164 116,164" fill="#fef9c3" opacity="0.1" />

      {/* Twin Stadium Floodlight Towers */}
      <rect x="14" y="18" width="28" height="15" fill="#cbd5e1" />
      <rect x="17" y="21" width="22" height="9" fill="#fef08a" />
      <rect x="26" y="33" width="4" height="23" fill="#94a3b8" />
      <rect x="178" y="18" width="28" height="15" fill="#cbd5e1" />
      <rect x="181" y="21" width="22" height="9" fill="#fef08a" />
      <rect x="190" y="33" width="4" height="23" fill="#94a3b8" />

      {/* Center Digital Stadium Scoreboard Banner */}
      <rect x="64" y="12" width="92" height="24" fill="#05080f" />
      <rect x="66" y="14" width="88" height="20" fill="#000080" />
      <rect x="66" y="14" width="88" height="2" fill="#38bdf8" opacity="0.6" />
      <text
        x="110"
        y="27"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="bold"
        fontFamily="monospace"
        fill="#fde047"
      >
        CUP 95 LIVE
      </text>

      {/* Colorful Pixel Crowd */}
      {Array.from({ length: 34 }).map((_, i) => (
        <React.Fragment key={i}>
          <rect
            x={4 + i * 6.4}
            y={62 + (i % 2) * 3}
            width="4"
            height="4"
            fill={["#ef4444", "#facc15", "#ffffff", "#60a5fa", "#4ade80"][i % 5]}
          />
          <rect
            x={6 + i * 6.4}
            y={77 + (i % 3) * 2}
            width="4"
            height="4"
            fill={["#ffffff", "#3b82f6", "#f87171", "#fde047"][i % 4]}
          />
        </React.Fragment>
      ))}

      {/* Illuminated Perimeter Ad Boards */}
      <rect y="90" width="220" height="11" fill="#090d16" />
      <rect x="4" y="92" width="48" height="7" fill="#1d4ed8" />
      <rect x="56" y="92" width="52" height="7" fill="#dc2626" />
      <rect x="112" y="92" width="52" height="7" fill="#047857" />
      <rect x="168" y="92" width="48" height="7" fill="#1e3a8a" />

      {/* Sunlit Mowed Grass Pitch */}
      <rect y="101" width="220" height="109" fill="#2c9c29" />
      <rect y="101" width="220" height="16" fill="#37b833" />
      <rect y="133" width="220" height="18" fill="#37b833" />
      <rect y="169" width="220" height="20" fill="#37b833" />
      {/* White Chalk Lines & Penalty Box Hint */}
      <rect y="109" width="220" height="2" fill="#f8fafc" />
      <path d="M22 109 L2 185" stroke="#f8fafc" strokeWidth="2" />
      <path d="M198 109 L218 185" stroke="#f8fafc" strokeWidth="2" />
      <path d="M84 109 L74 134 L146 134 L136 109" fill="none" stroke="#f8fafc" strokeWidth="1.5" opacity="0.65" />

      {/* Background Opponents */}
      <g transform="translate(154,102)">
        <rect x="2" y="18" width="12" height="3" fill="rgba(0,0,0,0.35)" />
        <rect x="5" y="1" width="6" height="6" fill="#e2a87e" />
        <rect x="5" y="0" width="6" height="2" fill="#1e1b18" />
        <rect x="4" y="7" width="8" height="8" fill="#dc2626" />
        <rect x="4" y="14" width="8" height="4" fill="#1e3a8a" />
      </g>

      {/* Motion Speed Lines behind #10 Striker & Ball */}
      <rect x="18" y="128" width="26" height="2" fill="#e0f2fe" opacity="0.45" />
      <rect x="10" y="142" width="32" height="2" fill="#e0f2fe" opacity="0.32" />
      <rect x="74" y="175" width="28" height="2" fill="#fef08a" opacity="0.55" />

      {/* Hero #10 Striker Dribbling Forward */}
      <g transform="translate(52,88)">
        <ellipse cx="26" cy="96" rx="22" ry="6" fill="rgba(0,0,0,0.42)" />
        <rect x="8" y="54" width="8" height="18" fill="#f3c19d" />
        <rect x="6" y="70" width="9" height="12" fill="#1d4ed8" />
        <rect x="4" y="81" width="12" height="5" fill="#090d16" />
        <rect x="29" y="56" width="9" height="16" fill="#f3c19d" />
        <rect x="30" y="70" width="9" height="14" fill="#1d4ed8" />
        <rect x="31" y="83" width="13" height="6" fill="#090d16" />
        <rect x="10" y="42" width="27" height="16" fill="#0f172a" />
        <rect x="11" y="43" width="25" height="14" fill="#f8fafc" />
        <rect x="14" y="44" width="2" height="12" fill="#2563eb" />
        <rect x="31" y="44" width="2" height="12" fill="#2563eb" />
        <rect x="9" y="18" width="28" height="26" fill="#090d16" />
        <rect x="10" y="19" width="26" height="24" fill="#ffffff" />
        <rect x="10" y="19" width="26" height="4" fill="#2563eb" />
        <rect x="2" y="21" width="9" height="11" fill="#ffffff" />
        <rect x="35" y="21" width="9" height="11" fill="#ffffff" />
        <rect x="0" y="30" width="6" height="8" fill="#f3c19d" />
        <rect x="40" y="30" width="6" height="8" fill="#f3c19d" />
        <rect x="16" y="25" width="3" height="13" fill="#1d4ed8" />
        <rect x="22" y="25" width="8" height="13" fill="#1d4ed8" />
        <rect x="25" y="28" width="2" height="7" fill="#ffffff" />
        <rect x="15" y="2" width="14" height="15" fill="#090d16" />
        <rect x="16" y="3" width="12" height="13" fill="#f3c19d" />
        <rect x="15" y="1" width="14" height="6" fill="#3d2516" />
        <rect x="24" y="8" width="3" height="3" fill="#090d16" />
      </g>

      {/* Classic Telstar Ball */}
      <g transform="translate(106,162)">
        <ellipse cx="14" cy="24" rx="14" ry="4" fill="rgba(0,0,0,0.45)" />
        <circle cx="14" cy="13" r="12" fill="#090d16" />
        <circle cx="14" cy="13" r="10.5" fill="#f8fafc" />
        <rect x="11" y="9" width="6" height="6" fill="#0f172a" />
        <rect x="5" y="12" width="4" height="4" fill="#0f172a" />
        <rect x="19" y="12" width="4" height="4" fill="#0f172a" />
        <rect x="11" y="3" width="6" height="3" fill="#0f172a" />
      </g>
    </svg>

    {/* Club Crest Badge Overlay (Top-Left) */}
    <div className="absolute top-2 left-2 bg-[#090d16]/90 border border-slate-300 px-2 py-1 flex items-center gap-1.5 shadow-[2px_2px_0_#000]">
      <PixelClubCrest team="blue" label={clubName.slice(0, 3)} className="w-5 h-6" />
      <span className="text-[11px] font-bold text-white truncate max-w-[140px]">
        {clubName}
      </span>
    </div>

    {/* Bottom Classic Tagline Strip */}
    <div className="bg-gradient-to-r from-[#0a361e] via-[#0e4d2a] to-[#0a361e] border-t-2 border-[#4ade80]/70 px-3 py-1.5 text-center">
      <span className="font-display text-base sm:text-lg font-bold text-amber-300 tracking-wide drop-shadow-[1px_1px_0_#000]">
        Тактика · Очки хода · Блиц-дуэли!
      </span>
    </div>
  </div>
);
