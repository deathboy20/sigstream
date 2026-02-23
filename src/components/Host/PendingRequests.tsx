import React from 'react';
import { Bell, Check, X, Clock } from 'lucide-react';
import { Viewer } from '../../types/streaming.types';

interface PendingRequestsProps {
  requests: Viewer[];
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

const PendingRequests: React.FC<PendingRequestsProps> = ({
  requests,
  onApprove,
  onReject,
}) => {
  return (
    <div className="bg-gray-800 text-white rounded-lg shadow-md border border-gray-700 h-full flex flex-col">
      <div className="flex items-center gap-2 text-lg font-semibold p-4 border-b border-gray-700">
        <Bell className="h-5 w-5 text-amber-500" />
        Pending
        {requests.length > 0 && (
          <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-700 text-xs text-white">
            {requests.length}
          </span>
        )}
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto min-h-[150px]">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 py-6">
            <Clock className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No pending requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(request => (
              <div
                key={request.id}
                className="p-3 rounded-lg bg-gray-900 border border-gray-700 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{request.name}</p>
                      <p className="text-xs text-gray-400">
                        Requested {new Date(request.joinedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onApprove(request.id)}
                    className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm py-1.5 rounded"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => onReject(request.id)}
                    className="flex-1 flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-1.5 rounded border border-gray-600"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingRequests;
