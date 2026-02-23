// import React, { useState } from 'react';
// import { Link, Copy, Check, QrCode } from 'lucide-react';
// import { QRCodeSVG } from 'qrcode.react';

// interface SharePanelProps {
//   sessionId: string;
//   viewerCount: number;
//   duration: number;
// }

// const SharePanel: React.FC<SharePanelProps> = ({
//   sessionId,
//   viewerCount,
//   duration,
// }) => {
//   const [copied, setCopied] = useState(false);
//   const [showQr, setShowQr] = useState(false);
  
//   // Assuming the viewer page is at /session/:sessionId
//   const shareUrl = `${window.location.origin}/session/${sessionId}`;

//   const handleCopy = async () => {
//     try {
//       await navigator.clipboard.writeText(shareUrl);
//       setCopied(true);
//       setTimeout(() => setCopied(false), 2000);
//     } catch (err) {
//       console.error('Failed to copy:', err);
//     }
//   };

//   return (
//     <div className="bg-gray-800 text-white rounded-lg shadow-md border border-gray-700">
//       <div className="flex items-center gap-2 text-lg font-semibold p-4 border-b border-gray-700">
//         <Link className="h-5 w-5 text-purple-400" />
//         Share Stream
//       </div>
//       <div className="p-2 space-y-2">
//         {/* Copy Link */}
//         <div className="flex gap-2">
//           <input
//             value={shareUrl}
//             readOnly
//             className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none"
//           />
//           <button
//             onClick={handleCopy}
//             className="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white px-3 py-2 rounded-md"
//           >
//             {copied ? (
//               <Check className="h-4 w-4 text-green-500" />
//             ) : (
//               <Copy className="h-4 w-4" />
//             )}
//           </button>
//         </div>

//         {/* Action Buttons */}
//         <div className="flex gap-2">
//           <button
//             onClick={handleCopy}
//             className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-md border border-gray-600 transition-colors"
//           >
//             <Copy className="h-4 w-4" />
//             Copy Link
//           </button>
          
//           <button 
//             onClick={() => setShowQr(!showQr)}
//             className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-md border border-gray-600 transition-colors"
//           >
//             <QrCode className="h-4 w-4" />
//             {showQr ? 'Hide QR' : 'Show QR'}
//           </button>
//         </div>
        
//         {showQr && (
//             <div className="flex justify-center p-4 bg-white rounded-lg">
//                 <QRCodeSVG value={shareUrl} size={150} />
//             </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default SharePanel;

import React, { useState } from 'react';
import { Link, Copy, Check, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface SharePanelProps {
  sessionId: string;
  viewerCount: number;
  duration: number;
}

const SharePanel: React.FC<SharePanelProps> = ({ sessionId }) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const shareUrl = `${window.location.origin}/session/${sessionId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="bg-gray-800 text-white rounded-xl shadow-md border border-gray-700 w-full max-w-lg mx-auto overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center gap-2 text-lg font-semibold p-4 border-b border-gray-700">
        <Link className="h-5 w-5 text-purple-400" />
        Share Stream
      </div>

      <div className="p-4 space-y-4">

        {/* URL Box */}
        <div className="flex items-center gap-2">
          <div className="flex-1 overflow-hidden">
            <input
              value={shareUrl}
              readOnly
              className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-300 truncate focus:outline-none"
            />
          </div>

          <button
            onClick={handleCopy}
            className="shrink-0 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white p-2 rounded-md transition"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-md border border-gray-600 transition"
          >
            <Copy className="h-4 w-4" />
            Copy
          </button>

          <button
            onClick={() => setShowQr(!showQr)}
            className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-md border border-gray-600 transition"
          >
            <QrCode className="h-4 w-4" />
            {showQr ? 'Hide QR' : 'Show QR'}
          </button>
        </div>

        {/* QR Code */}
        {showQr && (
          <div className="w-full flex justify-center bg-white rounded-lg p-4">
            <div className="max-w-[180px] w-full">
              <QRCodeSVG
                value={shareUrl}
                className="w-full h-auto"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SharePanel;
