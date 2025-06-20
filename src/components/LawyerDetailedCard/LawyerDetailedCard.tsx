import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  BadgeCheck, 
  Phone,
  Shield,
  MessageCircle,
  Play,
  Star,
  X,
  Globe,
  Mail,
  MapPin
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CaseResult {
  id: string;
  case_type: string;
  case_description: string;
  outcome: string;
  outcome_color: string;
  display_order: number;
}

interface Review {
  id: string;
  reviewer_name: string;
  rating: number;
  review_text: string;
  review_date: string;
  display_order: number;
}

interface LawyerDetailedCardProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  specialty: string;
  profileImageUrl: string;
  rating: number;
  firm?: string;
  location?: string;
  caseType?: string;
  county?: string;
  state?: string;
  phoneNumber?: string;
  email?: string;
  website?: string;
  lawyerId?: string;
  onConnectClick?: () => void;
}

const LawyerDetailedCard: React.FC<LawyerDetailedCardProps> = ({
  isOpen,
  onClose,
  name = "Frank",
  specialty = "Criminal Defense Attorney", 
  profileImageUrl = "/placeholder-attorney.jpg",
  rating = 4.8,
  firm = "THE WIECZOREK LAW FIRM",
  location = "Your Area",
  caseType = "Legal Cases",
  county = "Hamilton County",
  state = "Nevada",
  phoneNumber,
  email,
  website,
  lawyerId,
  onConnectClick
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [caseResults, setCaseResults] = useState<CaseResult[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingCaseResults, setLoadingCaseResults] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Helper function to properly capitalize location text
  const capitalizeLocation = (location?: string): string => {
    if (!location) return '';
    return location.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };

  // Extract practice area from specialty to avoid location duplication
  const getPracticeArea = (specialty: string) => {
    // If specialty already contains location, extract just the practice area
    const locationPatterns = [
      /\sin\s.+$/i,  // " in Location"
      /\s.+\sspecialist$/i,  // "Location Specialist"
      /\s.+\slegal\sspecialist$/i  // "Location Legal Specialist"
    ];
    
    let practiceArea = specialty;
    for (const pattern of locationPatterns) {
      if (pattern.test(practiceArea)) {
        practiceArea = practiceArea.replace(pattern, '').trim();
        break;
      }
    }
    
    // Common mappings for better titles
    if (practiceArea.toLowerCase().includes('criminal')) {
      return 'Criminal Defense Attorney';
    } else if (practiceArea.toLowerCase().includes('personal injury')) {
      return 'Personal Injury Specialist';
    } else if (practiceArea.toLowerCase().includes('family')) {
      return 'Family Law Attorney';
    } else if (practiceArea.toLowerCase().includes('real estate')) {
      return 'Real Estate Attorney';
    } else if (practiceArea.toLowerCase().includes('legal')) {
      return 'Legal Professional';
    }
    
    return practiceArea || 'Legal Professional';
  };

  // Fetch case results from Supabase
  const fetchCaseResults = async () => {
    if (!lawyerId) return;
    
    setLoadingCaseResults(true);
    try {
      const { data, error } = await supabase
        .from('lawyer_case_results')
        .select('*')
        .eq('lawyer_id', lawyerId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching case results:', error);
      } else {
        setCaseResults(data || []);
      }
    } catch (error) {
      console.error('Error fetching case results:', error);
    } finally {
      setLoadingCaseResults(false);
    }
  };

  // Fetch reviews from Supabase
  const fetchReviews = async () => {
    if (!lawyerId) return;
    
    setLoadingReviews(true);
    try {
      const { data, error } = await supabase
        .from('lawyer_reviews')
        .select('*')
        .eq('lawyer_id', lawyerId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching reviews:', error);
      } else {
        setReviews(data || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Fetch data when tab changes or component opens
  useEffect(() => {
    if (isOpen && lawyerId) {
      if (activeTab === 'case-results') {
        fetchCaseResults();
      } else if (activeTab === 'reviews') {
        fetchReviews();
      }
    }
  }, [isOpen, activeTab, lawyerId]);

  const handleConnectClick = () => {
    setShowContactInfo(true);
    if (onConnectClick) {
      onConnectClick();
    }
  };

  // Get badge color class based on outcome_color
  const getOutcomeBadgeColor = (color: string) => {
    switch (color) {
      case 'green':
        return 'bg-[#E0FAEC] text-[#05B11F] border-[#A8E6A8]';
      case 'yellow':
        return 'bg-[#FFECC0] text-[#624C18] border-[#F6E585]';
      default:
        return 'bg-[#FFECC0] text-[#624C18] border-[#F6E585]';
    }
  };

  // Render star rating for reviews
  const renderStarRating = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`w-3 h-3 ${
          index < rating ? 'fill-[#F6B51E] text-[#F6B51E]' : 'text-gray-300'
        }`}
      />
    ));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
      {/* Mobile: Full screen, Desktop: Centered modal - Make entire modal scrollable */}
      <div 
        className="bg-white w-full h-full md:w-[600px] md:max-w-[90vw] md:h-auto md:max-h-[90vh] md:rounded-lg md:shadow-xl flex flex-col overflow-hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Scrollable content container - This makes the entire modal scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Header */}
          <div className="bg-[rgba(67,56,202,0.07)] p-4 md:p-6 relative flex-shrink-0">
            {/* Close button - positioned to not overlap content */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 md:top-4 md:right-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5 text-[#4338CA]" />
            </button>
            
            {/* Header content with proper spacing from close button */}
            <div className="pr-12">
              <div className="text-center text-[#4338CA] text-sm md:text-base font-medium mb-4 md:mb-6">
                Top Rated {getPracticeArea(specialty)} in {county}, {state}
              </div>

              {/* Profile Section - Horizontal Layout */}
              <div className="flex items-center gap-4 mb-6">
                {/* Avatar with Star Overlay */}
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-white overflow-hidden">
                    <Avatar className="w-full h-full">
                      <AvatarImage src={profileImageUrl} alt={name} className="object-cover" />
                      <AvatarFallback className="bg-indigo-100 text-indigo-600 text-sm md:text-lg font-semibold">
                        {name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  {/* Star Overlay */}
                  <div className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-[#F6B51E] rounded-full flex items-center justify-center border-2 border-white">
                    <Star className="w-2.5 h-2.5 md:w-3 md:h-3 fill-white text-white" />
                  </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 min-w-0">
                  {/* Available Now Badge */}
                  <div className="bg-[#E0FAEC] text-[#05B11F] px-2.5 py-1 rounded-full text-xs md:text-sm font-medium mb-2 inline-flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-[#1FC16B] rounded-full"></div>
                    Available Now
                  </div>

                  {/* Name and Rating */}
                  <h2 className="text-lg md:text-xl font-semibold text-[#171717] mb-1">{name}</h2>
                  {firm && (
                    <p className="text-sm md:text-base text-[rgba(26,35,126,0.8)] font-medium mb-1 break-words">
                      {firm}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-sm md:text-base text-[rgba(0,0,0,0.6)]">
                    <Star className="w-4 h-4 md:w-4 md:h-4 fill-[#F6B51E] text-[#F6B51E]" />
                    <span className="font-medium">{rating.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <Button 
                onClick={handleConnectClick}
                className="w-full bg-[#483ccc] hover:bg-[#3d33a8] text-white font-medium py-3 md:py-4 text-base md:text-lg rounded-lg transition-colors"
              >
                <MessageCircle className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                Connect Me Now
              </Button>

              {/* Contact Information */}
              {showContactInfo && (
                <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                  <h3 className="font-medium text-[#171717] mb-3 text-sm md:text-base">Contact Information</h3>
                  <div className="space-y-3 text-sm md:text-base">
                    {phoneNumber && (
                      <div className="flex items-center gap-3 text-[rgba(0,0,0,0.6)]">
                        <Phone className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                        <a 
                          href={`tel:${phoneNumber.replace(/\D/g, '')}`}
                          className="break-all hover:underline hover:text-blue-600 transition-colors bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md flex-1 text-blue-700 font-medium"
                          style={{ textDecoration: 'none' }}
                        >
                          {phoneNumber}
                        </a>
                      </div>
                    )}
                    {email && (
                      <div className="flex items-center gap-3 text-[rgba(0,0,0,0.6)]">
                        <Mail className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                        <span className="break-all">{email}</span>
                      </div>
                    )}
                    {website && (
                      <div className="flex items-center gap-3 text-[rgba(0,0,0,0.6)]">
                        <Globe className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                        <a href={website} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">
                          {website}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[rgba(0,0,0,0.6)]">
                      <MapPin className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                      <span>{capitalizeLocation(county)}, {capitalizeLocation(state)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-[#EBEBEB] flex-shrink-0"></div>

          {/* Tab Navigation - properly centered */}
          <div className="bg-[#F7F7F7] p-2 m-4 md:m-6 rounded-lg flex flex-shrink-0">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-2.5 px-2 md:px-4 rounded-md text-xs md:text-sm font-medium transition-colors text-center ${
                activeTab === 'overview'
                  ? 'bg-white text-[#A3A3A3] shadow-sm'
                  : 'text-[#A3A3A3] hover:text-[#171717]'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('case-results')}
              className={`flex-1 py-2.5 px-2 md:px-4 rounded-md text-xs md:text-sm font-medium transition-colors flex items-center justify-center gap-1 md:gap-1.5 ${
                activeTab === 'case-results'
                  ? 'bg-white text-[#171717] shadow-sm'
                  : 'text-[#A3A3A3] hover:text-[#171717]'
              }`}
            >
              <Shield className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Case Results</span>
              <span className="sm:hidden">Cases</span>
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`flex-1 py-2.5 px-2 md:px-4 rounded-md text-xs md:text-sm font-medium transition-colors flex items-center justify-center gap-1 md:gap-1.5 ${
                activeTab === 'reviews'
                  ? 'bg-white text-[#171717] shadow-sm'
                  : 'text-[#A3A3A3] hover:text-[#171717]'
              }`}
            >
              <MessageCircle className="w-3 h-3 md:w-4 md:h-4" />
              Reviews
            </button>
          </div>

          {/* Tab Content - Now part of the main scrollable area */}
          <div className="px-4 md:px-6 pb-4 md:pb-6">
            {activeTab === 'overview' && (
              <div className="space-y-4 md:space-y-6">
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-[#FEFBEB] text-[#B4530A] border-[#FCE68C] hover:bg-[#FEFBEB] text-xs md:text-sm">
                    <BadgeCheck className="w-3 h-3 mr-1" />
                    LawPro Verified
                  </Badge>
                  <Badge className="bg-[#FAF5FF] text-[#842DCF] border-[#E9D5FF] hover:bg-[#FAF5FF] text-xs md:text-sm">
                    Free Consultation
                  </Badge>
                </div>

                {/* Description */}
                <div>
                  <h3 className="font-medium text-[#171717] mb-2 md:mb-3 text-sm md:text-base">About</h3>
                  <p className="text-sm md:text-base text-[rgba(0,0,0,0.6)] leading-relaxed">
                    Experienced {getPracticeArea(specialty).toLowerCase()} in {capitalizeLocation(county)}, {capitalizeLocation(state)} with a proven track record of successfully defending clients in {capitalizeLocation(county)}. 
                    Specializing in {caseType.toLowerCase()}, with extensive courtroom experience and a commitment to achieving 
                    the best possible outcomes for every client.
                  </p>
                </div>

                {/* Video Section */}
                <div>
                  <h3 className="font-medium text-[#171717] mb-2 md:mb-3 text-sm md:text-base">Introduction Video</h3>
                  <div className="bg-gray-100 rounded-lg p-6 md:p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-[#7D52F4] rounded-full flex items-center justify-center mb-3">
                      <Play className="w-6 h-6 md:w-8 md:h-8 text-white ml-1" />
                    </div>
                    <p className="text-sm md:text-base text-[rgba(0,0,0,0.6)]">Watch introduction video</p>
                  </div>
                </div>

                {/* Practice Areas */}
                <div>
                  <h3 className="font-medium text-[#171717] mb-3 md:mb-4 text-sm md:text-base">Practice Areas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                    {['Criminal Defense', 'DUI/DWI', 'Drug Crimes', 'Domestic Violence', 'Traffic Violations', 'Assault'].map((area) => (
                      <div key={area} className="flex items-center gap-2 md:gap-3 text-sm md:text-base text-[rgba(0,0,0,0.6)]">
                        <div className="w-2 h-2 bg-[#7D52F4] rounded-full flex-shrink-0"></div>
                        <span>{area}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'case-results' && (
              <div className="space-y-4 md:space-y-6">
                {loadingCaseResults ? (
                  <div className="text-center py-8 md:py-12 text-[rgba(0,0,0,0.6)]">Loading case results...</div>
                ) : caseResults.length > 0 ? (
                  caseResults.map((caseResult) => (
                    <div key={caseResult.id} className="bg-white border border-[#EBEBEB] rounded-2xl p-4 md:p-6 shadow-sm">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4 gap-3">
                        <h3 className="font-medium text-[#171717] text-base md:text-lg flex-1">{caseResult.case_type}</h3>
                        <Badge className={`${getOutcomeBadgeColor(caseResult.outcome_color)} text-xs md:text-sm font-medium px-2 py-1 rounded-full flex-shrink-0`}>
                          {caseResult.outcome}
                        </Badge>
                      </div>
                      
                      {/* Divider */}
                      <div className="h-px bg-[#EBEBEB] mb-4"></div>
                      
                      {/* Description */}
                      <p className="text-xs md:text-sm text-[#5C5C5C] leading-relaxed">
                        {caseResult.case_description}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 md:py-12 text-[rgba(0,0,0,0.6)]">No case results available</div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4 md:space-y-6">
                {loadingReviews ? (
                  <div className="text-center py-8 md:py-12 text-[rgba(0,0,0,0.6)]">Loading reviews...</div>
                ) : reviews.length > 0 ? (
                  reviews.map((review) => (
                    <div key={review.id} className="bg-white border border-[#EBEBEB] rounded-2xl p-4 md:p-6 shadow-sm">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4 gap-3">
                        <div className="flex flex-col gap-2 flex-1">
                          <h3 className="font-medium text-[#171717] text-base md:text-lg">{review.reviewer_name}</h3>
                          <div className="flex items-center gap-0.5">
                            {renderStarRating(review.rating)}
                          </div>
                        </div>
                        <Badge className="bg-[#F5F5F5] text-[#7B7B7B] text-xs md:text-sm font-medium px-2 py-1 rounded-full flex-shrink-0">
                          {review.review_date}
                        </Badge>
                      </div>
                      
                      {/* Divider */}
                      <div className="h-px bg-[#EBEBEB] mb-4"></div>
                      
                      {/* Review Text */}
                      <p className="text-xs md:text-sm text-[#5C5C5C] leading-relaxed">
                        {review.review_text}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 md:py-12 text-[rgba(0,0,0,0.6)]">No reviews available</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LawyerDetailedCard; 