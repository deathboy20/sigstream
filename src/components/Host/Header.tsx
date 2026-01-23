import React from 'react';
import { Session } from '../../types/streaming.types';
import { Button } from '../ui/button';
import { Share2, Clock, Users, Copy } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

interface HeaderProps {
  session: Session | null;
  viewerCount: number;
  duration: number;
}

const Header: React.FC<HeaderProps> = ({ session, viewerCount, duration }) => {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const shareUrl = session ? `${window.location.origin}/join/${session.id}` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied to clipboard');
  };

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <img src="/sigtrack-tube.png" alt="Sig-stream" className="h-8 w-auto" />
          <h1 className="text-xl font-bold text-primary">Sig-stream</h1>
        </div>

        {/* Stats & Controls */}
        <div className="flex items-center gap-6">
           {session && (
            <>
                <div className="hidden md:flex items-center gap-6 text-sm font-medium">
                    <div className="flex items-center gap-2 text-muted-foreground bg-secondary/20 px-3 py-1.5 rounded-full">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="tabular-nums">{formatTime(duration)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-muted-foreground bg-secondary/20 px-3 py-1.5 rounded-full">
                    <Users className="h-4 w-4 text-success" />
                    <span>{viewerCount} Viewers</span>
                    </div>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary">
                        <Share2 className="h-4 w-4" />
                        Share Stream
                    </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Share Stream</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center space-y-6 py-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm">
                        <QRCode value={shareUrl} size={180} />
                        </div>
                        <div className="w-full flex gap-2">
                        <div className="flex-1 bg-muted p-2 rounded text-xs font-mono truncate border border-border">
                            {shareUrl}
                        </div>
                        <Button size="icon" variant="outline" onClick={copyToClipboard}>
                            <Copy className="h-4 w-4" />
                        </Button>
                        </div>
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

export default Header;
