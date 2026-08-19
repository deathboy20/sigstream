import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useSigtrackContext } from '../hooks/useSigtrackContext';
import { api } from '../services/api';
import { toast } from 'sonner';

interface CreateMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'instant' | 'scheduled';
  hostName: string;
  hostId: string;
  onCreated: (meetingId: string, kind: 'instant' | 'scheduled') => void;
}

const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({
  open,
  onOpenChange,
  mode,
  hostName,
  hostId,
  onCreated,
}) => {
  const ctx = useSigtrackContext();
  const teams = ctx.authorizedTeams.length > 0 ? ctx.authorizedTeams : ctx.allOrgTeams;
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string[]>(() => {
    const initial = new Set<string>(ctx.meetPrivilege.autoIncludeTeamIds);
    if (ctx.teamId) initial.add(ctx.teamId);
    return Array.from(initial);
  });
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      ctx.meetPrivilege.autoIncludeTeamIds.forEach((id) => next.add(id));
      if (ctx.teamId) next.add(ctx.teamId);
      return Array.from(next);
    });
  }, [ctx.teamId, ctx.meetPrivilege.autoIncludeTeamIds]);

  const selectedTeams = useMemo(
    () => teams.filter((t) => selected.includes(t.id)),
    [teams, selected]
  );

  const toggleTeam = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setMatrix((m) => {
        const copy = { ...m };
        if (!next.includes(id)) delete copy[id];
        next.forEach((tid) => {
          copy[tid] = (copy[tid] || next).filter((x) => next.includes(x));
          if (!copy[tid].includes(tid)) copy[tid] = [...copy[tid], tid];
        });
        return copy;
      });
      return next;
    });
  };

  const toggleComm = (fromId: string, toId: string) => {
    setMatrix((prev) => {
      const current = prev[fromId] || selected;
      const has = current.includes(toId);
      return {
        ...prev,
        [fromId]: has ? current.filter((x) => x !== toId) : [...current, toId],
      };
    });
  };

  const handleCreate = async () => {
    if (!ctx.canCreateMeeting) {
      toast.error('Your team is not allowed to create meetings');
      return;
    }
    let scheduledAt = Date.now();
    if (mode === 'scheduled') {
      if (!scheduledLocal) {
        toast.error('Choose a date and time');
        return;
      }
      scheduledAt = new Date(scheduledLocal).getTime();
      if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
        toast.error('Scheduled time must be in the future');
        return;
      }
    }
    const participatingTeamIds = selected.length > 0
      ? selected
      : (ctx.teamId ? [ctx.teamId] : []);
    if (mode === 'scheduled' && participatingTeamIds.length === 0 && teams.length > 0) {
      toast.error('Select at least one participating team so invitees can see this meeting');
      return;
    }
    setBusy(true);
    try {
      const id = Math.random().toString(36).substring(2, 12);
      await api.createMeeting({
        id,
        hostId,
        hostName,
        title: title.trim() || `${hostName}'s Meeting`,
        scheduledAt,
        status: mode === 'scheduled' ? 'scheduled' : 'active',
        participatingTeamIds,
        allowedJoinTeamIds: participatingTeamIds,
        communicationMatrix: matrix,
        autoIncludeTeamIds: ctx.meetPrivilege.autoIncludeTeamIds,
      });
      toast.success(mode === 'scheduled' ? 'Meeting scheduled' : 'Meeting created');
      onOpenChange(false);
      onCreated(id, mode);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create meeting');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl bg-white text-slate-900 border-slate-200 dark:bg-[#0D1525] dark:border-white/10 dark:text-white p-4 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'scheduled' ? 'Schedule a meeting' : 'Start a meeting'}</DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-zinc-400">
            Choose participating teams and who can talk to whom. Your team ({ctx.teamName || 'none'}) is included by default.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label htmlFor="meeting-title" className="text-xs uppercase tracking-wide text-slate-500 dark:text-zinc-400">Meeting name</label>
            <Input
              id="meeting-title"
              name="meetingTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${hostName}'s Meeting`}
              className="mt-1 bg-slate-50 border-slate-200 text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-white"
            />
          </div>
          {mode === 'scheduled' && (
            <div>
              <label htmlFor="meeting-start" className="text-xs uppercase tracking-wide text-slate-500 dark:text-zinc-400">Start time</label>
              <Input
                id="meeting-start"
                name="scheduledAt"
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
                className="mt-1 bg-slate-50 border-slate-200 text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
            </div>
          )}
          <div>
            <label className="text-xs uppercase tracking-wide text-zinc-400">Participating teams</label>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {teams.length === 0 && (
                <p className="text-sm text-zinc-500">No teams loaded. The meeting will use your current team only.</p>
              )}
              {teams.map((team) => (
                <label key={team.id} className="flex items-center gap-2 text-sm bg-white/5 rounded-lg px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(team.id)}
                    onChange={() => toggleTeam(team.id)}
                  />
                  <span className="truncate">{team.name}</span>
                </label>
              ))}
            </div>
          </div>
          {selectedTeams.length > 1 && (
            <div>
              <label className="text-xs uppercase tracking-wide text-zinc-400">Who can communicate</label>
              <div className="mt-2 overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr>
                      <th className="text-left p-1 text-zinc-500">From \ To</th>
                      {selectedTeams.map((t) => (
                        <th key={t.id} className="p-1 text-zinc-400 font-normal truncate max-w-[72px]">{t.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTeams.map((from) => (
                      <tr key={from.id}>
                        <td className="p-1 text-zinc-300 truncate max-w-[100px]">{from.name}</td>
                        {selectedTeams.map((to) => (
                          <td key={to.id} className="p-1 text-center">
                            <input
                              type="checkbox"
                              checked={(matrix[from.id] || selected).includes(to.id)}
                              onChange={() => toggleComm(from.id, to.id)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-700 dark:text-white">Cancel</Button>
            <Button onClick={handleCreate} disabled={busy} className="bg-[#3B6EF8] hover:bg-[#2E56C9]">
              {busy ? 'Saving…' : mode === 'scheduled' ? 'Schedule' : 'Continue'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateMeetingModal;
