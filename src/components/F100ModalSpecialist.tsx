import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { FileText, ExternalLink, X, Maximize2, Minimize2 } from 'lucide-react';

interface F100ModalSpecialistProps {
  farmerId: string;
  farmerName: string;
  farmerIdNumber: string;
  phase: number;
  crop: string;
  docUrl?: string;
}

export const F100ModalSpecialist: React.FC<F100ModalSpecialistProps> = ({
  farmerId,
  farmerName,
  farmerIdNumber,
  phase,
  crop,
  docUrl
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Only enable when an assignment-specific URL is provided
  const hasDoc = !!(docUrl && docUrl.trim().length > 0);
  const baseUrl = docUrl?.trim() || '';

  const withEnglish = (url: string) => {
    try {
      const u = new URL(url);
      if (!u.searchParams.has('hl')) u.searchParams.set('hl', 'en');
      return u.toString();
    } catch {
      return url.includes('?') ? `${url}&hl=en` : `${url}?hl=en`;
    }
  };

  const googleDocsUrl = withEnglish(baseUrl);

  const handleOpenExternal = () => {
    window.open(googleDocsUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            disabled={!hasDoc}
            className={`w-full md:w-auto h-9 px-4 border-0 font-medium text-sm rounded-lg group relative overflow-hidden ${
              hasDoc
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {/* Animated background overlay */}
            {hasDoc && (
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 opacity-0 
                           group-hover:opacity-100 transition-opacity duration-300" />
            )}
            
            {/* Content */}
            <div className="relative flex items-center gap-2">
              <FileText className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
              F-100
            </div>
            
            {/* Subtle shine effect */}
            {hasDoc && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent 
                           -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
            )}
          </Button>
        </DialogTrigger>

        {hasDoc && (
        <DialogContent 
          className={`p-0 gap-0 flex flex-col transition-all duration-300 ${
            isFullscreen 
              ? 'max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] rounded-none' 
              : 'max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] rounded-lg'
          }`}
        >
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 border-b">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold text-heading-primary truncate">
                  F-100 Report - {farmerName}
                </DialogTitle>
                <p className="text-sm text-body-secondary truncate">
                  ID: {farmerIdNumber} | {crop} - Phase {phase}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap ml-2 mr-7 mt-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenExternal}
                className="text-muted-foreground hover:text-foreground"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="text-muted-foreground hover:text-foreground"
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              {/* Remove extra close button - Dialog provides its own close control */}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <iframe
              src={googleDocsUrl}
              className="w-full h-full border-0 rounded-md"
              title={`F-100 Report for ${farmerName}`}
              allow="clipboard-write"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>
        </DialogContent>
        )}
      </Dialog>
    </>
  );
};
