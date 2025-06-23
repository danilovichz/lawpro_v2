import OpenAI from 'openai';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { supabase } from './supabase';
import { fetchLawyersByLocation } from './lawyerService';
import { searchLawyers } from './simpleLawyerSearch';
import axios from 'axios';

const openai = new OpenAI({
  baseURL: 'https://api.openai.com/v1',
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Test function to verify OpenAI API connectivity
export async function testOpenAIAPI(): Promise<boolean> {
  // Skip test if no API key is provided (just placeholder)
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    console.log('🔧 [API-TEST] No OpenAI API key configured - skipping test');
    return false;
  }

  console.log('🔧 [API-TEST] Testing OpenAI connection with proper auth...');
    
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Reply with just "API_WORKING"' }],
        max_tokens: 5,
        temperature: 0
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🔧 [API-TEST] Status:', response.status);
    
    // OpenAI API response validation
    if (response.status !== 200) {
      console.error('🔧 [API-TEST] Error Response:', response.data);
      return false;
    }
    
    // Validate OpenAI response structure
    if (!response.data || !response.data.choices || !Array.isArray(response.data.choices) || response.data.choices.length === 0) {
      console.error('🔧 [API-TEST] Invalid response structure - missing choices array');
      return false;
    }

    const choice = response.data.choices[0];
    if (!choice.message || !choice.message.content) {
      console.error('🔧 [API-TEST] Invalid response structure - missing message content');
      return false;
    }
    
    console.log('✅ [API-TEST] OpenAI is working! Response:', choice.message.content);
    return true;
    
  } catch (error: any) {
    console.error('❌ [API-TEST] OpenAI API test failed');
    
    // Only log detailed error information if we have a real API key
    if (error.response?.status === 401) {
      console.error('🔧 [API-TEST] Invalid API key - please check your OpenAI credentials');
    } else if (error.response) {
      console.error('🔧 [API-TEST] Error response status:', error.response.status);
    }
    return false;
  }
}

const titlePrompt = `You are a legal assistant. Create a very short title (2-3 words maximum) that identifies the main legal issue from the user's message. Examples:
- "DUI Case" for driving under influence 
- "Car Crash" for auto accidents
- "Divorce Help" for marriage dissolution
- "Criminal Defense" for criminal charges
- "Personal Injury" for injury claims
- "Real Estate" for property issues
- "Employment Law" for workplace issues
- "Family Law" for custody/divorce
- "Business Law" for company matters
- "Estate Planning" for wills/trusts

Respond with ONLY the 2-3 word title, no quotes, no punctuation, no explanation.`;

