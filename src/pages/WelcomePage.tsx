import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Video, ArrowRight, LogOut, User as UserIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loginWithGoogle, logout, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background relative">
      {/* Auth Header */}
      <div className="absolute top-6 right-6 flex items-center gap-4">
        {!loading && (
          user ? (
            <div className="flex items-center gap-3 bg-card/50 backdrop-blur-sm p-1.5 pr-4 rounded-full border border-border">
              <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-primary/20">
                <img src={user.photoURL || ''} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
              </div>
              <span className="text-sm font-medium hidden sm:inline">{user.displayName}</span>
              <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={loginWithGoogle} className="rounded-full px-6">
              Sign In
            </Button>
          )
        )}
      </div>

      <div className="max-w-4xl w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="flex justify-center">
            <img src="/sigtrack-tube.png" alt="Soko" className="h-20 w-auto mb-4" />
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">
            Welcome to <span className="text-primary">Soko</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose your experience. Go live with high-quality streaming or host professional meetings with Soko Meet.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          {/* Streaming Option */}
          <Card className="group hover:border-primary/50 transition-all duration-300 cursor-pointer overflow-hidden bg-card/50 backdrop-blur-sm" onClick={() => navigate('/stream')}>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl">Streaming</CardTitle>
              <CardDescription className="text-base">
                Go live, share your screen, and interact with your audience in real-time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full group-hover:gap-3 transition-all">
                {user ? 'Start Streaming' : 'Enter Streaming'} <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Soko Meet Option */}
          <Card className="group hover:border-success/50 transition-all duration-300 cursor-pointer overflow-hidden bg-card/50 backdrop-blur-sm" 
            onClick={() => {
              if (user) {
                navigate('/meet');
              } else {
                loginWithGoogle().then(() => navigate('/meet')).catch(() => {});
              }
            }}>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl">Soko Meet</CardTitle>
              <CardDescription className="text-base">
                Professional video conferencing with screen sharing and scheduled meetings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full group-hover:bg-success group-hover:text-white transition-all">
                {user ? 'Go to Dashboard' : 'Enter Soko Meet'} <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="pt-12 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Soko Video Solutions. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
