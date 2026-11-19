import React, { useState } from "react";
import { UserProfile } from "../engine/profile";
import { SquadProgressionState } from "../types/game";
import { Check, Share2, SlidersHorizontal, Trophy, User } from "lucide-react";
import { Win95Window } from "./Win95Window";
import { SoccerBallIcon } from "./ChessPieceIcon";

interface ProfileModalProps {
  profile: UserProfile;
  progression: SquadProgressionState;
  zIndex: number;
  isActive: boolean;
  isMinimized?: boolean;
  cascadeIndex?: number;
  topBoundary?: number;
  onFocus: () => void;
  onMinimize?: () => void;
  onSaveProfile: (profile: UserProfile) => void;
  onOpenSquad?: () => void;
  onOpenChallenge?: () => void;
  onClose: () => void;
}

const CLUB_COLORS = ["#000080", "#991b1b", "#14532d", "#7c2d12", "#4c1d95", "#0f766e"];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  progression,
  zIndex,
  isActive,
  isMinimized,
  cascadeIndex = 1,
  topBoundary = 40,
  onFocus,
  onMinimize,
  onSaveProfile,
  onOpenSquad,
  onOpenChallenge,
  onClose,
}) => {
  const [managerName, setManagerName] = useState(profile.managerName);
  const [clubName, setClubName] = useState(profile.clubName);
  const [emblemColor, setEmblemColor] = useState(profile.emblemColor);
  const [homeStadium, setHomeStadium] = useState(profile.homeStadium);

  const totalLevel = Math.floor(progression.xp / 60) + 1;
  const xpIntoLevel = progression.xp % 60;
  const xpPct = Math.round((xpIntoLevel / 60) * 100);
  const winRate =
    profile.matchesWon + profile.matchesLost > 0
      ? Math.round((profile.matchesWon / (profile.matchesWon + profile.matchesLost)) * 100)
      : 0;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      ...profile,
      managerName: managerName.trim() || "Менеджер '95",
      clubName: clubName.trim() || "FC Victory '95",
      emblemColor,
      homeStadium: homeStadium.trim() || "Стадион 'Динамо-95'",
      created: true,
    });
  };

  return (
    <Win95Window
      title="CLUB_PROFILE.EXE — Профиль и Клуб"
      icon={<User className="w-3.5 h-3.5 text-emerald-200 shrink-0" />}
      ariaLabel="Профиль менеджера и клуба"
      zIndex={zIndex}
      isActive={isActive}
      isMinimized={isMinimized}
      cascadeIndex={cascadeIndex}
      topBoundary={topBoundary}
      defaultWidth={520}
      defaultHeight={560}
      minWidth={320}
      minHeight={360}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      statusBarPanes={[
        { text: `Очки навыков: ${progression.skillPoints}`, flex: true },
        { text: `Голы: ${progression.goalsScored}` },
        { text: profile.created ? "Профиль активен" : "Новый профиль" },
      ]}
    >
      {/* Form Body */}
      <form
        onSubmit={handleSave}
        className="p-3 overflow-y-auto space-y-3 flex-1 text-black text-xs"
      >
          {!profile.created && (
            <div className="pc-inset-dark px-3 py-2 text-emerald-300 text-[11px]">
              &gt; Добро пожаловать! Создайте профиль менеджера и свой футбольный клуб, чтобы копить опыт (XP), прокачивать состав и вызывать друзей.
            </div>
          )}

          {/* Club Card */}
          <div className="pc-inset p-2.5 flex items-center gap-3">
            <div
              className="w-14 h-14 border-2 border-black shadow-[inset_1px_1px_0_rgba(255,255,255,0.5)] flex items-center justify-center shrink-0"
              style={{ backgroundColor: emblemColor }}
            >
              <SoccerBallIcon className="w-8 h-8" />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="font-display text-lg font-bold text-[#000080] truncate leading-none">
                {clubName || "FC Victory '95"}
              </div>
              <div className="text-[11px] text-slate-900 truncate">
                Менеджер: <strong>{managerName || "Менеджер '95"}</strong> ·{" "}
                <span className="text-slate-700">{homeStadium}</span>
              </div>
              {/* Win95 Segmented Level / XP Bar */}
              <div className="flex items-center gap-2 pt-0.5">
                <span className="font-mono text-[10px] font-bold text-[#000080] whitespace-nowrap">
                  УР.{totalLevel}
                </span>
                <div className="flex-1 h-3.5 pc-field p-[2px]">
                  <div
                    className="h-full win95-progress-fill transition-all duration-300"
                    style={{ width: `${Math.max(4, xpPct)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] tabular-nums text-slate-800 whitespace-nowrap">
                  {xpIntoLevel}/60 XP
                </span>
              </div>
            </div>
          </div>

          {/* Stats Strip */}
          <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
            <div className="pc-inset-dark py-1.5 px-1">
              <div className="font-display text-lg font-bold text-emerald-300 tabular-nums leading-none">
                {progression.matchesPlayed}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Матчей</div>
            </div>
            <div className="pc-inset-dark py-1.5 px-1">
              <div className="font-display text-lg font-bold text-sky-300 tabular-nums leading-none">
                {profile.matchesWon}/{profile.matchesLost}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">В / П</div>
            </div>
            <div className="pc-inset-dark py-1.5 px-1">
              <div className="font-display text-lg font-bold text-amber-300 tabular-nums leading-none">
                {winRate}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Винрейт</div>
            </div>
            <div className="pc-inset-dark py-1.5 px-1">
              <div className="font-display text-lg font-bold text-yellow-300 tabular-nums leading-none inline-flex items-center gap-0.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>{profile.trophies}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Трофеи</div>
            </div>
          </div>

          {/* Club Editor GroupBox */}
          <fieldset className="win95-groupbox space-y-2.5">
            <legend>Свойства профиля и клуба</legend>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold mb-1 text-[11px]">Имя менеджера:</label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  className="pc-field w-full px-2 py-1.5 text-xs focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-bold mb-1 text-[11px]">Название клуба:</label>
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  className="pc-field w-full px-2 py-1.5 text-xs focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold mb-1 text-[11px]">Домашний стадион:</label>
                <input
                  type="text"
                  value={homeStadium}
                  onChange={(e) => setHomeStadium(e.target.value)}
                  className="pc-field w-full px-2 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold mb-1 text-[11px]">Цвет герба клуба:</label>
                <div className="flex items-center gap-1.5">
                  {CLUB_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setEmblemColor(col)}
                      aria-label={`Выбрать цвет ${col}`}
                      className={`w-6 h-6 border border-black cursor-pointer ${
                        emblemColor.toLowerCase() === col.toLowerCase()
                          ? "ring-2 ring-[#000080] ring-offset-1"
                          : ""
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                  <input
                    type="color"
                    value={emblemColor}
                    onChange={(e) => setEmblemColor(e.target.value)}
                    title="Свой цвет"
                    className="w-7 h-6 p-0 pc-btn cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </fieldset>

          {/* Footer Action Row */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {onOpenSquad && (
                <button
                  type="button"
                  onClick={onOpenSquad}
                  className="pc-btn px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Состав ({progression.skillPoints})</span>
                </button>
              )}
              {onOpenChallenge && (
                <button
                  type="button"
                  onClick={onOpenChallenge}
                  className="pc-btn px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#000080]" />
                  <span>Вызов / QR</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="pc-btn px-4 py-1.5 text-xs font-bold cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="pc-btn-primary px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Сохранить</span>
              </button>
            </div>
          </div>
      </form>
    </Win95Window>
  );
};
