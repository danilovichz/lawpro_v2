import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button'; 
import { BadgeCheck, MessageSquare, Star, ShieldCheck, Briefcase, PlayCircle, Calendar } from 'lucide-react';

// Case result data structure
interface CaseResult {
  title: string;
  badge: string;
  description: string;
}

// Review data structure
interface Review {
  name: string;
  date: string;
  rating: number;
  comment: string;
}

interface AttorneyCardProps {
  caseType?: string;
  county?: string;
  state?: string;
  attorneyName?: string;
  attorneySpecialty?: string;
  firmName?: string;
  isFirmVerified?: boolean;
  profileImageUrl?: string;
  availability?: 'Available Now' | 'Busy' | 'Offline';
  rating?: number;
  reviewsCount?: number;
  description?: string;
  practiceAreas?: string[];
  caseResults?: CaseResult[];
  reviews?: Review[];
  onConnectClick?: () => void;
}

const AttorneyCard: React.FC<AttorneyCardProps> = ({
  caseType: propsCaseType,
  county: propsCounty,
  state: propsState,
  attorneyName = "Attorney Representative",
  attorneySpecialty: propsAttorneySpecialty,
  firmName = "LEGAL SERVICES FIRM",
  isFirmVerified = true,
  profileImageUrl = "/placeholder-attorney.jpg",
  availability = "Available Now",
  rating = 4.8,
  reviewsCount = 212,
  description = "We pride ourselves on serving our clients with the utmost care and attention to detail. Whether you're facing complex legal matters or need professional guidance, we understand that legal issues can have significant impacts on your life and we're committed to providing the best possible representation.",
  practiceAreas = ["Criminal Defense", "DUI Defense", "Domestic Violence", "Drug Charges", "Probation Violations", "Expungements"],
  onConnectClick,
  caseResults = [
    { 
      title: "DUI Defense", 
      badge: "Charges Reduced", 
      description: "Client facing felony DUI charges had case reduced to misdemeanor with minimal penalties."
    },
    { 
      title: "Drug Possession", 
      badge: "Charges Dismissed", 
      description: "Successfully argued illegal search and seizure, resulting in complete dismissal of all charges."
    },
    { 
      title: "Domestic Violence", 
      badge: "Not Guilty Verdict", 
      description: "Jury trial resulting in full acquittal after presenting evidence of false accusations."
    }
  ],
  reviews = [
    {
      name: "Michael R.",
      date: "July 2023",
      rating: 5,
      comment: "This attorney was amazing throughout my entire case. They kept me informed, fought hard, and got my charges reduced significantly. Forever grateful!"
    },
    {
      name: "Sarah T.",
      date: "May 2023",
      rating: 5,
      comment: "I cannot recommend this law firm enough. They turned what could have been a life-altering disaster into a manageable situation and were there for me every step of the way."
    },
    {
      name: "David L.",
      date: "March 2023",
      rating: 5,
      comment: "Professional, responsive, and truly cares about their clients. They managed to get my case dismissed and helped me get my life back on track."
    }
  ]
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'case-results' | 'reviews'>('overview');

  // Determine displayed values, using defaults if props are undefined
  const displayCaseType = propsCaseType || "Legal Services";
  
  // Format the location display - always show actual location info
  let locationText = "";
  
  if (propsCounty && propsState) {
    locationText = `${propsCounty}, ${propsState}`;
  } else if (propsCounty) {
    locationText = propsCounty;
  } else if (propsState) {
    locationText = propsState;
  } else {
    // If no location is provided at all, don't show the card
    console.warn('[ATTORNEY CARD] No location information provided');
    locationText = "your area"; // Fallback, but this should rarely happen
  }
  
  // Specialty should reflect the actual location
  const displayAttorneySpecialty = propsAttorneySpecialty || 
    (locationText !== "your area" ? `Top Rated Lawyer in ${locationText}` : "Legal Professional");

  return (
    <div className="bg-white shadow-md rounded-lg md:rounded-2xl w-full max-w-xl mx-auto border border-gray-100 overflow-hidden">
      {/* Header - With case type and location */}
      <div className="bg-indigo-50 p-3 md:p-5 rounded-t-lg md:rounded-t-2xl">
        <h2 className="text-sm md:text-base font-medium text-indigo-700 pr-10">
          Recommended Attorney for <span className="font-semibold">{displayCaseType}</span> in <span className="font-semibold">{locationText}</span>
        </h2>
      </div>

      <div className="p-4 md:p-6">
        {/* Attorney Info */}
        <div className="flex mb-5">
          {/* Profile Image with decorative blue border */}
          <div className="relative mr-4">
            <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full">
              {/* Blue decorative border */}
              <div className="absolute inset-0 bg-blue-100 rounded-full border-4 border-blue-200" style={{ padding: '4px' }}></div>
              {/* Avatar */}
              <div className="absolute inset-2 overflow-hidden rounded-full bg-blue-100">
                <Avatar className="w-full h-full">
                  <AvatarImage src={profileImageUrl} alt={attorneyName} />
                  <AvatarFallback className="bg-blue-100 text-indigo-800 text-lg font-semibold">
                    {attorneyName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>
          
          {/* Attorney Details */}
          <div className="flex flex-col justify-center">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">{displayAttorneySpecialty}</h3>
            <div className="flex items-center mt-1">
              <p className="text-sm font-medium text-indigo-700 uppercase">{firmName}</p>
              {isFirmVerified && <ShieldCheck className="w-4 h-4 text-indigo-700 ml-1" />}
            </div>
            
            {/* Availability badge repositioned here for better visibility */}
            <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>
              <span className="text-green-700">{availability}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons - Increased height for better touch target */}
        <div className="mb-6">
          <Button 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center py-3 md:py-2.5 text-base"
            onClick={onConnectClick}
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            Connect Me Now
          </Button>
        </div>

        {/* Tabs - Increased touch target size */}
        <div className="border-b border-gray-200 mb-5">
          <nav className="flex justify-center -mb-px w-full overflow-x-auto px-2">
            <div className="inline-flex justify-between w-full max-w-xs">
              <button 
                className={`py-3 px-2 font-medium text-sm whitespace-nowrap ${activeTab === 'overview' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                className={`py-3 px-2 font-medium text-sm whitespace-nowrap flex items-center ${activeTab === 'case-results' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
                onClick={() => setActiveTab('case-results')}
              >
                <Briefcase className={`w-4 h-4 mr-1 ${activeTab === 'case-results' ? 'text-indigo-600' : 'text-gray-500'}`} />
                Case Results
              </button>
              <button 
                className={`py-3 px-2 font-medium text-sm whitespace-nowrap flex items-center ${activeTab === 'reviews' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
                onClick={() => setActiveTab('reviews')}
              >
                <MessageSquare className={`w-4 h-4 mr-1 ${activeTab === 'reviews' ? 'text-indigo-600' : 'text-gray-500'}`} />
                Reviews
              </button>
            </div>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            {/* Star Ratings Section */}
            <div className="flex items-center mb-4">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star, index) => (
                  <Star 
                    key={index} 
                    className={`w-5 h-5 ${index < Math.floor(rating) ? 'text-yellow-400 fill-current' : (index < rating ? 'text-yellow-400 fill-current' : 'text-gray-300')}`}
                  />
                ))}
                <span className="ml-1 text-sm text-gray-700">{rating.toFixed(1)}</span>
              </div>
            </div>
            
            {/* Badges - In separate div with significant margin-top for separation */}
            <div className="flex justify-start items-center space-x-3 mb-6 mt-4">
              <div className="flex items-center px-3 py-1.5 rounded-full text-xs font-medium border border-yellow-300 bg-yellow-50">
                <BadgeCheck className="w-3.5 h-3.5 mr-1 text-amber-700" />
                <span className="text-amber-700">LawPro Verified</span>
              </div>
              <div className="flex items-center px-3 py-1.5 rounded-full text-xs font-medium border border-purple-200 bg-purple-50">
                <Briefcase className="w-3.5 h-3.5 mr-1 text-purple-700" />
                <span className="text-purple-700">Free Consultation</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">
              {description}
            </p>

            {/* Video Section */}
            <div className="flex items-center justify-center p-4 mb-5 border border-gray-100 rounded-lg relative">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md absolute">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <PlayCircle className="w-8 h-8 text-gray-800" />
                </div>
              </div>
            </div>

            {/* Text below video */}
            <p className="text-sm text-gray-600 mb-5 text-center">
              Meet {attorneyName} and learn about their approach to legal cases.
            </p>

            {/* Practice Areas */}
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              {practiceAreas.map((area, index) => (
                <div key={index} className="flex items-center">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                  <span className="text-sm text-gray-600">{area}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Case Results Tab */}
        {activeTab === 'case-results' && (
          <div className="space-y-4">
            {caseResults.map((result, index) => (
              <div key={index} className="border border-gray-100 rounded-lg shadow-sm p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-base text-gray-900">{result.title}</h4>
                  <span className="bg-yellow-50 text-yellow-800 text-xs px-2 py-1 rounded-full">
                    {result.badge}
                  </span>
                </div>
                <div className="border-t border-gray-100 my-2"></div>
                <p className="text-sm text-gray-600">
                  {result.description}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {reviews.map((review, index) => (
              <div key={index} className="border border-gray-100 rounded-lg shadow-sm p-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h4 className="font-medium text-base text-gray-900">{review.name}</h4>
                    <div className="flex mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className="w-3 h-3 text-yellow-400 fill-current"
                        />
                      ))}
                    </div>
                  </div>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                    {review.date}
                  </span>
                </div>
                <div className="border-t border-gray-100 my-2"></div>
                <p className="text-sm text-gray-600">
                  {review.comment}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttorneyCard; 