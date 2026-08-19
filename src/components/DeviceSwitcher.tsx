import React, { useState } from 'react';
import { ChevronDown, Video, Mic } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { MediaDevice } from '../types/streaming.types';

interface DeviceSwitcherProps {
  devices: MediaDevice[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  type: 'video' | 'audio';
  disabled?: boolean;
  compact?: boolean;
}

const DeviceSwitcher: React.FC<DeviceSwitcherProps> = ({
  devices,
  selectedDeviceId,
  onSelectDevice,
  type,
  disabled = false,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const icon = type === 'video' ? Video : Mic;
  const Icon = icon;
  const label = type === 'video' ? 'Camera' : 'Microphone';

  if (devices.length === 0) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          disabled={disabled}
          className="text-white border-slate-600 hover:bg-slate-700 flex items-center gap-2 h-9 sm:h-10 px-2 sm:px-3"
          title={`Switch ${label}`}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="hidden sm:inline text-xs sm:text-sm">{label}</span>
          <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-48 sm:w-56 bg-slate-800/95 border-slate-700 text-white"
      >
        <DropdownMenuLabel className="text-xs sm:text-sm">Select {label}</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-700" />

        {devices.length > 0 ? (
          devices.map((device) => (
            <DropdownMenuItem
              key={device.deviceId}
              onClick={() => {
                onSelectDevice(device.deviceId);
                setOpen(false);
              }}
              className={`text-xs sm:text-sm cursor-pointer flex items-center gap-2 ${
                device.deviceId === selectedDeviceId
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'hover:bg-slate-700/50'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  device.deviceId === selectedDeviceId ? 'bg-blue-400' : 'bg-slate-600'
                }`}
              />
              <span className="truncate">{device.label}</span>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled className="text-xs text-gray-500">
            No devices available
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DeviceSwitcher;
