import React from 'react';
import { Conference } from '../../types/streaming.types';
import { Button } from '../ui/button';
import { Share2, Copy, Users } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

interface ConferenceHeaderProps {
  room: Conference | null;
  participantCount: number;
}

const ConferenceHeader: React.FC<ConferenceHeaderProps> = ({ room, participantCount }) => {
  const shareUrl = room ? `${window.location.origin}/join/conference/${room.id}` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Conference link copied to clipboard');
  };

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <img src="/sigtrack-tube.png" alt="Sig-stream" className="h-8 w-auto" />
          <div>
            <h1 className="text-lg font-bold text-primary">{room?.name || 'Conference'}</h1>
            <p className="text-xs text-muted-foreground">{room?.id.substring(0, 8)}...</p>
          </div>
        </div>

        {/* Stats & Controls */}
        <div className="flex items-center gap-6">
          {room && (
            <>
              <div className="hidden md:flex items-center gap-6 text-sm font-medium">
                <div className="flex items-center gap-2 text-muted-foreground bg-secondary/20 px-3 py-1.5 rounded-full">
                  <Users className="w-4 h-4" />
                  <span>{participantCount} participants</span>
                </div>
              </div>

              {/* Share Button */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Share Conference</span>
                    <span className="sm:hidden">Share</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Share Conference Room</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* QR Code */}
                    <div className="flex justify-center">
                      <div className="bg-white p-4 rounded-lg">
                        <QRCode
                          value={shareUrl}
                          size={200}
                          level="H"
                        />
                      </div>
                    </div>

                    {/* Share URL */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Conference Link</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={shareUrl}
                          readOnly
                          className="flex-1 px-3 py-2 bg-muted border border-input rounded-md text-sm font-mono"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={copyToClipboard}
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </Button>
                      </div>
                    </div>

                    {/* Room ID */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Conference ID</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={room.id}
                          readOnly
                          className="flex-1 px-3 py-2 bg-muted border border-input rounded-md text-sm font-mono"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(room.id);
                            toast.success('Conference ID copied');
                          }}
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Share this link or Conference ID with others to invite them to join this conference.
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default ConferenceHeader;
