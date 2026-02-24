// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { useAuth } from '../contexts/AuthContext';
// import { Button } from '../components/ui/button';
// import { Input } from '../components/ui/input';
// import { Card, CardContent } from '../components/ui/card';
// import { 
//   Video, 
//   Keyboard, 
//   Calendar, 
//   Plus, 
//   LogOut, 
//   Settings, 
//   HelpCircle, 
//   MessageSquare,
//   Globe,
//   Loader2
// } from 'lucide-react';
// import { toast } from 'sonner';
// import { api } from '../services/api';

// const MeetDashboard: React.FC = () => {
//   const { user, loginWithGoogle, logout, loading } = useAuth();
//   const navigate = useNavigate();
//   const [meetingCode, setMeetingCode] = useState('');
//   const [isCreating, setIsCreating] = useState(false);

//   const handleStartMeeting = async () => {
//     if (!user) {
//       toast.error('Please sign in first');
//       return;
//     }
    
//     setIsCreating(true);
//     const id = Math.random().toString(36).substring(2, 12);
    
//     try {
//       await api.createMeeting({
//         id,
//         hostId: user.uid,
//         hostName: user.displayName || 'Anonymous',
//         title: `${user.displayName}'s Meeting`
//       });
//       navigate(`/meet/${id}`);
//     } catch (error) {
//       console.error("Failed to create meeting", error);
//       toast.error("Failed to start meeting. Please try again.");
//     } finally {
//       setIsCreating(false);
//     }
//   };

//   const handleJoinMeeting = () => {
//     if (!meetingCode.trim()) {
//       toast.error('Please enter a meeting code');
//       return;
//     }
//     navigate(`/meet/${meetingCode}`);
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-background">
//         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
//       </div>
//     );
//   }

//   if (!user) {
//     return (
//       <div className="min-h-screen bg-background flex flex-col">
//         {/* Simple Header for Login Page */}
//         <header className="h-16 px-6 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-50">
//           <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
//             <img src="/sigtrack-tube.png" alt="Soko Meet" className="h-8 w-auto" />
//             <span className="text-xl font-semibold text-foreground">Soko Meet</span>
//           </div>
//           <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
//             <span className="hidden sm:inline">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
//             <Button variant="ghost" onClick={loginWithGoogle} className="text-primary hover:bg-primary/10">Sign In</Button>
//           </div>
//         </header>

//         <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 px-6 py-12 max-w-7xl mx-auto w-full">
//           {/* Left Side - Content */}
//           <div className="flex-1 space-y-8 text-center lg:text-left max-w-xl">
//             <div className="space-y-6">
//               <h1 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight text-foreground leading-tight">
//                 Premium video meetings. <br />
//                 <span className="text-muted-foreground">Now free for everyone.</span>
//               </h1>
//               <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
//                 We re-engineered the service we built for secure business meetings, <span className="font-medium text-foreground">Soko Meet</span>, to make it free and available for all.
//               </p>
//             </div>

//             <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
//               <Button 
//                 onClick={loginWithGoogle} 
//                 size="lg" 
//                 className="h-14 px-8 gap-4 text-lg font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all rounded-full w-full sm:w-auto"
//               >
//                 <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-6 w-6 bg-white p-1 rounded-full" />
//                 Sign in with Google
//               </Button>
//               <Button 
//                 variant="outline" 
//                 size="lg" 
//                 className="h-14 px-8 text-lg font-medium rounded-full w-full sm:w-auto border-2"
//                 onClick={() => navigate('/')}
//               >
//                 Learn more
//               </Button>
//             </div>

//             <div className="pt-8 border-t border-border w-full">
//               <p className="text-sm text-muted-foreground">
//                 <span className="text-primary font-medium cursor-pointer hover:underline">Learn more</span> about Soko Meet's security and privacy.
//               </p>
//             </div>
//           </div>

//           {/* Right Side - Visual Illustration */}
//           <div className="flex-1 w-full max-w-lg lg:max-w-xl">
//             <div className="relative aspect-square rounded-3xl bg-gradient-to-br from-primary/5 to-primary/20 flex items-center justify-center overflow-hidden border border-primary/10 group">
//               {/* Animated Background Elements */}
//               <div className="absolute top-10 right-10 w-20 h-20 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
//               <div className="absolute bottom-10 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700" />
              