export async function generateTitle(userMessage: string): Promise<string> {
  console.log('🤖 GENERATING DYNAMIC AI TITLE...');
  console.log('📝 Analyzing message:', userMessage.substring(0, 100) + (userMessage.length > 100 ? '...' : ''));
  
  try {
    console.log('🚀 Sending request to OpenAI GPT-4o-mini...');
    
    // Create a more dynamic and creative prompt
    const currentTime = new Date().toISOString();
    const randomSeed = Math.random().toString(36).substring(7);
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert legal categorization AI. Your job is to analyze legal questions and create unique, specific 2-3 word titles that capture the exact nature of each case.

CRITICAL REQUIREMENTS:
- Generate UNIQUE titles that reflect the specific situation
- NEVER use generic terms like "Legal Question", "Legal Matter", "Legal Issue"
- Be creative and specific based on the actual content
- Focus on the specific legal problem, not just the broad category
- Consider location, circumstances, and specific details mentioned

EXAMPLE TRANSFORMATIONS:
- Car accident case → "Auto Collision" or "Vehicle Crash" or "Traffic Incident"
- DUI case → "DWI Defense" or "Drunk Driving" or "Impaired Driving"
- Divorce → "Marriage Dissolution" or "Spousal Separation" or "Custody Battle"
- Employment issue → "Workplace Dispute" or "Job Termination" or "Wage Theft"
- Contract problem → "Agreement Breach" or "Contract Violation" or "Business Dispute"

Think creatively and generate a title that someone would immediately understand the specific nature of this legal situation. Use varied vocabulary and be specific to the details mentioned.

Time: ${currentTime}
Seed: ${randomSeed}`
          },
          {
            role: 'user', 
            content: `Create a unique, specific 2-3 word title for this legal situation. Be creative and focus on the specific circumstances mentioned: "${userMessage}"`
          }
        ],
        temperature: 0.8,
      max_tokens: 250,
        top_p: 0.9
    }, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 API Response Status:', response.status);
    
    if (response.status !== 200) {
      const errorText = response.data.choices && response.data.choices[0] && response.data.choices[0].message ? response.data.choices[0].message.content : 'No response from API';
      console.error('❌ OpenAI API Error:', response.status, errorText);
      
      // Try with a simpler approach as fallback
      console.log('🔄 Retrying with simpler prompt...');
      
      const retryResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Create a unique 2-3 word title for legal cases. Be specific and creative. Never use "Legal Question" or generic terms.'
            },
            {
              role: 'user', 
              content: `Generate a specific, unique title for: "${userMessage}"`
            }
          ],
          temperature: 0.9,
          max_tokens: 20
      }, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (retryResponse.status === 200) {
        const retryData = retryResponse.data;
        console.log('✅ Retry API Response:', retryData);
        
        if (retryData.choices && retryData.choices[0] && retryData.choices[0].message && retryData.choices[0].message.content) {
          const retryTitle = retryData.choices[0].message.content.trim()
            .replace(/['"]/g, '')
            .replace(/[^\w\s-]/g, '')
            .trim()
            .split(/\s+/)
            .slice(0, 3)
            .filter((word: string) => word.length > 0)
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          
          if (retryTitle && retryTitle.length > 0 && retryTitle !== 'Legal Question') {
            console.log('✨ Retry AI Title Success:', retryTitle);
            return retryTitle;
          }
        }
      } else {
        const retryErrorText = retryResponse.data ? retryResponse.data.choices && retryResponse.data.choices[0] && retryResponse.data.choices[0].message ? retryResponse.data.choices[0].message.content : 'No response from retry API' : 'No response from retry API';
        console.error('❌ Retry API also failed:', retryResponse.status, retryErrorText);
      }
      
      // If both attempts fail, generate a dynamic title based on content analysis
      console.log('🎯 Generating dynamic content-based title...');
      return generateDynamicTitle(userMessage);
    }
    
    const data = response.data;
    console.log('✅ Raw API Response:', data);
    
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      const rawTitle = data.choices[0].message.content.trim();
      console.log('🎯 Raw AI Title:', rawTitle);
      
      // Clean and format the AI-generated title
      const cleanedTitle = rawTitle
        .replace(/['"]/g, '') // Remove quotes
        .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
        .trim()
        .split(/\s+/) // Split on whitespace
        .slice(0, 3) // Max 3 words
        .filter((word: string) => word.length > 0) // Remove empty strings
        .map((word: string) => {
          // Capitalize first letter, lowercase the rest
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
      
      if (cleanedTitle && cleanedTitle.length > 0 && cleanedTitle !== 'Legal Question' && cleanedTitle !== 'Legal Matter') {
        console.log('✨ Final AI-Generated Title:', cleanedTitle);
        return cleanedTitle;
      }
    } else {
      console.error('❌ Invalid API response structure:', data);
    }
  } catch (error) {
    console.error('💥 Error in AI title generation:', error);
  }
  
  // Generate dynamic title if AI completely fails
  console.log('🔄 AI failed, generating dynamic content-based title...');
  return generateDynamicTitle(userMessage);
}

function generateDynamicTitle(userMessage: string): string {
  console.log('🎯 Creating dynamic title from content analysis...');
  
  const message = userMessage.toLowerCase();
  const words = message.split(/\s+/);
  
  // Extract key legal terms and context
  const legalTerms: { [key: string]: string[] } = {
    accident: ['Auto Collision', 'Vehicle Crash', 'Traffic Incident', 'Crash Case', 'Collision Claim'],
    dui: ['DWI Defense', 'Drunk Driving', 'Impaired Driving', 'DUI Charge', 'Intoxication Case'],
    divorce: ['Marriage Dissolution', 'Spousal Separation', 'Divorce Proceedings', 'Marital Split', 'Union Termination'],
    custody: ['Child Custody', 'Parental Rights', 'Custody Battle', 'Child Support', 'Family Rights'],
    employment: ['Workplace Dispute', 'Job Termination', 'Employment Issue', 'Worker Rights', 'Wage Claim'],
    contract: ['Agreement Breach', 'Contract Violation', 'Business Dispute', 'Deal Conflict', 'Contract Issue'],
    injury: ['Personal Injury', 'Bodily Harm', 'Injury Claim', 'Physical Damage', 'Harm Compensation'],
    criminal: ['Criminal Defense', 'Legal Defense', 'Court Case', 'Criminal Charge', 'Legal Trouble'],
    property: ['Property Rights', 'Real Estate', 'Land Dispute', 'Property Issue', 'Housing Matter'],
    business: ['Business Law', 'Commercial Issue', 'Corporate Matter', 'Business Dispute', 'Trade Conflict'],
    estate: ['Estate Planning', 'Will Contest', 'Inheritance Issue', 'Probate Matter', 'Legacy Dispute'],
    immigration: ['Immigration Law', 'Visa Issue', 'Citizenship Matter', 'Border Issue', 'Status Question'],
    bankruptcy: ['Debt Relief', 'Financial Crisis', 'Bankruptcy Case', 'Insolvency Matter', 'Debt Issue'],
    malpractice: ['Medical Malpractice', 'Professional Negligence', 'Healthcare Error', 'Treatment Error', 'Medical Negligence']
  };
  
  // Find the most relevant category
  for (const [category, titles] of Object.entries(legalTerms)) {
    if (message.includes(category) || 
        (category === 'accident' && (message.includes('car') || message.includes('auto') || message.includes('crash'))) ||
        (category === 'dui' && (message.includes('dwi') || message.includes('drunk'))) ||
        (category === 'divorce' && (message.includes('marriage') || message.includes('spouse'))) ||
        (category === 'employment' && (message.includes('work') || message.includes('job') || message.includes('fired'))) ||
        (category === 'criminal' && (message.includes('arrest') || message.includes('charge') || message.includes('court'))) ||
        (category === 'property' && (message.includes('house') || message.includes('land') || message.includes('real estate'))) ||
        (category === 'injury' && (message.includes('hurt') || message.includes('injured') || message.includes('harm')))) {
      
      // Select a random title from the category to ensure variety
      const randomIndex = Math.floor(Math.random() * titles.length);
      const selectedTitle = titles[randomIndex];
      console.log(`✨ Dynamic title selected: ${selectedTitle} (category: ${category})`);
      return selectedTitle;
    }
  }
  
  // If no specific category matches, create a dynamic title based on key words
  const keyWords = words
    .filter(word => word.length > 3)
    .filter(word => !['with', 'about', 'need', 'help', 'have', 'question', 'issue', 'problem', 'matter'].includes(word))
    .slice(0, 2);
    
  if (keyWords.length >= 1) {
    const dynamicTitle = keyWords
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' Matter';
    console.log(`✨ Dynamic keyword-based title: ${dynamicTitle}`);
    return dynamicTitle;
  }
  
  // Last resort - generate based on message length and content type
  const timeBasedTitles = [
    'Legal Consultation',
    'Legal Advice',
    'Legal Guidance', 
    'Legal Counsel',
    'Legal Support'
  ];
  
  const index = Math.abs(userMessage.length + new Date().getMinutes()) % timeBasedTitles.length;
  const finalTitle = timeBasedTitles[index];
  console.log(`✨ Time-based dynamic title: ${finalTitle}`);
  return finalTitle;
}

export async function sendMessageToWebhook(message: string, chatId: string): Promise<{ response: string; lawyer?: boolean }> {
  console.log('Attempting to send message to webhook:', { message, chatId });
  
  try {
    // Log the full request details
    console.log('Sending request to:', 'https://n8n.srv799397.hstgr.cloud/webhook/lawpro');
    console.log('Request payload:', JSON.stringify({ message, chatId }));
    
    const response = await axios.post('https://n8n.srv799397.hstgr.cloud/webhook/lawpro', {
      message,
      chatId
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Response status:', response.status);

    if (response.status !== 200) {
      console.error('HTTP error details:', { status: response.status, statusText: response.statusText, body: response.data });
      throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(response.data)}`);
    }

    let data = response.data;
    console.log('Successfully received webhook response data:', data);

    let responseText = '';
    let showLawyerCard = false;

    // Handle array response format - FIX: Deduplicate array responses
    if (Array.isArray(data) && data.length > 0) {
      console.log('Processing array response with length:', data.length);
      
      // Deduplicate array responses - take the first unique response
      const uniqueResponses = new Set();
      let uniqueItem = null;
      
      for (const item of data) {
        const responseKey = item.output?.response || item.response || '';
        if (responseKey && !uniqueResponses.has(responseKey)) {
          uniqueResponses.add(responseKey);
          uniqueItem = item;
          break; // Take the first unique response
        }
      }
      
      if (uniqueItem) {
        console.log('Using deduplicated response from array');
        if (uniqueItem.output?.response) {
          responseText = uniqueItem.output.response;
        } else if (typeof uniqueItem.response === 'string') {
          responseText = uniqueItem.response;
        }
        if (typeof uniqueItem.lawyer === 'boolean') {
          showLawyerCard = uniqueItem.lawyer;
        }
      } else {
        // Fallback to first item if no unique responses found
        const firstItem = data[0];
        if (firstItem.output?.response) {
          responseText = firstItem.output.response;
        } else if (typeof firstItem.response === 'string') {
          responseText = firstItem.response;
        }
        if (typeof firstItem.lawyer === 'boolean') {
          showLawyerCard = firstItem.lawyer;
        }
      }
    }
    // Handle object response format
    else if (typeof data === 'object' && data !== null) {
      console.log('Processing object response');
      if (data.output?.response) {
        responseText = data.output.response;
      } else if (typeof data.response === 'string') {
        responseText = data.response;
      }
      if (typeof data.lawyer === 'boolean') {
        showLawyerCard = data.lawyer;
      }
    }

    if (responseText) {
      console.log('Returning formatted response:', responseText.substring(0, 100) + '...');
      return { response: formatResponse(responseText), lawyer: showLawyerCard };
    }

    console.error('Unexpected webhook response format or empty response:', data);
    throw new Error('Invalid response format from webhook');
  } catch (error) {
    console.error('Error sending message to webhook:', error);
    
    // Provide a fallback response if the webhook call fails
    // This allows the application to function even when the webhook is unavailable
    console.log('Using fallback response due to webhook failure');
    const fallbackResponse = generateFallbackResponse(message);
    return { response: formatResponse(fallbackResponse), lawyer: false };
  }
}

