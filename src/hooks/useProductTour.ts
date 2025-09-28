import { useCallback, useEffect, useState } from 'react';
import { driver, DriveStep, Config } from 'driver.js';

interface TourStep extends DriveStep {
  element: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
  };
}

interface ProductTourConfig {
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
}

export const useProductTour = () => {
  const [isActive, setIsActive] = useState(false);
  const [driverInstance, setDriverInstance] = useState<any>(null);

  // Check if user has completed the tour
  const hasCompletedTour = useCallback(() => {
    return localStorage.getItem('telagri-specialist-tour-completed') === 'true';
  }, []);

  // Mark tour as completed
  const markTourCompleted = useCallback(() => {
    localStorage.setItem('telagri-specialist-tour-completed', 'true');
  }, []);

  // Reset tour completion status
  const resetTour = useCallback(() => {
    localStorage.removeItem('telagri-specialist-tour-completed');
  }, []);

  // Force fix tour elements to ensure they're clickable
  const fixTourElements = useCallback(() => {
    console.log('🎯 Fixing tour elements...');
    
    // Fix overlay
    const overlay = document.querySelector('.driver-overlay');
    if (overlay) {
      (overlay as HTMLElement).style.pointerEvents = 'auto';
      (overlay as HTMLElement).style.zIndex = '999998';
      console.log('✅ Fixed overlay');
    }
    
    // Fix popover
    const popover = document.querySelector('.driver-popover');
    if (popover) {
      (popover as HTMLElement).style.pointerEvents = 'auto';
      (popover as HTMLElement).style.zIndex = '999999';
      (popover as HTMLElement).style.position = 'fixed';
      console.log('✅ Fixed popover');
      
      // Fix all buttons
      const buttons = popover.querySelectorAll('button');
      buttons.forEach((button, index) => {
        (button as HTMLElement).style.pointerEvents = 'auto';
        (button as HTMLElement).style.cursor = 'pointer';
        (button as HTMLElement).style.zIndex = '1000000';
        (button as HTMLElement).style.position = 'relative';
        console.log(`✅ Fixed button ${index + 1}`);
      });
      
      // Fix footer
      const footer = popover.querySelector('.driver-popover-footer');
      if (footer) {
        (footer as HTMLElement).style.pointerEvents = 'auto';
        (footer as HTMLElement).style.zIndex = '1000000';
        console.log('✅ Fixed footer');
      }
    }
    
    // Fix highlighted element
    const highlighted = document.querySelector('.driver-highlighted-element');
    if (highlighted) {
      (highlighted as HTMLElement).style.zIndex = '999997';
      (highlighted as HTMLElement).style.position = 'relative';
      console.log('✅ Fixed highlighted element');
    }
  }, []);

  // Initialize Driver.js with TelAgri branding
  const initializeDriver = useCallback((config: ProductTourConfig) => {
    const driverConfig: Config = {
      showProgress: true,
      progressText: 'Step {{current}} of {{total}}',
      nextBtnText: 'Next →',
      prevBtnText: '← Previous',
      doneBtnText: 'Complete Tour ✓',
      showButtons: ['next', 'previous', 'close'],
      allowClose: true,
      smoothScroll: true,
      animate: false, // Disable animation to prevent conflicts
      popoverClass: 'telagri-tour-popover',
      activeClass: 'telagri-tour-active',
      overlayColor: 'rgba(0, 0, 0, 0.2)', // Very light overlay for smooth experience
      stagePadding: 6,
      stageRadius: 6,
      popoverOffset: 10,
      onDeselected: (element, step, options) => {
        console.log('🎯 Tour step deselected:', step);
        // Remove custom tour classes from the previous element
        if (element) {
          element.classList.remove('telagri-tour-active');
          element.classList.remove('driver-highlighted-element');
        }
      },
      onDestroyed: () => {
        console.log('🎯 Tour destroyed - marking as completed');
        
        // Clean up all tour classes when tour ends
        document.querySelectorAll('.telagri-tour-active, .driver-highlighted-element').forEach(el => {
          el.classList.remove('telagri-tour-active', 'driver-highlighted-element');
        });
        
        markTourCompleted();
        setIsActive(false);
        if (config.onComplete) {
          config.onComplete();
        }
      },
      onHighlighted: (element, step) => {
        console.log('🎯 Tour step highlighted:', step);
        
        // Remove any existing tour classes from all elements first
        document.querySelectorAll('.telagri-tour-active, .driver-highlighted-element').forEach(el => {
          el.classList.remove('telagri-tour-active', 'driver-highlighted-element');
        });
        
        // Add our custom classes to the current element
        if (element) {
          // Ensure classes are added after a small delay to override any conflicting styles
          setTimeout(() => {
            element.classList.add('telagri-tour-active');
            element.classList.add('driver-highlighted-element');
            console.log('✅ Added tour classes to element:', element);
          }, 10);
        }
        
        // Force fix tour elements to be clickable
        setTimeout(() => {
          fixTourElements();
        }, 50);
      },
      steps: config.steps
    };

    const driverObj = driver(driverConfig);
    setDriverInstance(driverObj);
    return driverObj;
  }, [markTourCompleted]);

  // Start the product tour
  const startTour = useCallback((config: ProductTourConfig) => {
    if (isActive) {
      console.log('🎯 Tour already active, skipping');
      return;
    }
    
    console.log('🎯 Starting tour with', config.steps.length, 'steps');
    
    try {
      setIsActive(true);
      const driverObj = initializeDriver(config);
      
      // Add a small delay to ensure DOM is ready
      setTimeout(() => {
        driverObj.drive();
        // Fix elements after tour starts
        setTimeout(() => {
          fixTourElements();
        }, 200);
      }, 100);
    } catch (error) {
      console.error('🎯 Error starting tour:', error);
      setIsActive(false);
    }
  }, [isActive, initializeDriver]);

  // Stop the current tour
  const stopTour = useCallback(() => {
    if (driverInstance) {
      driverInstance.destroy();
      setDriverInstance(null);
    }
    
    // Clean up all tour classes when tour is stopped
    document.querySelectorAll('.telagri-tour-active, .driver-highlighted-element').forEach(el => {
      el.classList.remove('telagri-tour-active', 'driver-highlighted-element');
    });
    
    setIsActive(false);
  }, [driverInstance]);

  // Highlight a specific element
  const highlightElement = useCallback((element: string, options?: { title?: string; description?: string }) => {
    const driverObj = driver({
      showButtons: ['close'],
      allowClose: true,
      popoverClass: 'telagri-tour-popover',
      steps: [{
        element,
        popover: {
          title: options?.title || 'Feature Highlight',
          description: options?.description || 'This is an important feature.',
          side: 'bottom',
          align: 'center'
        }
      }]
    });
    driverObj.drive();
  }, []);

  // Debug function to check if tour elements exist
  const debugTourElements = useCallback((config: ProductTourConfig) => {
    console.log('🎯 Debugging tour elements:');
    config.steps.forEach((step, index) => {
      const element = document.querySelector(step.element);
      console.log(`Step ${index + 1}: ${step.element}`, element ? '✅ Found' : '❌ Not found');
    });
  }, []);

  // Auto-start tour for new users
  const autoStartTour = useCallback((config: ProductTourConfig) => {
    if (!hasCompletedTour()) {
      console.log('🎯 Auto-starting tour for new user');
      // Start tour without debug logging in production
      setTimeout(() => {
        startTour(config);
      }, 1500); // Increased delay to ensure DOM is fully ready
    } else {
      console.log('🎯 Tour already completed, skipping auto-start');
    }
  }, [hasCompletedTour, startTour]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (driverInstance) {
        driverInstance.destroy();
      }
    };
  }, [driverInstance]);

  return {
    isActive,
    startTour,
    stopTour,
    highlightElement,
    autoStartTour,
    hasCompletedTour,
    markTourCompleted,
    resetTour,
    debugTourElements,
    fixTourElements
  };
};

