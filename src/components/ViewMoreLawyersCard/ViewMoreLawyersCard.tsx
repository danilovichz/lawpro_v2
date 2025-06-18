import React from 'react';
import { ChevronRight } from 'lucide-react';

interface ViewMoreLawyersCardProps {
  legalCategory?: string;
  location?: string;
  onClick: () => void;
}

const ViewMoreLawyersCard: React.FC<ViewMoreLawyersCardProps> = ({
  legalCategory: propsLegalCategory,
  location: propsLocation,
  onClick
}) => {
  const displayLegalCategory = propsLegalCategory || "Legal Services";
  const displayLocation = propsLocation || "your area";

  return (
    <div 
      className="bg-white border border-gray-100 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer w-full max-w-md"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700">
          View more LawPro verified lawyers for <span className="font-medium">{displayLegalCategory}</span> in <span className="font-medium">{displayLocation}</span>
        </span>
        <ChevronRight className="w-4 h-4 text-gray-500" />
      </div>
    </div>
  );
};

export default ViewMoreLawyersCard; 