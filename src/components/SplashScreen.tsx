export default function SplashScreen({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <img src="/images/SIGTRACK.png" alt="SIGTRACK" className="h-32 w-28 animate-spin" />
    </div>
  );
}
