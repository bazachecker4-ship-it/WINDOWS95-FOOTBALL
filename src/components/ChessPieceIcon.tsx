import React from "react";
import { HairStyle, PlayerRole } from "../types/game";

interface ChessPieceIconProps {
  role: PlayerRole;
  className?: string;
}

export const ChessPieceIcon: React.FC<ChessPieceIconProps> = ({ role, className = "w-5 h-5" }) => {
  switch (role) {
    case "GK":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M11 2h2v2h2v2h-2v2.1l4.2-1.9L19 9l-2 7H7L5 9l1.8-2.8L11 8.1V6H9V4h2V2zm-4 16h10v2H7v-2z" />
        </svg>
      );
    case "DEF":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M6 3h2v2h3V3h2v2h3V3h2v5l-2 2v7l2 2v2H6v-2l2-2v-7L6 8V3z" />
        </svg>
      );
    case "MID":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 2a2 2 0 0 1 2 2c0 .6-.25 1.1-.65 1.45C15.5 7 16.5 9.2 16.5 11.5c0 1.8-.65 3.4-1.6 4.5H9.1C8.15 14.9 7.5 13.3 7.5 11.5c0-2.3 1-4.5 3.15-6.05A2 2 0 0 1 12 2zm-1.2 7.2 2.4 2.4-1.1 1.1-2.4-2.4 1.1-1.1zM7 18h10v2H7v-2z" />
        </svg>
      );
    case "WNG":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M16 4c-1.5 0-3 .6-4.2 1.6L8 7.5 6.5 10l2.4 1.3c.6.3 1.3.2 1.8-.2l1.3-1-1.6 3.5c-.5 1-.7 2.1-.6 3.4H17c.5-2.5.8-5.3.4-8.2-.3-2.5-1.4-4.8-1.4-4.8zM6 19h12v2H6v-2z" />
        </svg>
      );
    case "FWD":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M4 7a1.5 1.5 0 1 1 2.7.9L9.5 12l2-5.5a1.5 1.5 0 1 1 1 0l2 5.5 2.8-4.1A1.5 1.5 0 1 1 20 7l-2.3 9H6.3L4 7zm2 11h12v2H6v-2z" />
        </svg>
      );
  }
};

export const HairAccentIcon: React.FC<{ style: HairStyle; className?: string }> = ({
  style,
  className = "w-5 h-2.5",
}) => {
  switch (style) {
    case "mohawk":
      return (
        <svg viewBox="0 0 24 12" className={className} aria-hidden="true">
          <path d="M9 11 L12 1 L15 11 Z" fill="#FDE047" stroke="#0F172A" strokeWidth="1.2" />
        </svg>
      );
    case "curly":
      return (
        <svg viewBox="0 0 24 12" className={className} aria-hidden="true">
          <circle cx="7" cy="7" r="3.2" fill="#1E293B" stroke="#F8FAFC" strokeWidth="0.9" />
          <circle cx="12" cy="5.5" r="3.6" fill="#1E293B" stroke="#F8FAFC" strokeWidth="0.9" />
          <circle cx="17" cy="7" r="3.2" fill="#1E293B" stroke="#F8FAFC" strokeWidth="0.9" />
        </svg>
      );
    case "headband":
      return (
        <svg viewBox="0 0 24 8" className={className} aria-hidden="true">
          <rect x="3" y="2" width="18" height="4" rx="2" fill="#F43F5E" stroke="#FFF" strokeWidth="0.8" />
        </svg>
      );
    case "helmet":
      return (
        <svg viewBox="0 0 24 12" className={className} aria-hidden="true">
          <path
            d="M4 10 C4 4, 20 4, 20 10 Z"
            fill="#0F172A"
            stroke="#38BDF8"
            strokeWidth="1.2"
          />
        </svg>
      );
    case "classic":
    default:
      return null;
  }
};

export const SoccerBallIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#F8FAFC" stroke="#0F172A" strokeWidth="1.6" />
    <polygon points="12,7 15.8,9.8 14.3,14.2 9.7,14.2 8.2,9.8" fill="#0F172A" />
    <path
      d="M12 7V2.2M15.8 9.8l4.5-1.5M14.3 14.2l2.9 4M9.7 14.2l-2.9 4M8.2 9.8 3.7 8.3"
      stroke="#0F172A"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

export const TrainingConeIcon: React.FC<{ className?: string }> = ({ className = "w-7 h-7" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M5 20h14l-1.5-2.5h-11L5 20z" fill="#EA580C" stroke="#7C2D12" strokeWidth="1" />
    <path d="M7.5 17.5 10.5 5h3l3 12.5h-9z" fill="#F97316" stroke="#7C2D12" strokeWidth="1.1" />
    <path d="M9.1 11.5h5.8l.7 2.5H8.4l.7-2.5z" fill="#F8FAFC" />
  </svg>
);
