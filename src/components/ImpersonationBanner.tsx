import React from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { UserX, Eye, Clock, AlertTriangle } from 'lucide-react';
import { useImpersonation } from '@/hooks/useImpersonation';
import { formatDistanceToNow } from 'date-fns';

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, impersonationSession, endImpersonation, isLoading } = useImpersonation();

  // Add padding to body to prevent content from hiding under banner
  // MUST be before early return to follow Rules of Hooks
  React.useEffect(() => {
    if (isImpersonating) {
      document.body.style.paddingTop = '70px';
    } else {
      document.body.style.paddingTop = '0';
    }
    return () => {
      document.body.style.paddingTop = '0';
    };
  }, [isImpersonating]);

  if (!isImpersonating || !impersonationSession) return null;

  const duration = formatDistanceToNow(new Date(impersonationSession.startedAt), { addSuffix: false });

  return (
    <Alert 
      className="fixed top-0 left-0 right-0 z-[9999] rounded-none border-x-0 border-t-0 border-b-4 border-orange-500 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50 shadow-2xl animate-in slide-in-from-top duration-300"
      style={{ position: 'fixed' }}
    >
      <div className="container mx-auto flex items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Warning Icon */}
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>

          {/* Main Message */}
          <AlertDescription className="flex items-center gap-3 flex-wrap text-sm font-medium text-orange-900 dark:text-orange-100 min-w-0">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 flex-shrink-0" />
              <span className="font-semibold">Admin Mode:</span>
              <span className="hidden sm:inline">Viewing as</span>
            </div>
            
            {/* Target User Info */}
            <Badge variant="secondary" className="bg-orange-200 dark:bg-orange-900 text-orange-900 dark:text-orange-100 font-semibold">
              {impersonationSession.targetEmail}
            </Badge>

            <span className="hidden md:inline text-orange-700 dark:text-orange-300">•</span>
            
            <Badge variant="outline" className="hidden md:flex border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300">
              {impersonationSession.targetRole}
            </Badge>

            {/* Duration */}
            <div className="hidden lg:flex items-center gap-1.5 text-orange-700 dark:text-orange-300">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs">{duration}</span>
            </div>

            {/* Reason */}
            {impersonationSession.reason && impersonationSession.reason !== 'Admin support' && (
              <div className="hidden xl:flex items-center gap-1.5 text-orange-600 dark:text-orange-400 text-xs">
                <span>•</span>
                <span className="italic truncate max-w-[200px]">"{impersonationSession.reason}"</span>
              </div>
            )}
          </AlertDescription>
        </div>

        {/* Exit Button */}
        <Button
          onClick={endImpersonation}
          disabled={isLoading}
          size="sm"
          variant="destructive"
          className="flex-shrink-0 bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800 text-white font-semibold shadow-md"
        >
          <UserX className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Exit</span>
          <span className="sm:hidden">Exit</span>
        </Button>
      </div>
    </Alert>
  );
};

export default ImpersonationBanner;

