// ============================================================================
// Tactaka - Tactical Lockdown Suite & Interactive Pitch Builder
// Full Drag-and-Drop, Touch/Pointer Drag Ghost & Tap-to-Swap System
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  TacticsConfig,
  FormationType,
  PlayingStyle,
  LobbyManager,
  PlayerCard,
  Position,
} from '../../../../shared/types';
import {
  PLAYING_STYLE_INFO,
  FORMATION_CONFIGS,
} from '../../../../shared/constants';
import {
  calculateSquadChemistry,
  isPlayerInPosition,
} from '../../../../shared/chemistryEngine';
import {
  validatePlayingStyleEligibility,
  autoAssignSquadTactics,
  createDefaultTactics,
} from '../../../../shared/tacticsEngine';
import { soundManager } from '../../audio/soundEffects';
import {
  Clock,
  Shield,
  Zap,
  CheckCircle,
  AlertCircle,
  Wand2,
  Users,
  Settings2,
  ArrowUpDown,
  Move,
  GripVertical,
  X,
  UserMinus,
} from 'lucide-react';

interface TacticalLockdownScreenProps {
  currentManager: LobbyManager;
  timeRemaining: number;
  onUpdateTactics: (tactics: TacticsConfig) => void;
  onFinishTactics: () => void;
  isHost: boolean;
}

interface DragPayload {
  type: 'SLOT' | 'BENCH';
  slotId?: string;
  playerId: string;
  player: PlayerCard;
}

export function formatPlayerPitchName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  if (parts[0].length <= 2 && parts[0].includes('.')) {
    return trimmed;
  }
  const initial = parts[0].charAt(0).toUpperCase();
  const rest = parts.slice(1).join(' ');
  return `${initial}. ${rest}`;
}

