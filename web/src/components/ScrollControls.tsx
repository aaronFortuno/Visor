interface ScrollControlsProps {
  onSendKey: (key: string) => void;
}

export function ScrollControls({ onSendKey }: ScrollControlsProps) {
  const scrollUpFast = () => { for (let i = 0; i < 5; i++) onSendKey("\x1b[5~"); };
  const scrollUp = () => onSendKey("\x1b[5~");
  const scrollDown = () => onSendKey("\x1b[6~");
  const scrollDownFast = () => { for (let i = 0; i < 5; i++) onSendKey("\x1b[6~"); };

  return (
    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10 hidden md:flex">
      <button onClick={scrollUpFast} className="w-9 h-9 flex items-center justify-center rounded-full bg-visor-card/90 border border-visor-border text-gray-400 hover:text-white active:bg-visor-accent/30 backdrop-blur-sm shadow-md" title="Scroll up fast">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l7.5-7.5 7.5 7.5m-15 6l7.5-7.5 7.5 7.5" /></svg>
      </button>
      <button onClick={scrollUp} className="w-9 h-9 flex items-center justify-center rounded-full bg-visor-card/90 border border-visor-border text-gray-400 hover:text-white active:bg-visor-accent/30 backdrop-blur-sm shadow-md" title="Page Up">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
      </button>
      <button onClick={scrollDown} className="w-9 h-9 flex items-center justify-center rounded-full bg-visor-card/90 border border-visor-border text-gray-400 hover:text-white active:bg-visor-accent/30 backdrop-blur-sm shadow-md" title="Page Down">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      </button>
      <button onClick={scrollDownFast} className="w-9 h-9 flex items-center justify-center rounded-full bg-visor-card/90 border border-visor-border text-gray-400 hover:text-white active:bg-visor-accent/30 backdrop-blur-sm shadow-md" title="Scroll down fast">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 5.25l-7.5 7.5-7.5-7.5m15 6l-7.5 7.5-7.5-7.5" /></svg>
      </button>
    </div>
  );
}
