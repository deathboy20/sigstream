import React from 'react';
import { Button } from './ui/button';

interface MeetErrorBoundaryProps {
  children: React.ReactNode;
}

interface MeetErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class MeetErrorBoundary extends React.Component<MeetErrorBoundaryProps, MeetErrorBoundaryState> {
  state: MeetErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): MeetErrorBoundaryState {
    return { hasError: true, message: error.message || 'The meeting view hit an unexpected error.' };
  }

  componentDidCatch(error: Error) {
    console.error('MeetRoom crashed', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="h-[100dvh] bg-[#202124] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#1a1b1e] p-6 text-center space-y-4">
          <h2 className="text-xl font-semibold">Meeting view recovered</h2>
          <p className="text-sm text-zinc-400">
            Something interrupted the room layout. Your call is still available — reload the meeting view to continue.
          </p>
          <p className="text-xs text-zinc-500 break-words">{this.state.message}</p>
          <Button className="w-full" onClick={() => window.location.reload()}>
            Rejoin meeting
          </Button>
        </div>
      </div>
    );
  }
}
