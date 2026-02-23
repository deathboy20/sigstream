import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Video, Radio } from 'lucide-react';

const MainNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isStreaming = location.pathname === '/' || location.pathname.startsWith('/host') || location.pathname.startsWith('/join');
  const isConference = location.pathname.startsWith('/conference');

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/sigtrack-tube.png" alt="Sig-stream" className="h-8 w-auto" />
          <h1 className="text-xl font-bold text-primary hidden sm:block">Sig-stream</h1>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          <Button
            variant={isStreaming ? 'default' : 'ghost'}
            size="sm"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <Radio className="w-4 h-4" />
            <span className="hidden sm:inline">Streaming</span>
          </Button>
          <Button
            variant={isConference ? 'default' : 'ghost'}
            size="sm"
            onClick={() => navigate('/conference')}
            className="flex items-center gap-2"
          >
            <Video className="w-4 h-4" />
            <span className="hidden sm:inline">Conferencing</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default MainNav;
