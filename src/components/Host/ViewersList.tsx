import React from 'react';
import { Users, Trash2, Wifi, WifiOff } from 'lucide-react';
import { Viewer } from '../../types/streaming.types';

interface ViewersListProps {
  viewers: Viewer[];
  onRemoveViewer: (viewerId: string) => void;
}

const ViewersList: React.FC<ViewersListProps> = ({ viewers, onRemoveViewer }) => {
  const approvedViewers = viewers.filter(v => v.status === 'approved');

  return (
    <div className="bg-gray-800 text-white rounded-lg shadow-md border border-gray-700 h-full flex flex-col">
      <div className="flex items-center gap-2 text-lg font-semibold p-4 border-b border-gray-700">
        <Users className="h-5 w-5 text-blue-400" />
        Viewers ({approvedViewers.length})
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto min-h-[200px]">
        {approvedViewers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
            <Users className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No active viewers</p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvedViewers.map(viewer => (
              <div
                key={viewer.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-900 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-medium">
                      {viewer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 bg-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{viewer.name}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Wifi className="h-3 w-3 text-green-500" />
                      <span>Connected</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveViewer(viewer.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-800 rounded transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewersList;