function formatResponse(text: string): string {
  // Add proper markdown formatting
  let formattedText = text
    // Add emphasis to important words
    .replace(/(IMPORTANT|NOTE|WARNING|CRITICAL|immediately|must|required by law)/gi, '**$1**')
    // Ensure proper spacing for numbered lists
    .replace(/(\d+)\.\s*/g, '\n$1. ')
    // Add line breaks between paragraphs, not just sentences.
    // This regex looks for a punctuation mark (.?!) followed by a space and an uppercase letter (start of a new sentence)
    // and replaces it with the punctuation mark and two newlines, creating a paragraph break.
    .replace(/([.?!])\s+(?=[A-Z])/g, '$1\n\n')
    // Clean up any excessive newlines (more than two)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Convert markdown to HTML
  const htmlContent = marked(formattedText, { breaks: true }) as string;
  
  // Sanitize the HTML
  const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div'],
    ALLOWED_ATTR: []
  });

  return sanitizedHtml;
}

// Generate a simple fallback response when the webhook is unavailable
function generateFallbackResponse(userMessage: string): string {
  // Simple fallback logic
  if (userMessage.toLowerCase().includes('car') && userMessage.toLowerCase().includes('accident')) {
    return "I understand you're asking about a car accident. In such cases, it's important to document everything, contact your insurance, and consider consulting with a personal injury attorney if there are injuries or significant damages.";
  }
  
  if (userMessage.toLowerCase().includes('divorce') || userMessage.toLowerCase().includes('custody')) {
    return "I see you're asking about family law matters. These cases require careful consideration of many factors. It would be best to consult with a family law attorney who can provide guidance specific to your situation.";
  }
  
  // Generic fallback
  return "I apologize, but I'm currently experiencing connection issues to my knowledge base. " +
    "Your question is important, and I'd be happy to assist once the connection is restored. " +
    "Please try asking again in a few minutes, or rephrase your question.";
}