export const TacticalLockdownScreen: React.FC<TacticalLockdownScreenProps> = ({
  currentManager,
  timeRemaining,
  onUpdateTactics,
  onFinishTactics,
  isHost,
}) => {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'PITCH' | 'STYLES' | 'SUBS'>('PITCH');

  // Drag-and-drop state
  const [draggedItem, setDraggedItem] = useState<DragPayload | null>(null);
  const [hoverSlotId, setHoverSlotId] = useState<string | null>(null);
  const [isOverBench, setIsOverBench] = useState(false);
  const [pointerGhostPos, setPointerGhostPos] = useState<{ x: number; y: number } | null>(null);

  const pointerStartRef = useRef<{ x: number; y: number; item: DragPayload } | null>(null);
  const isPointerDraggingRef = useRef<boolean>(false);

  const tactics = currentManager.tactics;
  const squad = currentManager.squad;

  // Starters mapping
  const starters = tactics.slots
    .map((slot) => squad.find((p) => p.id === slot.assignedPlayerId))
    .filter((p): p is PlayerCard => p !== undefined);

  // Bench mapping
  const bench = squad.filter(
    (p) => !tactics.slots.some((s) => s.assignedPlayerId === p.id)
  );

  // Chemistry calculation
  const chemResult = calculateSquadChemistry(starters, tactics);

  // Format countdown minutes & seconds
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  // Formations list
  const formations: FormationType[] = [
    '4-3-3',
    '4-2-3-1',
    '3-5-2',
    '4-4-2',
    '5-2-3',
    '4-1-2-1-2',
  ];

  // -------------------------------------------------------------
  // Slot & Squad Mutation Logic
  // -------------------------------------------------------------
  const swapSlots = useCallback(
    (slotIdA: string, slotIdB: string) => {
      const slotA = tactics.slots.find((s) => s.id === slotIdA);
      const slotB = tactics.slots.find((s) => s.id === slotIdB);
      if (!slotA || !slotB) return;

      const playerA = slotA.assignedPlayerId;
      const playerB = slotB.assignedPlayerId;

      const newSlots = tactics.slots.map((s) => {
        if (s.id === slotIdA) return { ...s, assignedPlayerId: playerB };
        if (s.id === slotIdB) return { ...s, assignedPlayerId: playerA };
        return s;
      });

      const newStarterIds = newSlots
        .map((s) => s.assignedPlayerId)
        .filter((id): id is string => id !== null);

      const newBenchIds = squad
        .filter((p) => !newStarterIds.includes(p.id))
        .slice(0, 7)
        .map((p) => p.id);

      onUpdateTactics({
        ...tactics,
        slots: newSlots,
        starterIds: newStarterIds,
        benchIds: newBenchIds,
      });

      setSelectedSlotId(null);
      soundManager.playBidChime();
    },
    [tactics, squad, onUpdateTactics]
  );

  const assignPlayerToSlot = useCallback(
    (targetSlotId: string, playerId: string) => {
      const sourceSlot = tactics.slots.find((s) => s.assignedPlayerId === playerId);
      const targetSlot = tactics.slots.find((s) => s.id === targetSlotId);
      if (!targetSlot) return;

      const targetPrevPlayerId = targetSlot.assignedPlayerId;

      const newSlots = tactics.slots.map((s) => {
        if (s.id === targetSlotId) {
          return { ...s, assignedPlayerId: playerId };
        }
        if (sourceSlot && s.id === sourceSlot.id) {
          // If source slot exists, put target's previous player here (swap)
          return { ...s, assignedPlayerId: targetPrevPlayerId };
        }
        return s;
      });

      const newStarterIds = newSlots
        .map((s) => s.assignedPlayerId)
        .filter((id): id is string => id !== null);

      const newBenchIds = squad
        .filter((p) => !newStarterIds.includes(p.id))
        .slice(0, 7)
        .map((p) => p.id);

      onUpdateTactics({
        ...tactics,
        slots: newSlots,
        starterIds: newStarterIds,
        benchIds: newBenchIds,
      });

      setSelectedSlotId(null);
      soundManager.playBidChime();
    },
    [tactics, squad, onUpdateTactics]
  );

  const removePlayerFromSlot = useCallback(
    (slotId: string) => {
      const newSlots = tactics.slots.map((s) =>
        s.id === slotId ? { ...s, assignedPlayerId: null } : s
      );

      const newStarterIds = newSlots
        .map((s) => s.assignedPlayerId)
        .filter((id): id is string => id !== null);

      const newBenchIds = squad
        .filter((p) => !newStarterIds.includes(p.id))
        .slice(0, 7)
        .map((p) => p.id);

      onUpdateTactics({
        ...tactics,
        slots: newSlots,
        starterIds: newStarterIds,
        benchIds: newBenchIds,
      });

      setSelectedSlotId(null);
      soundManager.playTick();
    },
    [tactics, squad, onUpdateTactics]
  );

  // -------------------------------------------------------------
  // Drag & Drop Handlers
  // -------------------------------------------------------------
  const handleDropOnSlot = useCallback(
    (targetSlotId: string, item: DragPayload) => {
      if (item.type === 'SLOT' && item.slotId) {
        if (item.slotId === targetSlotId) return;
        swapSlots(item.slotId, targetSlotId);
      } else if (item.type === 'BENCH') {
        assignPlayerToSlot(targetSlotId, item.playerId);
      }
    },
    [swapSlots, assignPlayerToSlot]
  );

  const handleDropOnBench = useCallback(
    (item: DragPayload) => {
      if (item.type === 'SLOT' && item.slotId) {
        removePlayerFromSlot(item.slotId);
      }
    },
    [removePlayerFromSlot]
  );

  // -------------------------------------------------------------
  // Pointer Drag & Drop for Touch / Mobile Screens
  // -------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent, item: DragPayload) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      item,
    };
    isPointerDraggingRef.current = false;
  };

  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!pointerStartRef.current) return;
      const dx = Math.abs(e.clientX - pointerStartRef.current.x);
      const dy = Math.abs(e.clientY - pointerStartRef.current.y);

      if (!isPointerDraggingRef.current && (dx > 6 || dy > 6)) {
        isPointerDraggingRef.current = true;
        setDraggedItem(pointerStartRef.current.item);
      }

      if (isPointerDraggingRef.current) {
        setPointerGhostPos({ x: e.clientX, y: e.clientY });

        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        let foundSlotId: string | null = null;
        let foundBench = false;

        for (const el of elements) {
          const slotAttr = el.getAttribute('data-slot-id');
          if (slotAttr) {
            foundSlotId = slotAttr;
            break;
          }
          if (el.getAttribute('data-bench-zone')) {
            foundBench = true;
          }
        }

        setHoverSlotId(foundSlotId);
        setIsOverBench(foundBench);
      }
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      if (pointerStartRef.current && isPointerDraggingRef.current) {
        const item = pointerStartRef.current.item;
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        let targetSlotId: string | null = null;
        let droppedOnBench = false;

        for (const el of elements) {
          const slotAttr = el.getAttribute('data-slot-id');
          if (slotAttr) {
            targetSlotId = slotAttr;
            break;
          }
          if (el.getAttribute('data-bench-zone')) {
            droppedOnBench = true;
          }
        }

        if (targetSlotId) {
          handleDropOnSlot(targetSlotId, item);
        } else if (droppedOnBench) {
          handleDropOnBench(item);
        }
      }

      pointerStartRef.current = null;
      isPointerDraggingRef.current = false;
      setDraggedItem(null);
      setHoverSlotId(null);
      setIsOverBench(false);
      setPointerGhostPos(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [handleDropOnSlot, handleDropOnBench]);

  // -------------------------------------------------------------
  // Tap / Click Interactions
  // -------------------------------------------------------------
  const handleSlotClick = (slotId: string) => {
    if (selectedSlotId === null) {
      // Select slot
      setSelectedSlotId(slotId);
      soundManager.playTick();
    } else if (selectedSlotId === slotId) {
      // Deselect slot
      setSelectedSlotId(null);
    } else {
      // Tap-to-Swap: slot A & slot B swap positions!
      swapSlots(selectedSlotId, slotId);
    }
  };

  const handleSelectFormation = (f: FormationType) => {
    const updated = autoAssignSquadTactics(squad, f);
    onUpdateTactics(updated);
    setSelectedSlotId(null);
  };

  const handleSelectPlayingStyle = (style: PlayingStyle) => {
    onUpdateTactics({
      ...tactics,
      playingStyle: style,
    });
  };

  const handleAutoOptimize = () => {
    const optimized = autoAssignSquadTactics(squad, tactics.formation);
    onUpdateTactics(optimized);
    setSelectedSlotId(null);
    soundManager.playBidChime();
  };

  const toggleAutoSub = (ruleId: string) => {
    const updated = tactics.autoSubs.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    onUpdateTactics({ ...tactics, autoSubs: updated });
  };

  const selectedSlot = tactics.slots.find((s) => s.id === selectedSlotId);
  const selectedSlotPlayer = selectedSlot?.assignedPlayerId
    ? squad.find((p) => p.id === selectedSlot.assignedPlayerId)
    : null;

  return (
    <div className="flex-1 flex flex-col justify-between p-3 overflow-y-auto select-none relative">
      {/* Floating Drag Ghost (Follows finger/mouse during drag) */}
      {pointerGhostPos && draggedItem && (
        <div
          style={{
            left: pointerGhostPos.x,
            top: pointerGhostPos.y,
            transform: 'translate(-50%, -120%)',
          }}
          className="fixed z-50 pointer-events-none bg-slate-900/95 border-2 border-cyan-400 rounded-xl px-2.5 py-1.5 shadow-2xl flex items-center gap-2 backdrop-blur-md animate-pulse"
        >
          <span className="font-black text-xs text-amber-300">{draggedItem.player.ovr}</span>
          <div>
            <span className="font-extrabold text-xs text-white block truncate max-w-[120px]">
              {draggedItem.player.displayName}
            </span>
            <span className="text-[9px] text-cyan-300 font-bold">
              {draggedItem.player.primaryPosition} • {draggedItem.type === 'SLOT' ? 'Drag to Swap/Move' : 'Drag to Pitch'}
            </span>
          </div>
        </div>
      )}

      {/* Top Header: 3-Min Lockdown Timer & Chem Points */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-500/40 px-2.5 py-1 rounded-xl text-rose-300 font-mono font-black text-xs">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>
              LOCKDOWN {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded-xl text-emerald-300 text-xs font-black">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>CHEM {chemResult.totalSquadChemistry}/33</span>
            </div>
            <button
              onClick={handleAutoOptimize}
              className="p-1.5 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
              title="Auto Optimize Lineup"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Auto</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher: PITCH / PLAYING STYLE / AUTO-SUBS */}
        <div className="grid grid-cols-3 gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 mb-2 text-xs font-black">
          <button
            onClick={() => setActiveTab('PITCH')}
            className={`py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'PITCH'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Formation & Pitch
          </button>
          <button
            onClick={() => setActiveTab('STYLES')}
            className={`py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'STYLES'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Play Style
          </button>
          <button
            onClick={() => setActiveTab('SUBS')}
            className={`py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'SUBS'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Bench & Rules
          </button>
        </div>
      </div>

      {/* TAB 1: PITCH & FORMATION VIEW */}
      {activeTab === 'PITCH' && (
        <div className="flex-1 flex flex-col justify-between">
          {/* Formations Pill Selector */}
          <div className="flex gap-1 overflow-x-auto pb-1.5 mb-1.5 no-scrollbar">
            {formations.map((f) => (
              <button
                key={f}
                onClick={() => handleSelectFormation(f)}
                className={`px-3 py-1 rounded-lg text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  tactics.formation === f
                    ? 'bg-amber-400 text-black shadow-md'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Interactive Help Banner: Swapping / Dragging Status */}
          {draggedItem ? (
            <div className="mb-1.5 py-1 px-2.5 rounded-lg bg-cyan-950/90 border border-cyan-400/60 text-[10px] font-bold text-cyan-200 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-1.5 truncate">
                <Move className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                <span className="truncate">
                  Dragging <b className="text-white">{draggedItem.player.displayName}</b> — Drop onto any pitch slot to assign or swap!
                </span>
              </div>
            </div>
          ) : selectedSlot ? (
            <div className="mb-1.5 py-1 px-2.5 rounded-lg bg-amber-950/90 border border-amber-400/60 text-[10px] font-bold text-amber-200 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-1.5 truncate">
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="truncate">
                  Selected <b className="text-white">{selectedSlot.label}</b> ({selectedSlotPlayer?.displayName || 'Empty'}). Tap another slot to <b>SWAP</b>, or pick below:
                </span>
              </div>
              <button
                onClick={() => setSelectedSlotId(null)}
                className="p-0.5 hover:bg-white/10 rounded text-slate-300 ml-1 cursor-pointer"
                title="Cancel Swap"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="mb-1 text-[10px] text-slate-400 flex items-center justify-between px-1">
              <span className="flex items-center gap-1">
                <Move className="w-3 h-3 text-cyan-400" />
                <b>Drag & drop</b> players on pitch to arrange or swap.
              </span>
              <span className="text-[9px] text-slate-500">Tap to select/swap</span>
            </div>
          )}

          {/* Interactive 2D Pitch Field (Drop Target Zone) */}
          <div className="tactical-pitch h-[340px] w-full rounded-2xl relative border-2 border-emerald-500/30 overflow-hidden shadow-2xl">
            {/* Technical Pitch Watermark & Dimensions */}
            <div className="absolute top-2 left-3 z-10 flex items-center gap-2 pointer-events-none opacity-50">
              <span className="text-[8px] font-mono text-emerald-300 uppercase tracking-widest">
                PITCH 105m × 68m
              </span>
              <span className="text-[8px] font-mono text-white/50">•</span>
              <span className="text-[8px] font-mono text-cyan-300 uppercase tracking-wider">
                {tactics.formation} SYSTEM
              </span>
            </div>

            {/* Pitch Lines */}
            <div className="pitch-line inset-x-4 top-0 h-16 border-b-2 border-x-2 rounded-b-xl pointer-events-none" />
            <div className="pitch-line inset-x-12 top-0 h-8 border-b-2 border-x-2 rounded-b-md pointer-events-none" />
            <div className="pitch-line top-1/2 left-0 right-0 border-b-2 -translate-y-1/2 pointer-events-none" />
            <div className="pitch-line top-1/2 left-1/2 w-20 h-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 pointer-events-none" />
            <div className="pitch-line top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 pointer-events-none" />
            <div className="pitch-line inset-x-4 bottom-0 h-16 border-t-2 border-x-2 rounded-t-xl pointer-events-none" />
            <div className="pitch-line inset-x-12 bottom-0 h-8 border-t-2 border-x-2 rounded-t-md pointer-events-none" />

            {/* 11 Formation Interactive Slots */}
            {tactics.slots.map((slot) => {
              const player = squad.find((p) => p.id === slot.assignedPlayerId);
              const isSelected = selectedSlotId === slot.id;
              const isHoverTarget = hoverSlotId === slot.id;
              const isOop = player ? !isPlayerInPosition(player, slot.label) : false;
              const chem = player ? chemResult.playerChem[player.id] || 0 : 0;

              // Check if dragged item is compatible with this slot
              const isDraggedMatchingPos = draggedItem
                ? isPlayerInPosition(draggedItem.player, slot.label)
                : false;

              return (
                <div
                  key={slot.id}
                  data-slot-id={slot.id}
                  onClick={() => handleSlotClick(slot.id)}
                  onPointerDown={(e) => {
                    if (player) {
                      handlePointerDown(e, {
                        type: 'SLOT',
                        slotId: slot.id,
                        playerId: player.id,
                        player,
                      });
                    }
                  }}
                  // Desktop HTML5 drag-and-drop
                  draggable={Boolean(player)}
                  onDragStart={(e) => {
                    if (!player) return;
                    const payload: DragPayload = {
                      type: 'SLOT',
                      slotId: slot.id,
                      playerId: player.id,
                      player,
                    };
                    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedItem(payload);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (hoverSlotId !== slot.id) setHoverSlotId(slot.id);
                  }}
                  onDragLeave={(e) => {
                    if (hoverSlotId === slot.id) setHoverSlotId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedItem) {
                      handleDropOnSlot(slot.id, draggedItem);
                    } else {
                      try {
                        const raw = e.dataTransfer.getData('text/plain');
                        if (raw) {
                          const parsed: DragPayload = JSON.parse(raw);
                          handleDropOnSlot(slot.id, parsed);
                        }
                      } catch (err) {
                        console.error('Drop error:', err);
                      }
                    }
                    setDraggedItem(null);
                    setHoverSlotId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedItem(null);
                    setHoverSlotId(null);
                  }}
                  style={{
                    left: `${slot.x}%`,
                    top: `${100 - slot.y}%`, // Invert so GK is at bottom, ST at top
                    transform: 'translate(-50%, -50%)',
                    touchAction: 'none',
                  }}
                  className={`absolute z-20 flex flex-col items-center cursor-pointer transition-transform duration-150 ${
                    isSelected
                      ? 'scale-125 z-30'
                      : isHoverTarget
                      ? 'scale-130 z-40'
                      : 'hover:scale-105'
                  }`}
                >
                  {/* Slot Circular Disc */}
                  <div
                    className={`w-10 h-10 rounded-full flex flex-col items-center justify-center border-2 shadow-xl relative transition-all ${
                      isHoverTarget
                        ? isDraggedMatchingPos
                          ? 'bg-emerald-950 border-emerald-400 ring-4 ring-emerald-400 shadow-emerald-500/60 animate-pulse'
                          : 'bg-amber-950 border-amber-400 ring-4 ring-amber-400 shadow-amber-500/60 animate-pulse'
                        : isSelected
                        ? 'bg-cyan-950 border-cyan-400 ring-4 ring-cyan-400 shadow-cyan-500/50'
                        : selectedSlotId && !isSelected
                        ? 'border-dashed border-cyan-400/80 bg-slate-900/90 ring-2 ring-cyan-400/30'
                        : player
                        ? isOop
                          ? 'bg-rose-950/90 border-rose-400 text-white'
                          : 'bg-slate-900/95 border-emerald-400 text-white'
                        : 'bg-black/60 border-dashed border-white/40 text-slate-400'
                    }`}
                  >
                    {player ? (
                      <span className="font-black text-xs leading-none text-amber-300">
                        {player.ovr}
                      </span>
                    ) : (
                      <span className="font-black text-[10px] opacity-75">{slot.label}</span>
                    )}

                    {/* Swap indicator badge when slot selected */}
                    {selectedSlotId && !isSelected && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-cyan-400 text-black text-[8px] font-black flex items-center justify-center shadow">
                        ⇄
                      </span>
                    )}
                  </div>

                  {/* Player Name / Position Tag (Full formatted e.g. J. Cruyff, P. Cubarsi) */}
                  <div className="bg-slate-950/95 px-2 py-0.5 rounded-md mt-0.5 min-w-[56px] max-w-[104px] truncate text-center border border-white/20 shadow-md">
                    <span className="text-[10px] font-extrabold text-white tracking-tight truncate block leading-tight">
                      {player ? formatPlayerPitchName(player.displayName) : slot.label}
                    </span>
                  </div>

                  {/* Chem Dots */}
                  {player && (
                    <div className="flex gap-0.5 mt-0.5">
                      {[1, 2, 3].map((dot) => (
                        <span
                          key={dot}
                          className={`w-1 h-1 rounded-full ${
                            dot <= chem ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Roster & Bench Assignment Drawer (Drop Target for Bench) */}
          <div
            data-bench-zone="true"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (!isOverBench) setIsOverBench(true);
            }}
            onDragLeave={() => setIsOverBench(false)}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedItem) {
                handleDropOnBench(draggedItem);
              } else {
                try {
                  const raw = e.dataTransfer.getData('text/plain');
                  if (raw) {
                    const parsed: DragPayload = JSON.parse(raw);
                    handleDropOnBench(parsed);
                  }
                } catch (err) {
                  console.error('Bench drop error:', err);
                }
              }
              setDraggedItem(null);
              setIsOverBench(false);
            }}
            className={`glass-panel p-2.5 rounded-xl border mt-2 transition-all ${
              isOverBench
                ? 'border-rose-400 bg-rose-950/40 shadow-lg shadow-rose-500/20'
                : 'border-slate-700 bg-slate-900/90'
            }`}
          >
            {/* Header with Slot Title & Unassign Button */}
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold text-slate-300">
              <div className="flex items-center gap-1.5 truncate">
                {selectedSlot ? (
                  <>
                    <span className="text-amber-300 font-black">
                      Slot {selectedSlot.label}:
                    </span>
                    <span className="text-slate-300 truncate">
                      {selectedSlotPlayer
                        ? `${selectedSlotPlayer.displayName} (${selectedSlotPlayer.primaryPosition})`
                        : 'Empty'}
                    </span>
                  </>
                ) : (
                  <span>Drag any player to pitch, or tap a slot to swap:</span>
                )}
              </div>

              {selectedSlot && selectedSlotPlayer && (
                <button
                  onClick={() => removePlayerFromSlot(selectedSlot.id)}
                  className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 text-rose-300 hover:bg-rose-900 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  title="Remove from pitch to bench"
                >
                  <UserMinus className="w-3 h-3" />
                  <span>To Bench</span>
                </button>
              )}
            </div>

            {/* Squad / Bench Cards Grid */}
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5 no-scrollbar">
              {squad.map((p) => {
                const assignedSlot = tactics.slots.find((s) => s.assignedPlayerId === p.id);
                const isStarter = Boolean(assignedSlot);
                const isInPos = selectedSlot
                  ? isPlayerInPosition(p, selectedSlot.label)
                  : true;

                return (
                  <div
                    key={p.id}
                    data-player-id={p.id}
                    onPointerDown={(e) => {
                      handlePointerDown(e, {
                        type: 'BENCH',
                        playerId: p.id,
                        player: p,
                      });
                    }}
                    // Desktop HTML5 drag
                    draggable={true}
                    onDragStart={(e) => {
                      const payload: DragPayload = {
                        type: 'BENCH',
                        playerId: p.id,
                        player: p,
                      };
                      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedItem(payload);
                    }}
                    onDragEnd={() => {
                      setDraggedItem(null);
                      setHoverSlotId(null);
                    }}
                    onClick={() => {
                      if (selectedSlotId) {
                        assignPlayerToSlot(selectedSlotId, p.id);
                      }
                    }}
                    className={`p-1.5 rounded-lg border text-left flex items-center justify-between transition-all cursor-grab active:cursor-grabbing ${
                      selectedSlot && isInPos
                        ? 'border-emerald-500/40 bg-emerald-950/30 hover:border-emerald-400'
                        : isStarter
                        ? 'border-slate-800 bg-slate-900/60 opacity-75'
                        : 'border-slate-700 bg-slate-800/80 hover:border-slate-500'
                    }`}
                    style={{ touchAction: 'none' }}
                  >
                    <div className="truncate flex items-center gap-1.5">
                      <GripVertical className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      <div className="truncate">
                        <div className="flex items-center gap-1">
                          <span className="font-black text-xs text-amber-300">{p.ovr}</span>
                          <span className="font-bold text-[11px] text-white truncate">
                            {p.displayName}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {p.primaryPosition} • {p.club}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end flex-shrink-0 ml-1">
                      {isStarter ? (
                        <span className="text-[8px] font-black text-cyan-300 bg-cyan-950/80 border border-cyan-800 px-1 rounded">
                          {assignedSlot?.label}
                        </span>
                      ) : (
                        <span className="text-[8px] font-bold text-slate-400 bg-slate-900 px-1 rounded">
                          BENCH
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLAYING STYLES */}
      {activeTab === 'STYLES' && (
        <div className="flex-1 space-y-2 py-1">
          <div className="text-xs font-bold text-slate-300 mb-1">
            Select Tactical Strategy for Match Simulation:
          </div>
          {(['Tiki-Taka', 'Fast Counter-Attack', 'Direct Wing Play', 'Park the Bus'] as PlayingStyle[]).map(
            (style) => {
              const info = PLAYING_STYLE_INFO[style];
              const isSelected = tactics.playingStyle === style;
              const validation = validatePlayingStyleEligibility(
                style,
                starters,
                tactics.slots
              );

              return (
                <div
                  key={style}
                  onClick={() => validation.eligible && handleSelectPlayingStyle(style)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/40 shadow-md shadow-cyan-500/20'
                      : validation.eligible
                      ? 'border-slate-700 bg-slate-900/80 hover:border-slate-600'
                      : 'border-slate-800 bg-slate-950/60 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-sm text-white">{info.name}</span>
                    {isSelected && (
                      <span className="text-[10px] font-black text-cyan-300 bg-cyan-900/60 px-2 py-0.5 rounded-full">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mb-1">{info.description}</p>
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/5">
                    <span className="text-slate-400">{info.reqDescription}</span>
                    {validation.eligible ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Eligible
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {validation.reason}
                      </span>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* TAB 3: BENCH & AUTO-SUB RULES */}
      {activeTab === 'SUBS' && (
        <div className="flex-1 space-y-3 py-1">
          {/* Conditional Auto-Sub Rules */}
          <div className="glass-panel p-3 rounded-xl border border-slate-700">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-200 uppercase mb-2">
              <Settings2 className="w-4 h-4 text-cyan-400" />
              <span>Conditional Auto-Substitution Rules</span>
            </div>

            <div className="space-y-2">
              {tactics.autoSubs.map((rule) => (
                <div
                  key={rule.id}
                  onClick={() => toggleAutoSub(rule.id)}
                  className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                    rule.enabled
                      ? 'border-emerald-500/50 bg-emerald-950/30'
                      : 'border-slate-800 bg-slate-900/40 opacity-60'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {rule.type === 'STAMINA_BELOW'
                        ? 'Replace Player if Stamina Drops Below 35%'
                        : 'Bring on Extra Forward if Trailing After Minute 70'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {rule.type === 'STAMINA_BELOW'
                        ? 'Protects match rating and prevents stamina speed debuff'
                        : 'Aggressive attacking override for urgent goals'}
                    </span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${
                      rule.enabled ? 'bg-emerald-400 text-black' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {rule.enabled ? '✓' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bench Roster */}
          <div className="glass-panel p-3 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
              <span>Bench Roster ({bench.length}/7)</span>
              <span className="text-[10px] text-slate-400">Fresh subs maintain 100% stamina</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {bench.map((p) => (
                <div
                  key={p.id}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2"
                >
                  <span className="text-xs font-black text-amber-300">{p.ovr}</span>
                  <div className="truncate">
                    <span className="text-xs font-bold text-white truncate block">
                      {p.displayName}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {p.primaryPosition} • {p.club}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Action: Lock In Tactics */}
      <div className="pt-2 border-t border-slate-800 mt-2">
        <button
          onClick={onFinishTactics}
          className="w-full py-3 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-black shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
        >
          <CheckCircle className="w-4 h-4" />
          <span>{isHost ? 'LOCK IN TACTICS & LAUNCH MATCHDAY' : 'LOCK IN TACTICAL SQUAD'}</span>
        </button>
      </div>
    </div>
  );
};
