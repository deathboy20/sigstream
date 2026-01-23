import React from 'react';
import { Info, Clock } from 'lucide-react';
import { Session } from '../../types/streaming.types';

interface SessionInfoProps {
  session: Session;
}

const SessionInfo: React.FC<SessionInfoProps> = ({ session }) => {
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700 text-white">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">StreamHub Pro</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Info className="h-4 w-4" />
          <span>Session: <span className="font-mono text-gray-200">{session.id.slice(0, 8)}...</span></span>
        </div>

        {session.isActive ? (
             <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-500 text-xs font-bold animate-pulse flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> LIVE
             </span>
        ) : (
            <span className="px-2 py-1 rounded-full bg-gray-700 text-gray-400 text-xs font-bold">
                WAITING
            </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="h-4 w-4" />
          <span>Expires in: 24h</span>
        </div>
      </div>
    </div>
  );
};

export default SessionInfo;
