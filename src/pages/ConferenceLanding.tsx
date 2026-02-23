import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Video, Users, MessageSquare, Share2, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useConference } from '../hooks/useConference';
import { toast } from 'sonner';

const ConferenceLanding: React.FC = () => {
  const navigate = useNavigate();
  const { createRoom } = useConference();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [mode, setMode] = useState<'open' | 'moderated'>('open');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) {
      toast.error('Please enter a room name');
      return;
    }

    setIsLoading(true);
    try {
      const newRoom = await createRoom(roomName, mode);
      setIsCreateDialogOpen(false);
      setRoomName('');
      navigate(`/conference/${newRoom.id}`);
    } catch (error) {
      toast.error('Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim()) {
      toast.error('Please enter a room ID');
      return;
    }
    navigate(`/conference/${roomId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-slate-950 to-background">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block mb-4">
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2">
                <Video className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-500">Professional Video Conferencing</span>
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Connect with anyone, <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">anywhere</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
              Sig-stream Conferencing brings your team together with crystal-clear video, real-time chat, and seamless screen sharing. Support up to 50+ participants in one room.
            </p>

            {/* Quick Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/50"
              >
                <Plus className="w-5 h-5 mr-2" />
                Start Conference
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setIsJoinDialogOpen(true)}
                className="border-gray-600 text-white hover:bg-gray-900"
              >
                <Video className="w-5 h-5 mr-2" />
                Join Conference
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Powerful Features</h2>
            <p className="text-gray-300 text-lg">Everything you need for professional video conferencing</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature Cards */}
            {[
              {
                icon: Users,
                title: 'Multi-Party Conferencing',
                description: 'Host meetings with up to 50+ participants simultaneously with crystal-clear HD video',
                color: 'blue'
              },
              {
                icon: MessageSquare,
                title: 'Real-Time Chat',
                description: 'Send messages, share files, and collaborate with all participants during your conference',
                color: 'purple'
              },
              {
                icon: Share2,
                title: 'Screen Sharing',
                description: 'Share your screen with HD quality for presentations, demos, and collaborative work',
                color: 'pink'
              },
              {
                icon: Lock,
                title: 'Moderated Access',
                description: 'Control who joins your conference with open or moderated access modes',
                color: 'green'
              },
              {
                icon: Video,
                title: 'HD Video Quality',
                description: 'Enjoy high-definition video with adaptive bitrate for optimal performance',
                color: 'orange'
              },
              {
                icon: CheckCircle2,
                title: 'Reliability',
                description: 'Enterprise-grade reliability with secure peer-to-peer tunneling',
                color: 'cyan'
              }
            ].map((feature) => (
              <Card 
                key={feature.title}
                className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-slate-500/20"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white text-lg">{feature.title}</CardTitle>
                    </div>
                    <feature.icon className="w-6 h-6 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-300 text-sm">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-gray-300 text-lg">Get started in just 3 simple steps</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                number: '1',
                title: 'Create a Room',
                description: 'Click "Start Conference" and give your room a name. Choose open or moderated access.'
              },
              {
                number: '2',
                title: 'Invite Participants',
                description: 'Share the room ID with anyone you want to join. They can join instantly with one click.'
              },
              {
                number: '3',
                title: 'Start Conferencing',
                description: 'Enable your camera and microphone, then start collaborating with real-time video and chat.'
              }
            ].map((step) => (
              <div
                key={step.number}
                className="relative bg-slate-800/50 rounded-lg p-8 border border-slate-700 hover:border-slate-600 transition-all"
              >
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {step.number}
                </div>
                <h3 className="text-white font-semibold text-lg mt-4 mb-2">{step.title}</h3>
                <p className="text-gray-300">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-12">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
            <p className="text-gray-300 text-lg mb-8">
              Create your first conference room and start connecting with your team today. No setup required.
            </p>
            <Button
              size="lg"
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/50"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Conference
            </Button>
          </div>
        </div>
      </section>

      {/* Create Conference Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Conference Room</DialogTitle>
            <DialogDescription className="text-gray-300">
              Set up your conference room with a name and access control mode
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRoom} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-gray-200">Conference Name</label>
              <Input
                placeholder="e.g., Team Standup, Client Presentation"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                autoFocus
                className="bg-slate-700 border-slate-600 text-white placeholder-gray-500 mt-2 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-200 block mb-3">Access Mode</label>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 border-slate-600 hover:border-blue-500 transition-colors" style={{borderColor: mode === 'open' ? '#3b82f6' : ''}}>
                  <input
                    type="radio"
                    name="mode"
                    value="open"
                    checked={mode === 'open'}
                    onChange={(e) => setMode(e.target.value as 'open' | 'moderated')}
                    className="w-4 h-4 mt-0.5 accent-blue-500"
                  />
                  <div>
                    <div className="text-gray-200 font-medium">Open Room</div>
                    <div className="text-sm text-gray-400">Anyone with the room ID can join immediately</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 border-slate-600 hover:border-purple-500 transition-colors" style={{borderColor: mode === 'moderated' ? '#a855f7' : ''}}>
                  <input
                    type="radio"
                    name="mode"
                    value="moderated"
                    checked={mode === 'moderated'}
                    onChange={(e) => setMode(e.target.value as 'open' | 'moderated')}
                    className="w-4 h-4 mt-0.5 accent-purple-500"
                  />
                  <div>
                    <div className="text-gray-200 font-medium">Moderated Room</div>
                    <div className="text-sm text-gray-400">You approve who joins the conference</div>
                  </div>
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? 'Creating...' : 'Create Conference'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Join Conference Dialog */}
      <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Join Conference Room</DialogTitle>
            <DialogDescription className="text-gray-300">
              Enter the room ID provided by the conference host
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleJoinRoom} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-gray-200">Room ID</label>
              <Input
                placeholder="Paste the room ID here"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                autoFocus
                className="bg-slate-700 border-slate-600 text-white placeholder-gray-500 mt-2 focus:border-green-500"
              />
              <p className="text-xs text-gray-400 mt-2">You'll be asked to enter your name before joining</p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsJoinDialogOpen(false)}
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Join Conference
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConferenceLanding;
