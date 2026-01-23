import React, { useState } from 'react';
import { Viewer } from '../../types/streaming.types';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Users, UserPlus, Check, X, Trash2, Shield } from 'lucide-react';

interface UnifiedSidebarProps {
  viewers: Viewer[];
  pendingRequests: Viewer[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRemoveViewer: (id: string) => void;
}

const UnifiedSidebar: React.FC<UnifiedSidebarProps> = ({
  viewers,
  pendingRequests,
  onApprove,
  onReject,
  onRemoveViewer,
}) => {
  const [activeTab, setActiveTab] = useState<'viewers' | 'pending'>('viewers');

  // Filter only approved viewers for the viewers list
  const approvedViewers = viewers.filter(v => v.status === 'approved');

  return (
    <Card className="h-full flex flex-col border-border bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
          <button
            onClick={() => setActiveTab('viewers')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'viewers'
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-4 w-4" />
            Viewers
            <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {approvedViewers.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'pending'
                ? 'bg-background text-warning shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Pending
            {pendingRequests.length > 0 && (
              <span className="ml-1 text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded-full animate-pulse">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="p-4 space-y-3">
            {activeTab === 'viewers' ? (
              // Viewers List
              approvedViewers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No active viewers</p>
                </div>
              ) : (
                approvedViewers.map((viewer) => (
                  <div
                    key={viewer.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border hover:border-primary/20 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        {viewer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{viewer.name}</p>
                        <p className="text-xs text-muted-foreground">Online</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                      onClick={() => onRemoveViewer(viewer.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )
            ) : (
              // Pending Requests
              pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No pending requests</p>
                </div>
              ) : (
                pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-3 rounded-lg bg-background/50 border border-warning/20 hover:border-warning/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center text-warning font-bold text-xs">
                          {request.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">{request.name}</p>
                          <p className="text-xs text-muted-foreground">Requested to join</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-success hover:bg-success/90 text-white h-8"
                        onClick={() => onApprove(request.id)}
                      >
                        <Check className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-8"
                        onClick={() => onReject(request.id)}
                      >
                        <X className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default UnifiedSidebar;