export async function findLawyersForUser(userMessage: string, caseType?: string): Promise<{ lawyers: any[], location: string }> {
  console.log('[AI] Finding lawyers for user message:', userMessage);
  
  try {
    // Extract location from the message
    let location = extractLocationFromMessage(userMessage);
    
    if (!location) {
      throw new Error('Could not extract location from your message. Please specify a location like "Allen County, Indiana" or "Lane Oregon".');
    }
    
    console.log('[AI] Extracted location:', location);
    
    // Parse location to get county and state
    const locationParts = location.split(',').map(part => part.trim());
    let county = '';
    let state = '';
    
    if (locationParts.length >= 2) {
      county = locationParts[0];
      state = locationParts[1];
    } else {
      // If only one part, assume it's a state
      state = locationParts[0];
    }
    
    // Use the lawyer service to search
    const lawyers = await fetchLawyersByLocation(county, state);
    
    // If case type is provided, enhance the lawyers with that information
    if (caseType && lawyers.length > 0) {
      lawyers.forEach((lawyer: any) => {
        lawyer.specialty = `${caseType} Specialist in ${lawyer.county || lawyer.city}, ${lawyer.state}`;
        if (lawyer.practiceAreas && !lawyer.practiceAreas.includes(caseType)) {
          lawyer.practiceAreas.unshift(caseType);
        }
      });
    }
    
    return {
      lawyers,
      location
    };
    
  } catch (error) {
    console.error('[AI] Error finding lawyers:', error);
    throw error;
  }
}