//               <div className="relative z-10 flex flex-col items-center text-center p-8 space-y-6">
//                 <div className="relative">
//                   <div className="w-48 h-48 rounded-full bg-white shadow-2xl flex items-center justify-center p-6">
//                     <img src="/sigtrack-tube.png" alt="Soko Meet" className="h-32 w-auto object-contain" />
//                   </div>
//                   <div className="absolute -top-4 -right-4 w-12 h-12 rounded-2xl bg-success flex items-center justify-center shadow-lg text-white transform rotate-12">
//                     <Globe className="h-6 w-6" />
//                   </div>
//                   <div className="absolute -bottom-4 -left-4 w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg text-white transform -rotate-12">
//                     <Plus className="h-6 w-6" />
//                   </div>
//                 </div>
                
//                 <div className="space-y-2">
//                   <h3 className="text-2xl font-semibold text-foreground">Secure, high-quality meetings</h3>
//                   <p className="text-muted-foreground max-w-xs mx-auto">
//                     Host up to 100 participants with no time limits on our free tier.
//                   </p>
//                 </div>

//                 <div className="flex gap-2">
//                   <div className="h-2 w-12 rounded-full bg-primary" />
//                   <div className="h-2 w-2 rounded-full bg-primary/20" />
//                   <div className="h-2 w-2 rounded-full bg-primary/20" />
//                 </div>
//               </div>
//             </div>
//           </div>
//         </main>

//         {/* Footer */}
//         <footer className="py-8 px-6 border-t border-border mt-auto">
//           <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
//             <div className="flex items-center gap-6">
//               <span className="hover:text-foreground cursor-pointer transition-colors">Privacy</span>
//               <span className="hover:text-foreground cursor-pointer transition-colors">Terms</span>
//               <span className="hover:text-foreground cursor-pointer transition-colors">Help</span>
//             </div>
//             <div>
//               © {new Date().getFullYear()} Soko Video Solutions. All rights reserved.
//             </div>
//           </div>
//         </footer>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-background flex flex-col">
//       {/* Header */}
//       <header className="h-16 px-6 border-b border-border flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-50">
//         <div className="flex items-center gap-4">
//           <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
//             <img src="/sigtrack-tube.png" alt="Soko Meet" className="h-8 w-auto" />
//             <span className="text-xl font-semibold text-foreground">Soko Meet</span>
//           </div>
//         </div>

//         <div className="flex items-center gap-4">
//           <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground mr-4">
//             {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
//           </div>
//           <Button variant="ghost" size="icon" className="text-muted-foreground">
//             <HelpCircle className="h-5 w-5" />
//           </Button>
//           <Button variant="ghost" size="icon" className="text-muted-foreground">
//             <MessageSquare className="h-5 w-5" />
//           </Button>
//           <Button variant="ghost" size="icon" className="text-muted-foreground">
//             <Settings className="h-5 w-5" />
//           </Button>
          
//           <div className="h-8 w-px bg-border mx-2" />
          
//           <div className="flex items-center gap-3">
//             <div className="flex flex-col items-end hidden sm:flex">
//               <span className="text-sm font-medium leading-none">{user.displayName}</span>
//               <span className="text-xs text-muted-foreground leading-tight">{user.email}</span>
//             </div>
//             <div className="h-9 w-9 rounded-full overflow-hidden border border-border">
//               <img src={user.photoURL || ''} alt={user.displayName || 'User'} className="h-full w-full object-cover" />
//             </div>
//             <Button variant="ghost" size="icon" onClick={logout} className="text-destructive">
//               <LogOut className="h-5 w-5" />
//             </Button>
//           </div>
//         </div>
//       </header>

//       {/* Main Content */}
//       <main className="flex-1 container mx-auto px-6 py-12 md:py-24 flex flex-col md:flex-row items-center justify-between gap-12">
//         <div className="flex-1 max-w-xl space-y-8">
//           <div className="space-y-4 text-center md:text-left">
//             <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
//               Premium video meetings. Now free for everyone.
//             </h1>
//             <p className="text-xl text-muted-foreground">
//               We re-engineered the service we built for secure business meetings, Soko Meet, to make it free and available for all.
//             </p>
//           </div>

//           <div className="flex flex-col sm:flex-row items-center gap-4">
//             <Button 
//               size="lg" 
//               className="h-12 px-6 gap-2 w-full sm:w-auto text-base" 
//               onClick={handleStartMeeting}
//               disabled={isCreating}
//             >
//               {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
//               New meeting
//             </Button>
            
