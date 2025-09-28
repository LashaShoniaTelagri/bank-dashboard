import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface FileDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_mime: string;
  file_size_bytes: number;
  created_at: string;
}

interface FileViewerProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileDocument[];
  initialFileIndex: number;
  sectionName?: string;
}

export const FileViewer: React.FC<FileViewerProps> = ({
  isOpen,
  onClose,
  files,
  initialFileIndex,
  sectionName
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialFileIndex);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const currentFile = files[currentIndex];

  // Generate signed URL for a file
  const getFileUrl = useCallback(async (file: FileDocument) => {
    if (fileUrls[file.id]) return fileUrls[file.id];
    
    // Check if file already has a signed URL (for F-100 reports)
    if ((file as any).signedUrl) {
      const signedUrl = (file as any).signedUrl;
      setFileUrls(prev => ({ ...prev, [file.id]: signedUrl }));
      return signedUrl;
    }
    
    setLoading(prev => ({ ...prev, [file.id]: true }));
    
    try {
      // Determine the storage bucket based on file path or type
      const bucket = file.file_path.startsWith('bank/') ? 'f100' : 'farmer-documents';
      
      // Use Edge Function for farmer-documents to handle specialist permissions
      if (bucket === 'farmer-documents') {
        const { data, error } = await supabase.functions.invoke('get-file-url', {
          body: {
            filePath: file.file_path,
            bucket: 'farmer-documents'
          }
        });
        
        if (error) {
          console.error('Edge Function error:', error);
          throw error;
        }
        
        if (data?.signedUrl) {
          setFileUrls(prev => ({ ...prev, [file.id]: data.signedUrl }));
          return data.signedUrl;
        }
      } else {
        // Use direct storage access for other buckets (f100, etc.)
        const { data } = await supabase.storage
          .from(bucket)
          .createSignedUrl(file.file_path, 3600); // 1 hour expiry
        
        if (data?.signedUrl) {
          setFileUrls(prev => ({ ...prev, [file.id]: data.signedUrl }));
          return data.signedUrl;
        }
      }
    } catch (error) {
      console.error('Error generating file URL:', error);
      toast({
        title: "Error",
        description: "Could not load file",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, [file.id]: false }));
    }
    
    return null;
  }, [fileUrls]);

  // Preload current file only (adjacent files loaded on navigation)
  useEffect(() => {
    if (!isOpen || !currentFile) return;

    // Only preload the current file to avoid multiple XHR requests
    getFileUrl(currentFile);
  }, [currentIndex, isOpen, currentFile, getFileUrl]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (currentIndex < files.length - 1) {
            setCurrentIndex(currentIndex + 1);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, files.length, onClose]);

  // Reset index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialFileIndex);
    }
  }, [isOpen, initialFileIndex]);

  const isImage = (mimeType: string) => mimeType.startsWith('image/');
  const isOfficeDocument = (mimeType: string) => {
    return [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/msword', // doc
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
      'application/vnd.ms-powerpoint' // ppt
    ].includes(mimeType);
  };

  const isPdf = (mimeType: string) => mimeType === 'application/pdf';

  const downloadFile = async (file: FileDocument) => {
    console.log('🔽 Download button clicked for:', file.file_name);
    const url = await getFileUrl(file);
    if (url) {
      console.log('📥 Downloading file from URL:', url);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.error('❌ Could not get URL for download');
    }
  };

  const openInNewTab = async (file: FileDocument) => {
    console.log('🔗 Open in new tab clicked for:', file.file_name);
    const url = await getFileUrl(file);
    if (url) {
      console.log('🌐 Opening file in new tab:', url);
      window.open(url, '_blank');
    } else {
      console.error('❌ Could not get URL for new tab');
    }
  };

  const renderFileContent = () => {
    if (!currentFile) return null;

    const fileUrl = fileUrls[currentFile.id];
    const isLoading = loading[currentFile.id];

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      );
    }

    if (!fileUrl) {
      return (
        <div className="flex items-center justify-center h-96 text-white">
          <p>Could not load file</p>
        </div>
      );
    }

    if (isImage(currentFile.file_mime)) {
      return (
        <img
          src={fileUrl}
          alt={currentFile.file_name}
          className="max-w-full max-h-[80vh] object-contain mx-auto"
          onError={() => {
            toast({
              title: "Error",
              description: "Could not load image",
              variant: "destructive",
            });
          }}
        />
      );
    }

    if (isOfficeDocument(currentFile.file_mime)) {
      const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
      return (
        <div className="w-[95vw] h-[85vh] bg-white rounded-lg overflow-hidden">
          <iframe
            src={officeViewerUrl}
            className="w-full h-full border-0"
            title={currentFile.file_name}
            allow="fullscreen"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
            style={{ 
              minHeight: '85vh',
              minWidth: '95vw',
              pointerEvents: 'auto'
            }}
            onError={() => {
              toast({
                title: "Error",
                description: "Could not load Office document in viewer",
                variant: "destructive",
              });
            }}
          />
        </div>
      );
    }

    if (isPdf(currentFile.file_mime)) {
      return (
        <div className="w-[95vw] h-[85vh] bg-white rounded-lg overflow-hidden relative">
          {/* Primary PDF viewer using object tag for better interaction */}
          <object
            data={fileUrl}
            type="application/pdf"
            className="w-full h-full"
            style={{ 
              minHeight: '85vh',
              minWidth: '95vw',
              pointerEvents: 'auto'
            }}
          >
            {/* Fallback iframe if object doesn't work */}
            <iframe
              src={fileUrl}
              className="w-full h-full border-0"
              title={currentFile.file_name}
              allow="fullscreen"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
              style={{ 
                minHeight: '85vh',
                minWidth: '95vw',
                pointerEvents: 'auto'
              }}
            />
          </object>
          
          {/* Fallback message if neither works */}
          <div className="absolute inset-0 flex items-center justify-center bg-muted" style={{ zIndex: -1 }}>
            <div className="text-center text-body-secondary">
              <p className="mb-4">PDF viewer not available</p>
              <button
                onClick={() => downloadFile(currentFile)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      );
    }

    // For other file types, show download option
    return (
      <div className="flex flex-col items-center justify-center h-96 text-white space-y-4">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">{currentFile.file_name}</h3>
          <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
          <div className="flex gap-3">
            <button
              onClick={() => downloadFile(currentFile)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <button
              onClick={() => openInNewTab(currentFile)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const fileViewerContent = (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center" style={{ zIndex: 2147483647 }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 p-4" style={{ pointerEvents: 'auto' }}>
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {sectionName && (
                <>
                  <span className="text-lg font-medium text-muted-foreground">{sectionName}</span>
                  <span className="text-gray-500">-</span>
                </>
              )}
              {currentFile && (
                <>
                  {isImage(currentFile.file_mime) ? (
                    <ImageIcon className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </>
              )}
              <h3 className="text-lg font-semibold">{currentFile?.file_name}</h3>
            </div>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} of {files.length}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {currentFile && (
              <>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    downloadFile(currentFile);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors cursor-pointer"
                  style={{ pointerEvents: 'auto' }}
                  title="Download file"
                >
                  <Download className="h-5 w-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    openInNewTab(currentFile);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors cursor-pointer"
                  style={{ pointerEvents: 'auto' }}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-5 w-5" />
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                onClose();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors cursor-pointer"
              style={{ pointerEvents: 'auto' }}
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      {files.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                setCurrentIndex(currentIndex - 1);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="absolute left-6 top-1/2 transform -translate-y-1/2 z-10 p-4 bg-black bg-opacity-60 hover:bg-opacity-80 hover:scale-110 rounded-full text-white transition-all duration-200 cursor-pointer shadow-lg"
              style={{ pointerEvents: 'auto' }}
              title="Previous file"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}
          {currentIndex < files.length - 1 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                setCurrentIndex(currentIndex + 1);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="absolute right-6 top-1/2 transform -translate-y-1/2 z-10 p-4 bg-black bg-opacity-60 hover:bg-opacity-80 hover:scale-110 rounded-full text-white transition-all duration-200 cursor-pointer shadow-lg"
              style={{ pointerEvents: 'auto' }}
              title="Next file"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>
          {renderFileContent()}
        </div>
      </div>

      {/* File thumbnails/indicators at bottom */}
      {files.length > 1 && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
          <div className="flex space-x-3 bg-black bg-opacity-40 rounded-full px-4 py-2">
            {files.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  setCurrentIndex(index);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className={`w-4 h-4 rounded-full transition-all duration-200 cursor-pointer ${
                  index === currentIndex
                    ? 'bg-white scale-125 shadow-lg'
                    : 'bg-white bg-opacity-50 hover:bg-opacity-75 hover:scale-110'
                }`}
                style={{ pointerEvents: 'auto' }}
                title={`Go to file ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={(e) => {
          // Only close if clicking the background, not any child elements
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      />
    </div>
  );

  // Render in a portal to ensure it's on top of everything
  return typeof document !== 'undefined' && document.body 
    ? createPortal(fileViewerContent, document.body)
    : null;
};