// Predefined tour configurations for different scenarios
export const SPECIALIST_ONBOARDING_TOUR: ProductTourConfig = {
  steps: [
    {
      element: '[data-tour="welcome"]',
      popover: {
        title: '🌾 Welcome to TelAgri Specialist Dashboard',
        description: 'Welcome to your agricultural data analysis workspace! This tour will guide you through all the powerful features available to help you analyze farmer data and generate F-100 reports.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="stats-overview"]',
      popover: {
        title: '📊 Assignment Overview',
        description: 'Here you can see your assignment statistics at a glance: total assignments, work in progress, completed tasks, and items pending review.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: 'nav',
      popover: {
        title: '🗂️ Sidebar Navigation',
        description: 'Your workspace is organized into three main sections: My Assignments (manage your tasks), Data Library (browse uploaded files), and AI Analysis (powerful AI tools). Use this sidebar to navigate between sections.',
        side: 'right',
        align: 'center'
      }
    },
    {
      element: '[data-tour="search-filters"]',
      popover: {
        title: '🔍 Search & Filter Tools',
        description: 'Use these tools to quickly find specific assignments. Search by farmer name, bank, or ID number, and filter by status or phase.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="assignment-card"]',
      popover: {
        title: '📋 Assignment Cards',
        description: 'Each assignment card shows farmer details, current status, and available actions. The status badge shows your progress, and you can click the three-dot menu to update status.',
        side: 'right',
        align: 'center'
      }
    },
    {
      element: '[data-tour="status-dropdown"]',
      popover: {
        title: '⚡ Status Management',
        description: 'Click this menu to update assignment status: move to In Progress when you start work, mark as Completed when done, or request Pending Review from admins.',
        side: 'left',
        align: 'center'
      }
    },
    {
      element: '[data-tour="ai-chat-button"]',
      popover: {
        title: '🤖 AI Co-Pilot',
        description: 'This opens TelAgri\'s powerful AI co-pilot that can analyze uploaded farmer data, answer agricultural questions, and help generate intelligent insights for F-100 reports.',
        side: 'top',
        align: 'center'
      }
    },
    {
      element: '[data-tour="nav-data-library"]',
      popover: {
        title: '📁 Data Library',
        description: 'Click here to browse all uploaded files organized by farmer assignments. You can filter, search, and preview documents and images.',
        side: 'right',
        align: 'center'
      }
    },
    {
      element: '[data-tour="nav-ai-analysis"]',
      popover: {
        title: '🤖 AI Co-Pilot',
        description: 'This is where the magic happens! Access TelAgri\'s powerful AI co-pilot with advanced agricultural analysis capabilities, intelligent insights, and automated report generation for F-100 assessments.',
        side: 'right',
        align: 'center'
      }
    }
  ],
  onComplete: () => {
    console.log('🎉 Specialist onboarding tour completed!');
  }
};

export const DATA_LIBRARY_TOUR: ProductTourConfig = {
  steps: [
    {
      element: '[data-tour="library-filters"]',
      popover: {
        title: '🔍 Advanced File Filtering',
        description: 'Use these powerful filters to find exactly what you need: search by filename, filter by data type (photos, documents, maps), or filter by phase.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="assignment-group"]',
      popover: {
        title: '👤 Farmer Assignment Groups',
        description: 'Files are organized by farmer assignments. Each group shows the farmer name, ID, phase, and file count. Click the arrow to expand/collapse.',
        side: 'right',
        align: 'center'
      }
    },
    {
      element: '[data-tour="file-card"]',
      popover: {
        title: '📄 Smart File Cards',
        description: 'Each file shows a thumbnail (for images), file type icon, name, data type, phase, size, and date. Click anywhere to preview the file.',
        side: 'top',
        align: 'center'
      }
    },
    {
      element: '[data-tour="file-actions"]',
      popover: {
        title: '⚡ Quick File Actions',
        description: 'Use these buttons for quick actions: preview file (eye icon) or download file (download icon). All actions work seamlessly with the secure file system.',
        side: 'left',
        align: 'center'
      }
    }
  ]
};

export const AI_COPILOT_TOUR: ProductTourConfig = {
  steps: [
    {
      element: '[data-tour="copilot-sidebar"]',
      popover: {
        title: '📊 Data & Context Panel',
        description: 'This panel shows all available data for the selected farmer assignment. Files are automatically loaded into the AI context for analysis.',
        side: 'right',
        align: 'center'
      }
    },
    {
      element: '[data-tour="attached-files"]',
      popover: {
        title: '📎 Attached Files',
        description: 'These files are automatically included in your AI conversations. You can remove files from context by clicking the minus icon, or analyze images with the "Analyze" button.',
        side: 'right',
        align: 'center'
      }
    },
    {
      element: '[data-tour="chat-interface"]',
      popover: {
        title: '💬 AI Chat Interface',
        description: 'This is your direct line to the TelAgri AI specialist. Ask questions about the farmer data, request analysis, or get help generating F-100 reports. The AI has full context of all uploaded files.',
        side: 'left',
        align: 'center'
      }
    },
    {
      element: '[data-tour="chat-input"]',
      popover: {
        title: '✍️ Smart Input Area',
        description: 'Type your questions or requests here. The AI understands agricultural terminology and can analyze documents, images, and provide insights for F-100 reporting.',
        side: 'top',
        align: 'center'
      }
    }
  ]
};