//             <div className="flex items-center gap-3 w-full sm:w-auto">
//               <div className="relative flex-1 sm:w-64">
//                 <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
//                 <Input 
//                   placeholder="Enter a code or link" 
//                   className="pl-10 h-12 text-base focus-visible:ring-primary"
//                   value={meetingCode}
//                   onChange={(e) => setMeetingCode(e.target.value)}
//                   onKeyDown={(e) => e.key === 'Enter' && handleJoinMeeting()}
//                 />
//               </div>
//               <Button 
//                 variant="ghost" 
//                 size="lg" 
//                 className={`h-12 text-base font-semibold ${meetingCode ? 'text-primary' : 'text-muted-foreground cursor-not-allowed'}`}
//                 disabled={!meetingCode}
//                 onClick={handleJoinMeeting}
//               >
//                 Join
//               </Button>
//             </div>
//           </div>

//           <div className="h-px bg-border w-full" />

//           <div className="flex items-center gap-2 text-sm">
//             <span className="text-primary font-medium underline cursor-pointer">Learn more</span>
//             <span className="text-muted-foreground">about Soko Meet</span>
//           </div>
//         </div>

//         {/* Right side - Illustration/Carousel */}
//         <div className="flex-1 w-full max-w-lg hidden lg:block">
//           <Card className="border-none bg-transparent shadow-none">
//             <CardContent className="p-0 flex flex-col items-center text-center space-y-6">
//               <div className="relative w-72 h-72 rounded-full bg-primary/5 flex items-center justify-center overflow-hidden">
//                 <img src="/sigtrack-tube.png" alt="Soko Meet" className="h-48 w-auto opacity-30 group-hover:opacity-50 transition-opacity" />
//                 <div className="absolute inset-0 border-2 border-primary/10 rounded-full scale-90" />
//                 <div className="absolute inset-0 border-2 border-primary/5 rounded-full scale-100" />
//               </div>
//               <div className="space-y-2">
//                 <h3 className="text-2xl font-semibold">Get a link you can share</h3>
//                 <p className="text-muted-foreground">
//                   Click <span className="font-semibold">New meeting</span> to get a link you can send to people you want to meet with
//                 </p>
//               </div>
//               <div className="flex gap-2">
//                 <div className="h-2 w-2 rounded-full bg-primary" />
//                 <div className="h-2 w-2 rounded-full bg-muted" />
//                 <div className="h-2 w-2 rounded-full bg-muted" />
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       </main>
//     </div>
//   );
// };

// export default MeetDashboard;
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, LogOut, Settings, HelpCircle, MessageSquare,
  Loader2, Shield, Zap, Users, Video, Link2, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';

/* ─── Live clock ──────────────────────────────────────────── */
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const FEATURES = [
  { icon: Shield, label: 'End-to-end encrypted' },
  { icon: Zap,    label: 'Ultra-low latency'    },
  { icon: Users,  label: '100 participants'      },
];

