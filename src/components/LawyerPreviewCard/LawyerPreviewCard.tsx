import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  BadgeCheck, 
  ArrowRight, 
  Star
} from 'lucide-react';

interface LawyerPreviewCardProps {
  name: string;
  specialty: string;
  profileImageUrl: string;
  rating: number;
  onClick: () => void;
  onConnectClick: (e: React.MouseEvent) => void;
  firm?: string;
  location?: string;
  caseType?: string;
}

const LawyerPreviewCard: React.FC<LawyerPreviewCardProps> = ({
  name = "Frank",
  specialty = "Criminal Defense Attorney", 
  profileImageUrl = "/placeholder-attorney.jpg",
  rating = 4.5,
  onClick,
  onConnectClick,
  firm = "The Wieczorek Law Firm",
  location = "Hamilton County",
  caseType = "DUI Cases"
}) => {
  // Create dynamic title based on case type
  const getDynamicTitle = () => {
    if (caseType) {
      // Extract the actual practice area from caseType
      if (caseType.toLowerCase().includes('dui') || caseType.toLowerCase().includes('criminal')) {
        return `Top Rated Criminal Lawyer in ${location}`;
      } else if (caseType.toLowerCase().includes('personal injury') || caseType.toLowerCase().includes('car accident')) {
        return `Top Rated Personal Injury Specialist in ${location}`;
      } else if (caseType.toLowerCase().includes('family')) {
        return `Top Rated Family Lawyer in ${location}`;
      } else if (caseType.toLowerCase().includes('real estate')) {
        return `Top Rated Real Estate Attorney in ${location}`;
      }
    }
    
    // Fallback to specialty-based title
    if (specialty) {
      if (specialty.toLowerCase().includes('criminal')) {
        return `Top Rated Criminal Lawyer in ${location}`;
      } else if (specialty.toLowerCase().includes('personal injury')) {
        return `Top Rated Personal Injury Specialist in ${location}`;
      } else if (specialty.toLowerCase().includes('family')) {
        return `Top Rated Family Lawyer in ${location}`;
      } else if (specialty.toLowerCase().includes('real estate')) {
        return `Top Rated Real Estate Attorney in ${location}`;
      }
    }
    
    // Default fallback
    return `Top Rated Legal Professional in ${location}`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow w-full max-w-md mx-auto">
      <div className="p-4">
        {/* Header Section - Horizontal Layout */}
        <div className="flex items-start gap-4 mb-4">
          {/* Avatar with Star Overlay */}
          <div className="relative flex-shrink-0">
            <div className="relative">
              {/* Main avatar container with white border */}
              <div className="w-16 h-16 rounded-full bg-white border-[3px] border-white shadow-sm flex items-center justify-center">
                <Avatar className="h-[58px] w-[58px]">
                  <AvatarImage src={profileImageUrl} alt={name} />
                  <AvatarFallback className="bg-[#C0D5FF] text-[#122368] text-sm font-semibold">
                    {name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              {/* Star Rating Overlay */}
              <div className="absolute -top-1 -right-1">
                <div className="relative w-5 h-5">
                  {/* Outer star with white border */}
                  <Star className="w-5 h-5 text-white fill-white stroke-white stroke-[2px]" />
                  {/* Inner star with blue color */}
                  <Star className="absolute inset-0 w-5 h-5 text-[#C0D5FF] fill-[#C0D5FF]" />
                </div>
              </div>
            </div>
          </div>

          {/* Content Section - Grows to fill space */}
          <div className="flex-1 min-w-0">
            {/* Available Now Badge */}
            <Badge className="bg-[#E0FAEC] text-[#05B11F] hover:bg-[#E0FAEC] px-2 py-1 text-xs font-medium inline-flex items-center mb-2">
              <div className="w-1.5 h-1.5 bg-[#1FC16B] rounded-full mr-1"></div>
              Available Now
            </Badge>

            {/* Title - Dynamic based on case type, single location */}
            <h3 className="text-base font-medium text-[#171717] leading-tight mb-2 line-clamp-2">
              {getDynamicTitle()}
            </h3>
            
            {/* Firm Name with Verified Icon */}
            <div className="flex items-center gap-1 mb-2">
              <span className="text-sm font-semibold text-[rgba(26,35,126,0.6)] uppercase tracking-wide truncate">
                {firm.toUpperCase()}
              </span>
              <BadgeCheck className="w-4 h-4 text-[#05B11F] flex-shrink-0" />
            </div>

            {/* Rating */}
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-[#F6B51E] text-[#F6B51E]" />
              <span className="text-sm font-medium text-gray-700">{rating.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Learn More Button */}
        <div onClick={(e) => e.stopPropagation()}>
          <Button 
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium border border-gray-200"
            onClick={onConnectClick}
          >
            <span>Learn More</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LawyerPreviewCard; 