/**
 * Extract location from user message using simple pattern matching
 */
function extractLocationFromMessage(message: string): string | null {
  const text = message.toLowerCase();
  
  // Common patterns
  const patterns = [
    // "in Location" - improved to exclude common words
    /\bin\s+(?:an?\s+)?(accident|crash|incident)\s+in\s+([^.!?,]+?)(?:\s+(?:for|about|regarding|\.|\!|\?))/i,
    /\bin\s+([^.!?,]+?)(?:\s+(?:for|about|regarding|\.|\!|\?))/i,
    // "at Location" 
    /\bat\s+([^.!?,]+?)(?:\s+(?:for|about|regarding|\.|\!|\?))/i,
    // "from Location"
    /\bfrom\s+([^.!?,]+?)(?:\s+(?:for|about|regarding|\.|\!|\?))/i,
    // "near Location"
    /\bnear\s+([^.!?,]+?)(?:\s+(?:for|about|regarding|\.|\!|\?))/i,
    // Just at the end of sentence - improved
    /\bin\s+(?:an?\s+)?(accident|crash|incident)\s+in\s+([^.!?]+)$/i,
    /\bin\s+([^.!?]+)$/i,
    /\bat\s+([^.!?]+)$/i,
    /\bfrom\s+([^.!?]+)$/i,
    /\bnear\s+([^.!?]+)$/i,
    // More aggressive patterns for direct location mentions
    /\b([a-z\s]+)\s+county,?\s*([a-z\s]*)/i,
    /\b([a-z\s]+),\s*([a-z\s]+)$/i
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      let location = '';
      
      // Handle special patterns with accident/crash/incident
      if (match[0].includes('accident') || match[0].includes('crash') || match[0].includes('incident')) {
        // Use the location part after "in"
        location = match[2] ? match[2].trim() : match[1].trim();
      } else {
        location = match[1].trim();
        
        // If we have a second capture group (state), include it
        if (match[2] && match[2].trim()) {
          location += ', ' + match[2].trim();
        }
      }
      
      // Clean up common endings
      location = location
        .replace(/\s+(please|thanks|thank you)$/i, '')
        .replace(/\s+lawyers?$/i, '')
        .replace(/\s+attorneys?$/i, '')
        .replace(/\s+help$/i, '')
        .trim();
        
      if (location.length > 2) {
        return location;
      }
    }
  }
  
  // Look for state names directly with potential county/city before them
  const states = [
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
    'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
    'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
    'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire',
    'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
    'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
    'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia',
    'wisconsin', 'wyoming'
  ];
  
  // Check for state mentions with potential county/city before
  for (const state of states) {
    const stateIndex = text.indexOf(state);
    if (stateIndex !== -1) {
      // Look for words before the state that might be a county/city
      const beforeState = text.substring(0, stateIndex).trim();
      const words = beforeState.split(/\s+/);
      
      // Take last 1-3 words before state as potential county/city
      if (words.length > 0) {
        const potentialLocation = words.slice(-3).join(' ').trim();
        // Filter out common non-location words
        if (potentialLocation && 
            !['in', 'at', 'from', 'near', 'for', 'about', 'had', 'was', 'were', 'the', 'a', 'an'].includes(potentialLocation)) {
          return `${potentialLocation} ${state}`;
        }
      }
      
      // Just return the state if no county/city found
      return state;
    }
  }
  
  // Check for state abbreviations with potential location before
  const stateAbbrevs = ['al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy'];
  
  for (const abbrev of stateAbbrevs) {
    const pattern = new RegExp(`\\b([a-z\\s]+)\\s+${abbrev}\\b`, 'i');
    const match = text.match(pattern);
    if (match && match[1]) {
      const location = match[1].trim();
      if (location && !['in', 'at', 'from', 'near', 'for', 'about'].includes(location)) {
        return `${location} ${abbrev}`;
      }
    }
  }
  
  return null;
}