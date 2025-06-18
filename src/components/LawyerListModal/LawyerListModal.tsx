import React, { useState, useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import LawyerPreviewCard from '../LawyerPreviewCard/LawyerPreviewCard';
import LawyerDetailModal from '../LawyerDetailModal/LawyerDetailModal';
import LawyerDetailedCard from '../LawyerDetailedCard/LawyerDetailedCard';
import { Lawyer } from '../../lib/lawyerService';

interface LawyerListModalProps {
  isOpen: boolean;
  onClose: () => void;
  county?: string;
  state?: string;
  caseType?: string;
  lawyers?: Lawyer[]; // Add lawyers prop
}

const LawyerListModal: React.FC<LawyerListModalProps> = ({
  isOpen,
  onClose,
  county,
  state,
  caseType,
  lawyers = [] // Default to empty array
}) => {
  const [selectedLawyerData, setSelectedLawyerData] = useState<Lawyer | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDetailedCardOpen, setIsDetailedCardOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setIsLoading(true);
      
      // Set loading to false if we already have lawyers data
      if (lawyers && lawyers.length > 0) {
        setIsLoading(false);
      } else {
        // Simulate loading if no data provided (fallback)
        const timer = setTimeout(() => {
          setIsLoading(false);
        }, 1000);
        return () => clearTimeout(timer);
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, lawyers]);

  const handleLawyerClick = (lawyer: Lawyer) => {
    setSelectedLawyerData(lawyer);
    setIsDetailModalOpen(true);
  };

  const handleConnectClick = (e: React.MouseEvent, lawyer: Lawyer) => {
    e.stopPropagation();
    setSelectedLawyerData(lawyer);
    setIsDetailedCardOpen(true);
  };

  if (!isOpen) return null;

  // Get location to display based on actual lawyer data first, fallback to props
  const getDisplayLocation = (): string => {
    // If we have lawyers, use the location from the first lawyer for consistency
    if (lawyers.length > 0) {
      const firstLawyer = lawyers[0];
      if (firstLawyer.county && firstLawyer.state) {
        return `${firstLawyer.county}, ${firstLawyer.state}`;
      } else if (firstLawyer.county) {
        return firstLawyer.county;
      } else if (firstLawyer.state) {
        return firstLawyer.state;
      }
    }
    
    // Fallback to provided props
    if (county && state) {
      return `${county}, ${state}`;
    } else if (county) {
      return county;
    } else if (state) {
      return state;
    }
    
    return "your area";
  };

  const displayLocation = getDisplayLocation();
  const displayCaseType = caseType || "Legal Services";

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-white md:bg-black md:bg-opacity-50 md:items-center md:justify-center">
        <div 
          className="bg-white w-full h-full md:rounded-lg md:shadow-lg md:max-w-2xl md:max-h-[90vh] md:h-auto flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-gray-200 p-4 flex items-center">
            <button className="p-1 mr-3" onClick={onClose}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-medium truncate pr-2">
              Lawyers for {displayCaseType} in {displayLocation}
            </h2>
            <button className="p-1 ml-auto md:hidden" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                <p className="text-gray-600">Loading lawyers...</p>
              </div>
            ) : lawyers.length > 0 ? (
              <div className="space-y-4">
                {lawyers.map(lawyer => (
                  <LawyerPreviewCard 
                    key={lawyer.id}
                    name={lawyer.name || "Attorney"}
                    specialty={lawyer.specialty || "Legal Professional"}
                    profileImageUrl={lawyer.profileImageUrl || "/placeholder-attorney.jpg"} 
                    rating={lawyer.rating || 4.8}
                    firm={lawyer.lawFirm || "Law Firm"}
                    location={displayLocation}
                    caseType={displayCaseType}
                    onClick={() => handleLawyerClick(lawyer)}
                    onConnectClick={(e) => handleConnectClick(e, lawyer)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8">
                <p className="text-gray-600 text-center">
                  No lawyers found for {displayCaseType} in {displayLocation}. Please try another location or broaden your search.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Lawyer Detail Modal - passing selected lawyer data */}
      {selectedLawyerData && (
        <LawyerDetailModal 
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          caseType={caseType}
          county={selectedLawyerData.county}
          state={selectedLawyerData.state}
          lawyer={selectedLawyerData}
        />
      )}

      {/* Lawyer Detailed Card Modal */}
      {selectedLawyerData && (
        <LawyerDetailedCard 
          isOpen={isDetailedCardOpen}
          onClose={() => setIsDetailedCardOpen(false)}
          name={selectedLawyerData.name || "Attorney Representative"}
          specialty={selectedLawyerData.specialty || "Legal Professional"}
          profileImageUrl={selectedLawyerData.profileImageUrl || "/placeholder-attorney.jpg"}
          rating={selectedLawyerData.rating || 4.8}
          firm={selectedLawyerData.lawFirm || "Law Firm"}
          location={getDisplayLocation()}
          caseType={displayCaseType}
          county={selectedLawyerData.county || county || "County"}
          state={selectedLawyerData.state || state || "State"}
          phoneNumber={selectedLawyerData.phoneNumber || ""}
          email={selectedLawyerData.email || ""}
          website={selectedLawyerData.website || ""}
          lawyerId={selectedLawyerData.id}
          onConnectClick={() => {
            console.log("Connect clicked from detailed card");
          }}
        />
      )}
    </>
  );
};

export default LawyerListModal; 