import React, { useEffect } from 'react';
import { X, Phone, Mail, Globe, MapPin, Star, BadgeCheck, MessageSquare, Calendar, ShieldCheck, Briefcase } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Lawyer } from '../../lib/lawyerService';

interface LawyerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lawyer?: Lawyer;
  county?: string;
  state?: string;
  caseType?: string;
}

const LawyerDetailModal: React.FC<LawyerDetailModalProps> = ({
  isOpen,
  onClose,
  lawyer,
  county,
  state,
  caseType
}) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Use provided lawyer data or fallback values
  const displayLawyer = lawyer || {
    name: "Attorney Representative",
    lawFirm: "Legal Services Firm",
    specialty: `Legal Professional in ${county || state || 'your area'}`,
    phoneNumber: "(555) 123-4567",
    email: "info@lawfirm.com",
    website: "www.lawfirm.com",
    county: county || "Your County",
    state: state || "Your State",
    rating: 4.8,
    availability: "Available Now" as const,
    isFirmVerified: true,
    description: "We pride ourselves on serving our clients with the utmost care and attention to detail. We understand that legal matters can have significant impacts on your life, and we're committed to providing the guidance and representation you need.",
    practiceAreas: ["Legal Consultation", "Case Evaluation", "Legal Representation"],
    profileImageUrl: "/placeholder-attorney.jpg"
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove non-digits and format as (XXX) XXX-XXXX
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const formatWebsite = (website: string | null | undefined) => {
    if (!website) return null;
    // Add https:// if not present
    if (!website.startsWith('http://') && !website.startsWith('https://')) {
      return `https://${website}`;
    }
    return website;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="absolute top-4 right-4 z-10">
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[90vh]">
          {/* Header Section */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-6 pb-8">
            <div className="flex items-start space-x-4">
              {/* Profile Image */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-white/20 overflow-hidden">
                  <Avatar className="w-full h-full">
                    <AvatarImage src={displayLawyer.profileImageUrl} alt={displayLawyer.name} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-800 text-lg font-semibold">
                      {displayLawyer.name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {/* Availability indicator */}
                <div className="absolute -bottom-1 -right-1 bg-green-500 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                </div>
              </div>

              {/* Basic Info */}
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h2 className="text-xl font-bold">{displayLawyer.name}</h2>
                  {displayLawyer.isFirmVerified && (
                    <BadgeCheck className="w-5 h-5 text-blue-200" />
                  )}
                </div>
                <p className="text-indigo-100 font-medium mb-1">{displayLawyer.specialty}</p>
                <p className="text-indigo-200 text-sm break-words">{displayLawyer.lawFirm}</p>
                
                {/* Rating */}
                <div className="flex items-center mt-2 space-x-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={`w-4 h-4 ${star <= (displayLawyer.rating || 4.8) ? 'text-yellow-300 fill-current' : 'text-gray-400'}`}
                      />
                    ))}
                  </div>
                  <span className="text-white text-sm font-medium">{(displayLawyer.rating || 4.8).toFixed(1)}</span>
                  <span className="text-indigo-200 text-xs">• {displayLawyer.availability}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="p-6 space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3">
                <MessageSquare className="w-4 h-4 mr-2" />
                Start Consultation
              </Button>
              <Button variant="outline" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-medium py-3">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Meeting
              </Button>
            </div>

            {/* Contact Information */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Phone className="w-5 h-5 mr-2 text-indigo-600" />
                Contact Information
              </h3>
              <div className="space-y-3">
                {displayLawyer.phoneNumber && (
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">Phone</p>
                      <a 
                        href={`tel:${displayLawyer.phoneNumber.replace(/\D/g, '')}`}
                        className="bg-green-50 hover:bg-green-100 px-3 py-2 rounded-md text-green-700 font-medium transition-colors block mt-1"
                        style={{ textDecoration: 'none' }}
                      >
                        📞 {formatPhoneNumber(displayLawyer.phoneNumber)}
                      </a>
                    </div>
                  </div>
                )}

                {displayLawyer.email && (
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <a 
                        href={`mailto:${displayLawyer.email}`}
                        className="text-gray-900 font-medium hover:text-indigo-600 transition-colors"
                      >
                        {displayLawyer.email}
                      </a>
                    </div>
                  </div>
                )}

                {displayLawyer.website && (
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Globe className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Website</p>
                      <a 
                                                 href={formatWebsite(displayLawyer.website) || '#'}
                         target="_blank"
                         rel="noopener noreferrer"
                        className="text-gray-900 font-medium hover:text-indigo-600 transition-colors"
                      >
                        {displayLawyer.website}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="text-gray-900 font-medium">
                      {displayLawyer.county && displayLawyer.state 
                        ? `${displayLawyer.county}, ${displayLawyer.state}`
                        : displayLawyer.state || displayLawyer.county || 'Location Available Upon Request'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {displayLawyer.description && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Briefcase className="w-5 h-5 mr-2 text-indigo-600" />
                  About
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {displayLawyer.description}
                </p>
              </div>
            )}

            {/* Practice Areas */}
            {displayLawyer.practiceAreas && displayLawyer.practiceAreas.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <ShieldCheck className="w-5 h-5 mr-2 text-indigo-600" />
                  Practice Areas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {displayLawyer.practiceAreas.map((area, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span className="text-gray-700">{area}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Case Type Information */}
            {caseType && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-indigo-900 mb-2">
                  Specialized in {caseType} Cases
                </h3>
                <p className="text-indigo-700 text-sm">
                  This attorney has experience handling cases similar to yours and can provide specialized guidance for {caseType.toLowerCase()} matters.
                </p>
              </div>
            )}

            {/* Bottom Action */}
            <div className="border-t pt-4">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 text-lg">
                <MessageSquare className="w-5 h-5 mr-2" />
                Connect with {displayLawyer.name}
              </Button>
              <p className="text-center text-sm text-gray-500 mt-2">
                Free consultation • Response within 24 hours
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LawyerDetailModal; 