/* ════════════════════════════════════════════════════════════ */
const MeetDashboard: React.FC = () => {
  const { user, loginWithGoogle, logout, loading } = useAuth();
  const navigate = useNavigate();
  const now      = useClock();
  const [code, setCode]         = useState('');
  const [creating, setCreating] = useState(false);
  const [userMeetings, setUserMeetings] = useState<any[]>([]);
  const [countdown, setCountdown] = useState(10);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  // Redirect countdown for unauthenticated users
  useEffect(() => {
    if (!loading && !user) {
      const timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      toast.info(`Redirecting to home in ${countdown} seconds...`, {
        id: 'auth-redirect',
        duration: 10000,
      });

      return () => clearInterval(timer);
    }
  }, [user, loading]);

  // Handle actual redirect
  useEffect(() => {
    if (!user && countdown === 0) {
      navigate('/');
    }
  }, [countdown, user, navigate]);

  // Update toast on countdown change
  useEffect(() => {
    if (!user && countdown > 0) {
      toast.info(`Redirecting to home in ${countdown} seconds...`, {
        id: 'auth-redirect',
      });
    }
  }, [countdown, user]);

  // Fetch user meetings
  useEffect(() => {
    if (user) {
      api.listUserMeetings(user.uid)
        .then(meetings => setUserMeetings(Array.isArray(meetings) ? meetings : []))
        .catch(err => console.error("Failed to fetch meetings", err));
    }
  }, [user]);

  /* inject Outfit font once */
  useEffect(() => {
    if (document.getElementById('meet-gfont')) return;
    const l = document.createElement('link');
    l.id = 'meet-gfont'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap';
    document.head.appendChild(l);
  }, []);

  const handleStartMeeting = async () => {
    if (!user) { toast.error('Please sign in first'); return; }
    setCreating(true);
    const id = Math.random().toString(36).substring(2, 12);
    try {
      await api.createMeeting({
        id, hostId: user.uid,
        hostName: user.displayName || 'Anonymous',
        title: `${user.displayName}'s Meeting`,
      });
      navigate(`/meet/${id}`);
    } catch {
      toast.error('Failed to start meeting. Please try again.');
    } finally { setCreating(false); }
  };

  const handleJoinMeeting = () => {
    if (!code.trim()) { toast.error('Please enter a meeting code'); return; }
    navigate(`/meet/${code.trim()}`);
  };

  /* ── shared font style ── */
  const rootFont: React.CSSProperties = { fontFamily: "'Outfit', sans-serif" };

  /* ════ LOADING ════ */
  if (loading) return (
    <div style={rootFont}
      className="min-h-screen flex items-center justify-center bg-[#070B14]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-[#3B6EF8]/20 border-t-[#3B6EF8] animate-spin" />
        <span className="text-[#4B5563] text-sm font-medium tracking-widest uppercase">Loading</span>
      </div>
    </div>
  );

  /* ════ NOT LOGGED IN ════ */
  if (!user) return (
    <div style={rootFont} className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8 bg-[#0D1525] p-10 rounded-3xl border border-white/[0.08] shadow-2xl">
        <div className="flex justify-center">
           <div className="flex justify-center">
            <img src="/sigtrack-tube.png" alt="Soko" className="h-20 w-auto mb-4" />
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-bold text-white">Login Required</h2>
          <p className="text-[#4B5563]">Please sign in to your account to access SOKO Meet features.</p>
          <p className="text-[#3B6EF8] text-sm font-medium">Returning to home in {countdown}s...</p>
        </div>
        <div className="flex flex-col gap-3">
          <Button 
            onClick={loginWithGoogle} 
            size="lg" 
            className="w-full h-14 rounded-2xl bg-[#3B6EF8] hover:bg-[#2E56C9] text-white font-bold text-lg shadow-lg shadow-[#3B6EF8]/20"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6 mr-3 bg-white p-0.5 rounded-full" />
            Sign in with Google
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate('/')} 
            className="w-full h-12 rounded-2xl border-white/10 text-white hover:bg-white/5 transition-colors"
          >
            Back to Home
          </Button>
        </div>

      </div>
    </div>
  );

  /* ════ LOGGED IN DASHBOARD ════ */
  return (
    <div style={rootFont} className="min-h-screen bg-[#070B14] flex flex-col overflow-hidden">

      {/* ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-60 -right-60 w-[700px] h-[700px] rounded-full bg-[#3B6EF8]/8 blur-[140px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-[#06B6D4]/6 blur-[100px]" />
      </div>

      {/* ── HEADER ── */}
      <header className="relative z-50 h-16 px-4 sm:px-6 flex items-center justify-between
        border-b border-white/[0.06] bg-[#070B14]/80 backdrop-blur-xl sticky top-0">

        {/* logo */}
        <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
        <div className="flex justify-center">
            <img src="/sigtrack-tube.png" alt="Soko" className="h-10 w-auto mb-2" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight group-hover:text-[#3B6EF8] transition-colors">
            Soko Meet
          </span>
        </button>

        {/* right side */}
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="hidden md:block text-sm text-[#4B5563] font-medium mr-2">
            {timeStr} · {dateStr}
          </span>

          {/* icon buttons */}
          {[HelpCircle, MessageSquare, Settings].map((Icon, i) => (
            <button key={i}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#4B5563]
                hover:bg-white/[0.06] hover:text-white transition-all duration-150">
              <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
            </button>
          ))}

          <div className="w-px h-6 bg-white/[0.08] mx-1" />

          {/* avatar + info */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-semibold text-white/90">{user.displayName}</span>
              <span className="text-[11px] text-[#4B5563]">{user.email}</span>
            </div>
            <Avatar className="w-9 h-9 border border-white/10 ring-2 ring-white/5 flex-shrink-0">
              <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'User'} className="object-cover" />
              <AvatarFallback className="bg-[#3B6EF8] text-white text-xs font-bold">
                {user.displayName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <button onClick={logout}
              className="w-9 h-9 rounded-xl flex items-center justify-center
                bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all duration-150">
              <LogOut style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-5xl flex flex-col items-center gap-10">

          {/* greeting */}
          <div className="text-center">
            <p className="text-[#4B5563] text-sm font-medium mb-1">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              {user.displayName?.split(' ')[0]} 👋
            </h1>
          </div>

          {/* ACTION CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">

            {/* NEW MEETING */}
            <button onClick={handleStartMeeting} disabled={creating}
              className="group relative flex flex-col items-start p-6 rounded-2xl text-left
                bg-gradient-to-br from-[#3B6EF8] to-[#2040C0] overflow-hidden
                border border-[#3B6EF8]/50 hover:border-[#5B8AFF]
                shadow-2xl shadow-[#3B6EF8]/20 hover:shadow-[#3B6EF8]/40
                hover:-translate-y-0.5 active:translate-y-0
                transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed">
              {/* shimmer */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0
                group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/5" />
              <div className="absolute -right-2 -bottom-2 w-20 h-20 rounded-full bg-white/5" />

              <div className="relative z-10 w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center mb-4
                group-hover:bg-white/20 transition-colors">
                {creating
                  ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                  : <Plus className="w-5 h-5 text-white" />
                }
              </div>
              <span className="relative z-10 text-white font-bold text-lg leading-tight">
                {creating ? 'Creating…' : 'Start Instant Meeting'}
              </span>
              <span className="relative z-10 text-blue-200/70 text-sm mt-1">
                Start a meeting right now
              </span>
            </button>

            {/* SCHEDULE MEETING */}
            <button 
              onClick={() => toast.info("Scheduling feature coming soon!")}
              className="group relative flex flex-col items-start p-6 rounded-2xl text-left
                bg-[#0D1525] border border-white/[0.08] hover:border-[#3B6EF8]/50
                shadow-xl shadow-black/40 hover:-translate-y-0.5 active:translate-y-0
                transition-all duration-200">
              <div className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center mb-4
                group-hover:bg-[#3B6EF8]/10 transition-colors">
                <Calendar className="w-5 h-5 text-[#3B6EF8]" />
              </div>
              <span className="text-white font-bold text-lg leading-tight mb-1">Schedule Meeting</span>
              <span className="text-[#4B5563] text-sm mt-1">Plan a future meeting</span>
            </button>

            {/* JOIN MEETING */}
            <div className="flex flex-col p-6 rounded-2xl
              bg-[#0D1525] border border-white/[0.08] hover:border-white/[0.14]
              shadow-xl shadow-black/40 transition-all duration-200">
              <div className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center mb-4">
                <Link2 className="w-5 h-5 text-[#3B6EF8]" />
              </div>
              <span className="text-white font-bold text-lg leading-tight mb-1">Join with Code</span>
              <span className="text-[#4B5563] text-sm mb-5">Enter a code or link</span>

              <div className="flex gap-2 mt-auto">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleJoinMeeting()}
                    placeholder="abc-defg-hij"
                    className="w-full h-10 px-4 rounded-xl text-sm font-medium text-white
                      bg-white/[0.06] border border-white/[0.10] placeholder:text-[#374151]
                      focus:outline-none focus:border-[#3B6EF8]/60 focus:bg-[#3B6EF8]/5
                      transition-all duration-150"
                  />
                </div>
                <button
                  onClick={handleJoinMeeting}
                  disabled={!code.trim()}
                  className="h-10 px-5 rounded-xl bg-white/[0.08] text-white text-sm font-bold
                    hover:bg-[#3B6EF8] hover:shadow-lg hover:shadow-[#3B6EF8]/30
                    disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/[0.08]
                    transition-all duration-200 whitespace-nowrap">
                  Join
                </button>
              </div>
            </div>
          </div>

          {/* UPCOMING MEETINGS */}
          {userMeetings.length > 0 && (
            <div className="w-full max-w-4xl mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Your Meetings</h2>
                <span className="text-xs text-[#4B5563] uppercase tracking-widest font-bold">Upcoming</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {userMeetings.slice(0, 4).map((m: any) => (
                  <div key={m.id} 
                    className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.15] transition-all group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white group-hover:text-[#3B6EF8] transition-colors">{m.title}</span>
                      <span className="text-[10px] text-[#4B5563]">{new Date(m.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <code className="text-xs text-[#3B6EF8] bg-[#3B6EF8]/10 px-2 py-1 rounded-lg">{m.id}</code>
                      <button 
                        onClick={() => navigate(`/meet/${m.id}`)}
                        className="text-xs font-bold text-white bg-white/[0.05] hover:bg-[#3B6EF8] px-4 py-1.5 rounded-xl transition-all">
                        Join
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FEATURE STRIP */}
          <div className="flex flex-wrap justify-center gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label}
                className="flex items-center gap-2 px-4 py-2 rounded-full
                  bg-white/[0.03] border border-white/[0.07] text-[#6B7280] text-xs font-medium">
                <Icon className="w-3.5 h-3.5 text-[#3B6EF8]" />
                {label}
              </div>
            ))}
          </div>

          {/* help link */}
          <p className="text-[#374151] text-sm">
            New to Soko Meet?{' '}
            <button onClick={() => navigate('/')}
              className="text-[#3B6EF8] font-semibold hover:underline underline-offset-2 transition-colors">
              Learn how it works
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};

export default MeetDashboard;