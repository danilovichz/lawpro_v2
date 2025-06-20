import {
  ArrowRightIcon,
  ClockIcon,
  LockIcon,
  MenuIcon,
  PlusCircleIcon,
  SendIcon,
  SettingsIcon,
  UsersIcon,
  XIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { nanoid } from 'nanoid';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { supabase } from "../../lib/supabase";
import { generateTitle, sendMessageToWebhook, findLawyersForUser, testOpenAIAPI } from "../../lib/ai";
import { processMessageForConversation, searchLawyersForState } from "../../lib/enhancedLawyerSearch";
import LawyerPreviewCard from "../../components/LawyerPreviewCard/LawyerPreviewCard";
import LawyerDetailedCard from "../../components/LawyerDetailedCard/LawyerDetailedCard";
import ViewMoreLawyersCard from "../../components/ViewMoreLawyersCard/ViewMoreLawyersCard";
import { TestEnhancedSearch } from "../../components/TestEnhancedSearch";
import LawyerDetailModal from "../../components/LawyerDetailModal/LawyerDetailModal";
import LawyerListModal from "../../components/LawyerListModal/LawyerListModal";
import { Lawyer } from "../../lib/locationService";

interface Message {
  id: string;
  content: string;
  is_user: boolean;
  created_at: string;
  type?: 'text' | 'lawyerPreview' | 'viewMoreLawyers';
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  session_key: string;
}

interface CaseInfo {
  county?: string;
  state?: string;
  caseType?: string;
  isConfirmed?: boolean;
}

const loadingMessages = [
  "Processing your message...",
  "One moment please...",
  "Working on it...",
  "Almost ready..."
];

export const Screen = (): JSX.Element => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const loadingIntervalRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const browserSessionId = useRef(nanoid());
  
  // State for lawyer modals
  const [isLawyerDetailOpen, setIsLawyerDetailOpen] = useState(false);
  const [isLawyerListOpen, setIsLawyerListOpen] = useState(false);
  const [isLawyerDetailedCardOpen, setIsLawyerDetailedCardOpen] = useState(false);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [selectedLawyer, setSelectedLawyer] = useState<Lawyer | null>(null);
  const [isLoadingLawyers, setIsLoadingLawyers] = useState(false);
  
  // Store confirmed user location
  const [confirmedLocation, setConfirmedLocation] = useState<CaseInfo | null>(null);

  // Common case types for extraction
  const commonCaseTypes: { keywords: string[]; name: string }[] = [
    { keywords: ["dui", "driving under influence"], name: "DUI Cases" },
    { keywords: ["car crash", "auto accident", "car accident"], name: "Car Accidents" },
    { keywords: ["personal injury"], name: "Personal Injury" },
    { keywords: ["criminal defense"], name: "Criminal Defense" },
    { keywords: ["family law", "divorce", "child custody"], name: "Family Law" },
    { keywords: ["real estate"], name: "Real Estate" },
    { keywords: ["business law"], name: "Business Law" },
    { keywords: ["employment law"], name: "Employment Law" },
    { keywords: ["immigration"], name: "Immigration Law" },
    { keywords: ["bankruptcy"], name: "Bankruptcy" },
  ];

  // Helper function to capitalize words
  const capitalize = (str: string): string => 
    str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  // Safe version of extractCaseInfo that doesn't cause side effects
  const extractCaseInfoSafe = (messages: Message[]): CaseInfo => {
    let info: CaseInfo = { county: undefined, state: undefined, caseType: undefined };
    
    // Look through messages for location and case type info
    const recentMessages = [...messages].reverse().slice(0, 10);
    
    for (const message of recentMessages) {
      if (message.is_user) {
        const content = message.content.toLowerCase();
        
        // Extract case type first
        if (!info.caseType) {
          for (const type of commonCaseTypes) {
            if (type.keywords.some(keyword => content.includes(keyword))) {
              info.caseType = type.name;
              break; 
            }
          }
        }

        // Structured patterns for location extraction
        let match = content.match(/\b([a-z\s]+?)\s+county,\s*([a-z\s]+[a-z]{1,})\b/i);
        if (match && match[1] && match[2]) {
          const countyName = capitalize(match[1].trim()) + " County";
          const stateName = capitalize(match[2].trim());
          info.county = countyName;
          info.state = stateName;
          continue;
        }

        match = content.match(/\b([a-z\s]+?),\s*([a-z\s]+[a-z]{1,})\b/i);
        if (match && match[1] && match[2]) {
          const potentialLocation = capitalize(match[1].trim());
          const potentialState = capitalize(match[2].trim());
          
          if (potentialState.length <= 2 || potentialState.split(' ').length <= 2 || /[A-Z]{2}/.test(match[2].trim())) {
            if (!info.county) info.county = potentialLocation;
            if (!info.state) info.state = potentialState;
            continue;
          }
        }

        match = content.match(/\b([a-z\s]+?)\s+([A-Z]{2})\b/i);
        if (match && match[2].length === 2) {
          const locationName = capitalize(match[1].trim());
          const stateAbbr = match[2].toUpperCase();
          
          if (!info.county) info.county = locationName;
          if (!info.state) info.state = stateAbbr;
          continue;
        }
        
        if (!info.county) {
          match = content.match(/\b([a-z\s]+?)\s+county\b/i);
          if (match && match[1]) {
            const countyName = capitalize(match[1].trim()) + " County";
            info.county = countyName;
          }
        }
      }
    }
    
    return info;
  };

  // Memoized case info extraction to prevent infinite loops
  const currentCaseInfo = useMemo(() => {
    if (confirmedLocation && confirmedLocation.isConfirmed) {
      return confirmedLocation;
    }
    return extractCaseInfoSafe(messages);
  }, [messages, confirmedLocation]);

  useEffect(() => {
    loadSessions();
    // Test OpenAI API on component load
    testOpenAIAPI().then((success: boolean) => {
      console.log('🔧 [SCREEN] OpenAI API test result:', success);
      if (!success) {
        console.error('⚠️ [SCREEN] OpenAI API is not working - titles will use fallback logic');
      }
    });
  }, []);

  useEffect(() => {
    if (isLoading) {
      let index = 0;
      loadingIntervalRef.current = setInterval(() => {
        setLoadingMessage(loadingMessages[index]);
        index = (index + 1) % loadingMessages.length;
      }, 2000);
    } else {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        setLoadingMessage("");
      }
    }
    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, [isLoading]);

  const loadSessions = async () => {
    try {
      const { error: connectionError } = await supabase
        .from('chat_sessions')
        .select('count', { count: 'exact', head: true });

      if (connectionError) {
        throw new Error(`Connection test failed: ${connectionError.message}`);
      }

      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('session_key', browserSessionId.current)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch sessions: ${error.message}`);
      }

      setSessions(data || []);
      if (data && data.length > 0) {
        setCurrentSession(data[0].id);
        loadMessages(data[0].id);
      }
    } catch (error) {
      console.error('Error in loadSessions:', error);
    }
  };

  const loadMessages = async (sessionId: string) => {
    console.log('[SCREEN] Loading messages for session:', sessionId);
    
    // Load chat messages
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    const messagesWithType = data?.map(msg => ({
      ...msg,
      type: 'text' as const
    })) || [];
    setMessages(messagesWithType);
    console.log('[SCREEN] Loaded', messagesWithType.length, 'messages');

    // --- Load lawyer data from localStorage ---
    loadLawyerDataFromStorage(sessionId, messagesWithType);
  };

  const removeSessionFromUI = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(sessions.filter(session => session.id !== sessionId));
    if (currentSession === sessionId) {
      setCurrentSession(null);
      setMessages([]);
    }
  };

  const createNewSession = async () => {
    try {
      const newSessionKey = nanoid();
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert([
          { 
            title: 'New Chat',
            session_key: newSessionKey
          }
        ])
        .select()
        .single();

      if (sessionError) throw sessionError;

      setSessions(prev => [session, ...prev]);
      return session;
    } catch (error) {
      console.error('Error in createNewSession:', error);
      return null;
    }
  };

  const updateSessionTitle = async (sessionId: string, messageText: string) => {
    try {
      console.log('🏷️ [TITLE-UPDATE] Starting title generation for session:', sessionId);
      console.log('📝 [TITLE-UPDATE] Message text:', messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''));
      
      console.log('🤖 [TITLE-UPDATE] Calling generateTitle...');
      const title = await generateTitle(messageText);
      console.log('✨ [TITLE-UPDATE] AI generated title:', title);
      
      console.log('💾 [TITLE-UPDATE] Updating database...');
      const { error } = await supabase
        .from('chat_sessions')
        .update({ title })
        .eq('id', sessionId);

      if (error) throw error;
      
      console.log('✅ [TITLE-UPDATE] Database updated successfully');

      console.log('🔄 [TITLE-UPDATE] Updating UI state...');
      setSessions(prev => prev.map(session =>
        session.id === sessionId ? { ...session, title } : session
      ));
      
      console.log('✅ [TITLE-UPDATE] UI state updated - title should now appear in sidebar');
    } catch (error) {
      console.error('❌ [TITLE-UPDATE] Failed to update session title:', error);
    }
  };

  const handleNewChat = async () => {
    const session = await createNewSession();
    if (session) {
      setCurrentSession(session.id);
      setMessages([]);
      setLawyers([]);
      setSelectedLawyer(null);
      setConfirmedLocation(null);
      setIsSidebarOpen(false);
      
      // Clear persisted lawyer data for new session
      persistLawyerData([], null, session.id);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Please select a file smaller than 5MB");
      return;
    }

    setIsLoading(true);
    try {
      let sessionId = currentSession;
      if (!sessionId) {
        const session = await createNewSession();
        if (!session) {
          setIsLoading(false);
          return;
        }
        sessionId = session.id;
        setCurrentSession(sessionId);
      }

      if (!sessionId) {
        console.error("Session ID is null, cannot send message.");
        setIsLoading(false);
        return;
      }

      const { data: userMessage, error: userError } = await supabase
        .from('chat_messages')
        .insert([{
          session_id: sessionId,
          content: `File uploaded: ${file.name}`,
          is_user: true
        }])
        .select()
        .single();

      if (userError) throw userError;

      const userMessageWithType = { ...userMessage, type: 'text' as const };
      setMessages(prev => [...prev, userMessageWithType]);

      const webhookResponse = await sendMessageToWebhook(`File uploaded: ${file.name}`, sessionId);
      
      const { data: aiMessage, error: aiError } = await supabase
        .from('chat_messages')
        .insert([{
          session_id: sessionId,
          content: webhookResponse.response,
          is_user: false
        }])
        .select()
        .single();

      if (aiError) throw aiError;

      const aiMessageWithType = { ...aiMessage, type: 'text' as const };
      setMessages(prev => [...prev, aiMessageWithType]);

      // If webhook indicates lawyer info is needed, fetch lawyers
              if (webhookResponse.lawyer && !isLoadingLawyers) {
          const caseInfo = extractCaseInfo(messages);
          await fetchLawyersData(caseInfo, undefined, sessionId);
        }
    } catch (error: any) {
      console.error('Error handling file upload:', error);
      let errorMessageContent = "I apologize, but there was an error processing your file. Please try again.";

      if (error.message === 'Invalid response format from webhook') {
        errorMessageContent = "The service is experiencing technical difficulties. Please try again later.";
      } else if (error.message?.includes('HTTP error! status:')) {
        errorMessageContent = "Failed to connect to the service. Please check your internet connection and try again.";
      } else if (error.code || error.message?.toLowerCase().includes('supabase')) {
        errorMessageContent = "There was an issue saving your file information. Please try again.";
      }

      const errorMessage: Message = {
        id: nanoid(),
        content: errorMessageContent,
        is_user: false,
        created_at: new Date().toISOString(),
        type: 'text'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle opening the lawyer detail modal
  const handleOpenLawyerDetail = () => {
    setIsLawyerDetailOpen(true);
  };

  // Handle opening the lawyer list modal
  const handleOpenLawyerList = () => {
    setIsLawyerListOpen(true);
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    setIsLoading(true);
    const messageText = currentMessage;
    setCurrentMessage("");

    try {
      let sessionId = currentSession;
      if (!sessionId) {
        const session = await createNewSession();
        if (!session) {
          setIsLoading(false);
          return;
        }
        sessionId = session.id;
        setCurrentSession(sessionId);
      }

      if (!sessionId) {
        console.error("Session ID is null, cannot send message.");
        setIsLoading(false);
        return;
      }

      // Save user message
      const { data: userMessage, error: userError } = await supabase
        .from('chat_messages')
        .insert([{
          session_id: sessionId,
          content: messageText,
          is_user: true
        }])
        .select()
        .single();

      if (userError) throw userError;

      // Update message list with user message
      const userMessageWithType = { ...userMessage, type: 'text' as const };
      setMessages(prev => [...prev, userMessageWithType]);

      // Always try to update session title for the first message in this session
      if (messages.length === 0) {
        console.log('[SCREEN] First message detected, generating AI title...');
        updateSessionTitle(sessionId, messageText).catch(error => {
          console.error('[SCREEN] Failed to update session title:', error);
        });
      }

      // ENHANCED: Process message for conversation state BEFORE sending to webhook
      console.log('[SCREEN] Processing message with enhanced search...');
      const conversationResult = await processMessageForConversation(messageText, sessionId);
      console.log('[SCREEN] Conversation result:', conversationResult);

      // --- NEW: Update UI state if location changed ---
      const newCounty = conversationResult.state.county;
      const newState = conversationResult.state.state;
      const oldCounty = confirmedLocation?.county;
      const oldState = confirmedLocation?.state;
      if ((newCounty && newCounty !== oldCounty) || (newState && newState !== oldState)) {
        console.log('[SCREEN] Detected location change:', { from: { county: oldCounty, state: oldState }, to: { county: newCounty, state: newState } });
        setConfirmedLocation({
          county: newCounty,
          state: newState,
          caseType: conversationResult.state.caseType === 'criminal' ? 'Criminal Defense' : 'Personal Injury',
          isConfirmed: true
        });
        setSelectedLawyer(null);
        setLawyers([]);
        
        // Clear persisted lawyer data when location changes
        persistLawyerData([], null, sessionId);
      }
      // --- END NEW ---

      // Determine if the message likely contains location info – used later to avoid duplicate lawyer fetches
      const shouldFetchLawyers = shouldProactivelyFetchLawyers(messageText);
      console.log('[SCREEN] Should proactively fetch lawyers:', shouldFetchLawyers);
      
      // Send enhanced message to webhook (includes extracted info)
      const webhookResponse = await sendMessageToWebhook(conversationResult.enhancedMessage, sessionId);
      
      // SAFETY CHECK: Prevent duplicate AI messages
      const recentMessages = messages.slice(-5); // Check last 5 messages
      const isDuplicate = recentMessages.some(msg => 
        !msg.is_user && 
        msg.content === webhookResponse.response &&
        Math.abs(new Date().getTime() - new Date(msg.created_at).getTime()) < 10000 // Within 10 seconds
      );
      
      if (isDuplicate) {
        console.warn('[SCREEN] Duplicate AI response detected, skipping:', webhookResponse.response.substring(0, 100));
        setIsLoading(false);
        return;
      }
      
      // Save AI response
      const { data: aiMessage, error: aiError } = await supabase
        .from('chat_messages')
        .insert([{
          session_id: sessionId,
          content: webhookResponse.response,
          is_user: false
        }])
        .select()
        .single();

      if (aiError) throw aiError;

      // Add AI message to UI
      const aiMessageWithType = { ...aiMessage, type: 'text' as const };
      setMessages(prev => [...prev, aiMessageWithType]);

      // ENHANCED: If webhook indicates lawyer info is needed, use enhanced search
      if (webhookResponse.lawyer && !isLoadingLawyers) {
        console.log('[SCREEN] Webhook indicated lawyers needed, using enhanced search...');
        
        try {
          setIsLoadingLawyers(true);
          
          // Use enhanced search system
          const enhancedLawyers = await searchLawyersForState(sessionId);
          console.log(`[SCREEN] Enhanced search found ${enhancedLawyers.length} lawyers`);
          
          if (enhancedLawyers.length > 0) {
            setLawyers(enhancedLawyers);
            setSelectedLawyer(enhancedLawyers[0]);
            
            // Update confirmed location from enhanced search
            const lawyer = enhancedLawyers[0];
            const confirmedInfo = {
              county: lawyer.county,
              state: lawyer.state,
              caseType: conversationResult.state.caseType === 'criminal' ? 'Criminal Defense' : 'Personal Injury',
              isConfirmed: true
            };
            setConfirmedLocation(confirmedInfo);
            
            // Add lawyer preview card
            const lawyerPreviewMessage = {
              id: nanoid(),
              content: `I found ${enhancedLawyers.length} lawyers in ${conversationResult.searchLocation || lawyer.state} who may be able to help.`,
              is_user: false,
              created_at: new Date().toISOString(),
              type: 'lawyerPreview' as const
            };
            
            // Add view more card if multiple lawyers
            if (enhancedLawyers.length > 1) {
              const viewMoreMessage = {
                id: nanoid(),
                content: `View more lawyers`,
                is_user: false,
                created_at: new Date().toISOString(),
                type: 'viewMoreLawyers' as const
              };
              
              setMessages(prev => [...prev, lawyerPreviewMessage, viewMoreMessage]);
            } else {
              setMessages(prev => [...prev, lawyerPreviewMessage]);
            }

            // --- NEW: Persist lawyer_results and selected_lawyer to localStorage ---
            persistLawyerData(enhancedLawyers, enhancedLawyers[0], sessionId);
          } else {
            // No lawyers found with enhanced search, add helpful message
            const noLawyersMessage = {
              id: nanoid(),
              content: `I couldn't find lawyers in your specified location. Please try specifying a different county or state.`,
              is_user: false,
              created_at: new Date().toISOString(),
              type: 'text' as const
            };
            setMessages(prev => [...prev, noLawyersMessage]);
          }
          
        } catch (enhancedError) {
          console.error('[SCREEN] Enhanced search error:', enhancedError);
          
          // Fallback to original search method
          console.log('[SCREEN] Falling back to original search method...');
          const caseInfo = extractCaseInfo([...messages, userMessageWithType, aiMessageWithType]);
          await fetchLawyersData(caseInfo, messageText, sessionId);
        } finally {
          setIsLoadingLawyers(false);
        }
      }
    } catch (error: any) {
      console.error('Error in message handling:', error);
      let errorMessageContent = "I apologize, but there was an error processing your request. Please try again.";

      if (error.message === 'Invalid response format from webhook') {
        errorMessageContent = "The service is experiencing technical difficulties. Please try again later.";
      } else if (error.message?.includes('HTTP error! status:')) {
        errorMessageContent = "Failed to connect to the service. Please check your internet connection and try again.";
      } else if (error.code || error.message?.toLowerCase().includes('supabase')) {
        errorMessageContent = "There was an issue saving your message. Please try again.";
      }

      const errorMessage: Message = {
        id: nanoid(),
        content: errorMessageContent,
        is_user: false,
        created_at: new Date().toISOString(),
        type: 'text'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to determine if we should proactively fetch lawyers
  const shouldProactivelyFetchLawyers = (messageText: string): boolean => {
    const text = messageText.toLowerCase();
    
    // Check for location indicators
    const hasLocationIndicators = [
      'in ', 'at ', 'from ', 'near ', 'around ',
      'county', 'state', 'city', 'area',
      'oregon', 'indiana', 'nevada', 'hawaii', 'california', 'texas', 'florida',
      'massachusetts', 'new york', 'illinois', 'ohio', 'michigan', 'pennsylvania',
      'washington', 'virginia', 'north carolina', 'south carolina', 'georgia',
      'alabama', 'tennessee', 'kentucky', 'louisiana', 'arkansas', 'missouri',
      'iowa', 'kansas', 'nebraska', 'oklahoma', 'colorado', 'utah', 'arizona',
      'new mexico', 'montana', 'wyoming', 'idaho', 'alaska', 'maine', 'vermont',
      'new hampshire', 'connecticut', 'rhode island', 'delaware', 'maryland',
      'west virginia', 'minnesota', 'wisconsin', 'north dakota', 'south dakota'
    ].some(indicator => text.includes(indicator));
    
    // Check for legal case indicators
    const hasLegalIndicators = [
      'accident', 'crash', 'injury', 'lawyer', 'attorney', 'legal', 'case',
      'dui', 'divorce', 'custody', 'criminal', 'defense', 'lawsuit', 'sue',
      'court', 'trial', 'settlement', 'compensation', 'damages', 'help',
      'advice', 'consultation', 'representation', 'claim', 'rights'
    ].some(indicator => text.includes(indicator));
    
    // Check for specific location patterns (more comprehensive)
    const hasLocationPattern = 
      // County patterns
      /\b([a-z\s]+)\s+county\b/i.test(text) ||
      // State patterns
      /\b(oregon|indiana|nevada|hawaii|california|texas|florida|massachusetts|new york|illinois|ohio|michigan|pennsylvania)\b/i.test(text) ||
      // State abbreviations
      /\b(or|in|nv|hi|ca|tx|fl|ma|ny|il|oh|mi|pa|wa|va|nc|sc|ga|al|tn|ky|la|ar|mo|ia|ks|ne|ok|co|ut|az|nm|mt|wy|id|ak|me|vt|nh|ct|ri|de|md|wv|mn|wi|nd|sd)\b/i.test(text) ||
      // "in [location]" patterns
      /\bin\s+[a-z\s]+/i.test(text) ||
      // "at [location]" patterns  
      /\bat\s+[a-z\s]+/i.test(text) ||
      // "from [location]" patterns
      /\bfrom\s+[a-z\s]+/i.test(text) ||
      // "[location], [state]" patterns
      /\b[a-z\s]+,\s*[a-z\s]+\b/i.test(text);
    
    console.log('[SCREEN] Location check:', { 
      hasLocationIndicators, 
      hasLegalIndicators, 
      hasLocationPattern,
      messageText: text.substring(0, 100) + '...'
    });
    
    // More aggressive: fetch lawyers if we have location pattern OR (location + legal indicators)
    // This ensures we catch cases like "I had a car crash in Lane Oregon"
    return hasLocationPattern || (hasLocationIndicators && hasLegalIndicators);
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const extractCaseInfo = (messages: Message[]): CaseInfo => {
    // First, check if we already have confirmed location - if so, use it
    if (confirmedLocation && confirmedLocation.isConfirmed) {
      console.log('[SCREEN] Using confirmed location:', confirmedLocation);
      return confirmedLocation;
    }

    // Otherwise extract information from messages
    let info: CaseInfo = { county: undefined, state: undefined, caseType: undefined };
    let potentialLocations: Array<{county?: string, state?: string}> = [];
    let needsConfirmation = false;

    // Look for explicit location confirmation phrases first
    const recentMessages = [...messages].reverse().slice(0, 10); // Check last 10 messages
    for (const message of recentMessages) {
      if (message.is_user) {
        const content = message.content.toLowerCase();
        
        // Check for confirmation phrases
        const confirmationPhrases = [
          'confirm', 'yes, that', 'that is correct', 'that\'s right', 
          'that is right', 'you got it', 'correct', 'yes it is', 
          'you are right', 'right'
        ];
        
        const isConfirmation = confirmationPhrases.some(phrase => content.includes(phrase));
        
        if (isConfirmation) {
          console.log('[SCREEN] Found confirmation message:', content);
          
          // Look for location in the last AI message before this one
          const msgIndex = messages.findIndex(m => m.id === message.id);
          if (msgIndex > 0) {
            for (let i = msgIndex - 1; i >= Math.max(0, msgIndex - 3); i--) {
              const prevMsg = messages[i];
              if (!prevMsg.is_user) {
                const aiContent = prevMsg.content.toLowerCase();
                
                // Try to extract location from AI message with various patterns
                
                // Look for specific known locations first - hard-coded high-priority cases
                if (aiContent.includes('hampden') && aiContent.includes('massachusetts')) {
                  console.log('[SCREEN] Found Hampden, Massachusetts in AI response before confirmation');
                  const confirmedInfo: CaseInfo = {
                    county: 'Hampden County',
                    state: 'Massachusetts',
                    caseType: info.caseType,
                    isConfirmed: true
                  };
                  console.log('[SCREEN] Setting confirmed location from confirmation:', confirmedInfo);
                  setConfirmedLocation(confirmedInfo);
                  return confirmedInfo;
                }
                
                // Pattern: "[County] County, [State]"
                const countyStateMatch = aiContent.match(/([a-z\s]+)\s+county,\s+([a-z\s]+)/i);
                if (countyStateMatch && countyStateMatch[1] && countyStateMatch[2]) {
                  const countyFromAI = countyStateMatch[1].trim();
                  const stateFromAI = countyStateMatch[2].trim();
                  
                  const confirmedInfo: CaseInfo = {
                    county: countyFromAI.charAt(0).toUpperCase() + countyFromAI.slice(1) + ' County',
                    state: stateFromAI.charAt(0).toUpperCase() + stateFromAI.slice(1),
                    caseType: info.caseType,
                    isConfirmed: true
                  };
                  console.log('[SCREEN] Setting confirmed location from AI message:', confirmedInfo);
                  setConfirmedLocation(confirmedInfo);
                  return confirmedInfo;
                }
                
                // Pattern: "[County], [State]"
                const simplePairMatch = aiContent.match(/([a-z\s]+),\s+([a-z\s]+)/i);
                if (simplePairMatch && simplePairMatch[1] && simplePairMatch[2]) {
                  // Verify this looks like a location and not another phrase
                  if (!aiContent.includes('such as') && !aiContent.includes('for example')) {
                    const county = simplePairMatch[1].trim();
                    const state = simplePairMatch[2].trim();
                    
                    // Only accept if state is valid and looks like a location
                    if (state.length <= 30 && !state.includes('please') && !state.includes('would')) {
                      const confirmedInfo: CaseInfo = {
                        county: county.charAt(0).toUpperCase() + county.slice(1),
                        state: state.charAt(0).toUpperCase() + state.slice(1),
                        caseType: info.caseType,
                        isConfirmed: true
                      };
                      console.log('[SCREEN] Setting confirmed location from comma pair:', confirmedInfo);
                      setConfirmedLocation(confirmedInfo);
                      return confirmedInfo;
                    }
                  }
                }
                
                break;
              }
            }
          }
        }
        
        // Special case handling - Hampden County
        if (content.includes('hampden')) {
          console.log('[SCREEN] Found Hampden mention in user message:', content);
          
          // Check if Massachusetts is also mentioned
          if (content.includes('mass') || content.includes('ma ')) {
            const hampdenLocation: CaseInfo = {
              county: 'Hampden County',
              state: 'Massachusetts',
              caseType: info.caseType,
              isConfirmed: true
            };
            console.log('[SCREEN] Setting confirmed location to Hampden, MA:', hampdenLocation);
            setConfirmedLocation(hampdenLocation);
            return hampdenLocation;
          } else {
            // Just Hampden mentioned, but we know it's likely Massachusetts
            potentialLocations.push({
              county: 'Hampden County',
              state: 'Massachusetts'
            });
            needsConfirmation = true;
          }
        }
        
        // Extract case type first - easier to identify
        if (!info.caseType) {
          for (const type of commonCaseTypes) {
            if (type.keywords.some(keyword => content.includes(keyword))) {
              info.caseType = type.name;
              break; 
            }
          }
        }

        // Structured patterns for location extraction
        // Pattern: "[city/county] County, [State Name/Abbr]"
        let match = content.match(/\b([a-z\s]+?)\s+county,\s*([a-z\s]+[a-z]{1,})\b/i);
        if (match && match[1] && match[2]) {
          const countyName = capitalize(match[1].trim()) + " County";
          const stateName = capitalize(match[2].trim());
          potentialLocations.push({
            county: countyName,
            state: stateName
          });
          
          // This is a pretty confident match, set it as current best
          info.county = countyName;
          info.state = stateName;
          continue;
        }

        // Pattern: "[City/County], [State Name/Abbr]"
        match = content.match(/\b([a-z\s]+?),\s*([a-z\s]+[a-z]{1,})\b/i);
        if (match && match[1] && match[2]) {
          const potentialLocation = capitalize(match[1].trim());
          const potentialState = capitalize(match[2].trim());
          
          // Basic check if second part looks like a state (not too long, or a known abbr)
          if (potentialState.length <= 2 || potentialState.split(' ').length <= 2 || /[A-Z]{2}/.test(match[2].trim())) {
            potentialLocations.push({
              county: potentialLocation,
              state: potentialState
            });
            
            if (!info.county) info.county = potentialLocation;
            if (!info.state) info.state = potentialState;
            continue;
          }
        }

        // Pattern: "[City/County] [ST_ABBR]" (ensure ST_ABBR is exactly 2 capital letters)
        match = content.match(/\b([a-z\s]+?)\s+([A-Z]{2})\b/i);
        if (match && match[2].length === 2) {
            const locationName = capitalize(match[1].trim());
            const stateAbbr = match[2].toUpperCase();
            
            potentialLocations.push({
              county: locationName,
              state: stateAbbr
            });
            
            if (!info.county) info.county = locationName;
            if (!info.state) info.state = stateAbbr;
            continue;
        }
        
        // Fallback: Just "[Any Place Name] County" if no state identified yet
        if (!info.county) {
          match = content.match(/\b([a-z\s]+?)\s+county\b/i);
          if (match && match[1]) {
            const countyName = capitalize(match[1].trim()) + " County";
            potentialLocations.push({
              county: countyName
            });
            info.county = countyName;
            needsConfirmation = true; // Need state confirmation
          }
        }
        
        // Just state name alone 
        if (!info.state) {
          // Look for state names or abbreviations
          for (const stateName of commonStateNames) {
            if (content.includes(` ${stateName.toLowerCase()} `)) {
              potentialLocations.push({
                state: capitalize(stateName)
              });
              info.state = capitalize(stateName);
              needsConfirmation = true; // Need county confirmation
              break;
            }
          }
        }
      }
    }

    // After extraction, decide if we have enough information to set confirmed location
    if (info.county && info.state) {
      // Check we don't accidentally use Jefferson, Alabama when user mentioned Hampden
      if (info.county.toLowerCase().includes('jefferson') && 
          info.state.toLowerCase().includes('alabama') && 
          messages.some(m => m.content.toLowerCase().includes('hampden'))) {
        console.log('[SCREEN] Preventing Jefferson, Alabama substitution when Hampden was mentioned');
        const hampdenLocation: CaseInfo = {
          county: 'Hampden County',
          state: 'Massachusetts',
          caseType: info.caseType,
          isConfirmed: true
        };
        setConfirmedLocation(hampdenLocation);
        return hampdenLocation;
      }
      
      // We have both county and state - consider as confirmed unless it needs verification
      if (!needsConfirmation && !confirmedLocation) {
        const newConfirmedLocation = { ...info, isConfirmed: true };
        console.log('[SCREEN] Setting confirmed location from extracted data:', newConfirmedLocation);
        setConfirmedLocation(newConfirmedLocation);
      }
    }
    
    // Special-case: If query is for Hampden (even without state), use Massachusetts
    if (info.county?.toLowerCase().includes('hampden') && !info.state) {
      console.log('[SCREEN] Found Hampden County without state, adding Massachusetts');
      info.state = 'Massachusetts';
      
      // Since we're specifically handling this case, mark as confirmed
      if (!confirmedLocation) {
        setConfirmedLocation({
          county: 'Hampden County',
          state: 'Massachusetts',
          caseType: info.caseType,
          isConfirmed: true
        });
      }
    }
    
    // Add a prompt for location confirmation if needed
    if (needsConfirmation && potentialLocations.length > 0 && !confirmedLocation) {
      checkAndPromptLocationConfirmation(potentialLocations, info);
    }
    
    return info;
  };

  // Common state names for better extraction
  const commonStateNames = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California",
    "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
    "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri",
    "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
    "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
    "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "District of Columbia", "DC"
  ];
  
  /**
   * Check if we need to prompt the user to confirm their location
   */
  const checkAndPromptLocationConfirmation = (
    potentialLocations: Array<{county?: string, state?: string}>, 
    currentInfo: CaseInfo
  ) => {
    // Don't add a prompt if we're still loading
    if (isLoading) return;
    
    // ENHANCED CHECK: Prevent duplicate location confirmation prompts
    const recentMessages = messages.slice(-5); // Check last 5 messages
    const hasLocationPrompt = recentMessages.some(msg => 
      !msg.is_user && (
        (msg.content.toLowerCase().includes('confirm') && 
         (msg.content.toLowerCase().includes('location') || 
          msg.content.toLowerCase().includes('county') || 
          msg.content.toLowerCase().includes('state'))) ||
        msg.content.toLowerCase().includes('inquiring about legal services')
      )
    );
    
    if (hasLocationPrompt) {
      console.log('[SCREEN] Location confirmation prompt already exists, skipping');
      return;
    }
    
    // Format the location for a prompt - use the most specific one available
    let locationString = '';
    
    // Find the most specific location (one with both county and state)
    const bestLocation = potentialLocations.find(loc => loc.county && loc.state) || 
                        potentialLocations[0] || 
                        { county: currentInfo.county, state: currentInfo.state };
    
    if (bestLocation.county && bestLocation.state) {
      locationString = `${bestLocation.county}, ${bestLocation.state}`;
    } else if (bestLocation.county) {
      locationString = bestLocation.county;
    } else if (bestLocation.state) {
      locationString = bestLocation.state;
    } else {
      return; // No location to confirm
    }
    
    // Create a location confirmation prompt
    const promptMessage: Message = {
      id: nanoid(),
      content: `To help find the most relevant lawyers for your case, I'd like to confirm your location. Are you inquiring about legal services in <strong>${locationString}</strong>? Please confirm or provide a different location.`,
      is_user: false,
      created_at: new Date().toISOString(),
      type: 'text'
    };
    
    console.log('[SCREEN] Adding location confirmation prompt for:', locationString);
    setMessages(prev => [...prev, promptMessage]);
  };

  // Simplified fetch lawyers data using direct database search
  const fetchLawyersData = async (caseDetails: CaseInfo, messageText?: string, sessionId?: string) => {
    setIsLoadingLawyers(true);
    console.log('[SCREEN] Fetching lawyers with case details:', caseDetails);
    
    try {
      let userMessageContent: string;
      
      if (messageText) {
        // Use the provided message text
        userMessageContent = messageText;
        console.log('[SCREEN] Using provided message text:', messageText);
      } else {
        // Get the latest user message to extract location from
        const userMessages = messages.filter(msg => msg.is_user);
        const latestUserMessage = userMessages[userMessages.length - 1];
        
        if (!latestUserMessage) {
          throw new Error('No user message found to extract location from');
        }
        
        userMessageContent = latestUserMessage.content;
        console.log('[SCREEN] Using latest user message:', userMessageContent);
      }
      
      console.log('[SCREEN] Using simple lawyer search for message:', userMessageContent);
      
      // Use the simplified lawyer search
      const { lawyers: lawyersList, location } = await findLawyersForUser(
        userMessageContent, 
        caseDetails.caseType
      );
      
      console.log(`[SCREEN] Found ${lawyersList.length} lawyers for location: ${location}`);
      
      if (lawyersList.length === 0) {
        throw new Error(`No lawyers found for ${location}. Please try a different location.`);
      }
      
      setLawyers(lawyersList);
      
      // Set the first lawyer as selected for preview
      if (lawyersList.length > 0) {
        setSelectedLawyer(lawyersList[0]);
      }

      // --- NEW: Persist fallback lawyer results to localStorage ---
      if (sessionId) {
        persistLawyerData(lawyersList, lawyersList[0], sessionId);
      }
      
      // Create a preview card to show the user
      const lawyerPreviewMessage: Message = {
        id: nanoid(),
        content: `I found ${lawyersList.length} lawyers in ${location} who may be able to help with your case.`,
        is_user: false,
        created_at: new Date().toISOString(),
        type: 'lawyerPreview'
      };
      
      // CHECK: Prevent duplicate lawyer preview messages
      const recentMessages = messages.slice(-5);
      const hasLawyerPreview = recentMessages.some(msg => 
        msg.type === 'lawyerPreview' || 
        (msg.content.includes('found') && msg.content.includes('lawyers') && msg.content.includes(location))
      );
      
      if (hasLawyerPreview) {
        console.log('[SCREEN] Lawyer preview already exists, skipping duplicate');
        setIsLoadingLawyers(false);
        return;
      }
      
      // Add a view more card if there are multiple lawyers
      if (lawyersList.length > 1) {
        const viewMoreMessage: Message = {
          id: nanoid(),
          content: `View more lawyers in ${location}`,
          is_user: false,
          created_at: new Date().toISOString(),
          type: 'viewMoreLawyers'
        };
        
        setMessages(prev => [...prev, lawyerPreviewMessage, viewMoreMessage]);
      } else {
        setMessages(prev => [...prev, lawyerPreviewMessage]);
      }
      
      // Store the confirmed location for future reference
      const confirmedInfo: CaseInfo = {
        county: lawyersList[0]?.county,
        state: lawyersList[0]?.state,
        caseType: caseDetails.caseType,
        isConfirmed: true
      };
      console.log('[SCREEN] Setting confirmed location:', confirmedInfo);
      setConfirmedLocation(confirmedInfo);
      
    } catch (error: any) {
      console.error('[SCREEN] Error fetching lawyers:', error.message || error);
      
      // Add a helpful error message
      const errorMessage: Message = {
        id: nanoid(),
        content: error.message || `I couldn't find lawyers matching your location. Please specify a location like "Allen County, Indiana" or "Lane Oregon".`,
        is_user: false,
        created_at: new Date().toISOString(),
        type: 'text'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoadingLawyers(false);
    }
  };

  // Helper function to get formatted location for display
  const getDisplayLocation = (caseDetails?: CaseInfo): string => {
    // Priority 1: State from confirmed location
    if (confirmedLocation && confirmedLocation.isConfirmed && confirmedLocation.state) {
      return confirmedLocation.state;
    }
    
    // Priority 2: State from provided case details
    if (caseDetails && caseDetails.state) {
      return caseDetails.state;
    }
    
    // Priority 3: State from selected lawyer
    if (selectedLawyer && selectedLawyer.state) {
      return selectedLawyer.state;
    }
    
    // Priority 4: County from confirmed location (if no state available)
    if (confirmedLocation && confirmedLocation.isConfirmed && confirmedLocation.county) {
      return confirmedLocation.county;
    }
    
    // Priority 5: County from case details (if no state available)
    if (caseDetails && caseDetails.county) {
      return caseDetails.county;
    }
    
    // Fallback
    return "your state";
  };

  // Render function for the ViewMoreLawyersCard
  const renderViewMoreLawyersCard = () => {
    const caseDetails = extractCaseInfo(messages);
    const locationString = getDisplayLocation(caseDetails);
    const caseTypeString = caseDetails.caseType || "Legal Services";
    
    return (
      <ViewMoreLawyersCard 
        legalCategory={caseTypeString}
        location={locationString}
        onClick={handleOpenLawyerList}
      />
    );
  };

  // Helper function to persist lawyer data to localStorage (NO DATABASE CHANGES NEEDED!)
  const persistLawyerData = (lawyersList: any[], selectedLawyer: any, sessionId: string) => {
    try {
      console.log('[SCREEN] Persisting lawyer data to localStorage for session:', sessionId);
      console.log('[SCREEN] Lawyers to persist:', lawyersList.length, 'lawyers');
      console.log('[SCREEN] Selected lawyer to persist:', selectedLawyer ? 'Yes' : 'No');
      
      const lawyerData = {
        lawyers: lawyersList,
        selectedLawyer: selectedLawyer,
        timestamp: Date.now()
      };
      
      localStorage.setItem(`lawyer_data_${sessionId}`, JSON.stringify(lawyerData));
      console.log('[SCREEN] Successfully persisted lawyer data to localStorage');
    } catch (error) {
      console.error('[SCREEN] Error persisting lawyer data to localStorage:', error);
    }
  };

  // Helper function to load lawyer data from localStorage
  const loadLawyerDataFromStorage = (sessionId: string, currentMessages?: Message[]) => {
    try {
      console.log('[SCREEN] Loading lawyer data from localStorage for session:', sessionId);
      const stored = localStorage.getItem(`lawyer_data_${sessionId}`);
      
      if (stored) {
        const lawyerData = JSON.parse(stored);
        console.log('[SCREEN] Found stored lawyer data:', lawyerData.lawyers.length, 'lawyers');
        console.log('[SCREEN] Found stored selected lawyer:', lawyerData.selectedLawyer ? 'Yes' : 'No');
        
        setLawyers(lawyerData.lawyers || []);
        setSelectedLawyer(lawyerData.selectedLawyer || null);
        
        // Also restore confirmed location if we have lawyer data
        if (lawyerData.lawyers && lawyerData.lawyers.length > 0) {
          const firstLawyer = lawyerData.lawyers[0];
          setConfirmedLocation({
            county: firstLawyer.county,
            state: firstLawyer.state,
            caseType: firstLawyer.practice_areas?.[0] || 'Legal Services',
            isConfirmed: true
          });
          console.log('[SCREEN] Restored confirmed location from lawyer data');
          
          // CRITICAL FIX: Recreate lawyer preview messages when loading chat
          const location = firstLawyer.state || firstLawyer.county || 'your area';
          console.log('[SCREEN] 🗺️ Determined location for recreation:', location);
          
          // Check if lawyer preview messages already exist to avoid duplicates
          const messagesToCheck = currentMessages || messages;
          const hasLawyerPreview = messagesToCheck.some(msg => 
            msg.type === 'lawyerPreview' || msg.type === 'viewMoreLawyers'
          );
          
          if (!hasLawyerPreview) {
            console.log('[SCREEN] ✨ RECREATING LAWYER PREVIEW MESSAGES FOR RESTORED SESSION ✨');
            console.log('[SCREEN] 📍 Location:', location);
            console.log('[SCREEN] 👥 Lawyers count:', lawyerData.lawyers.length);
            
            // Create lawyer preview message
            const lawyerPreviewMessage = {
              id: nanoid(),
              content: `I found ${lawyerData.lawyers.length} lawyers in ${location} who may be able to help with your case.`,
              is_user: false,
              created_at: new Date().toISOString(),
              type: 'lawyerPreview' as const
            };
            
            // Create view more message if multiple lawyers
            if (lawyerData.lawyers.length > 1) {
              const viewMoreMessage = {
                id: nanoid(),
                content: `View more lawyers in ${location}`,
                is_user: false,
                created_at: new Date().toISOString(),
                type: 'viewMoreLawyers' as const
              };
              
              console.log('[SCREEN] 🎯 Adding both preview and view-more messages');
              setMessages(prev => [...prev, lawyerPreviewMessage, viewMoreMessage]);
            } else {
              console.log('[SCREEN] 🎯 Adding single preview message');
              setMessages(prev => [...prev, lawyerPreviewMessage]);
            }
            
            console.log('[SCREEN] ✅ Successfully recreated lawyer preview messages - CARDS SHOULD NOW APPEAR!');
          } else {
            console.log('[SCREEN] ⚠️ Lawyer preview messages already exist, skipping recreation');
            console.log('[SCREEN] 📊 Messages checked:', messagesToCheck.length);
            console.log('[SCREEN] 🔍 Found types:', messagesToCheck.map(m => m.type).filter(t => t === 'lawyerPreview' || t === 'viewMoreLawyers'));
          }
        }
        
        return true;
      } else {
        console.log('[SCREEN] No stored lawyer data found for session');
        return false;
      }
    } catch (error) {
      console.error('[SCREEN] Error loading lawyer data from localStorage:', error);
      return false;
    }
  };

  return (
    <div className="flex w-full h-screen bg-[#f7f7f7] overflow-hidden">
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? (
          <XIcon className="w-6 h-6" />
        ) : (
          <MenuIcon className="w-6 h-6" />
        )}
      </button>

      <aside className={`
        fixed md:relative w-[272px] h-full bg-[#f7f7f7] shadow-[20px_4px_34px_#00000003]
        transform transition-transform duration-300 z-40
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="flex w-full items-center p-3 border-b border-[#eaeaea]">
          <div className="flex items-center gap-3 p-3">
            <div className="flex w-[43px] h-[43px] items-center justify-center bg-[#f2f2f2] rounded-[8px] border border-[#00000005]">
              <img
                className="w-[29px] h-[26px]"
                alt="Logo"
                src="/frame-2147227290.svg"
              />
            </div>
            <span className="font-semibold text-[23px] text-[#161616] tracking-[-1px]">
              LawPro
            </span>
          </div>
        </div>

        <div className="flex flex-col h-[calc(100%-180px)] p-5 gap-5">
          <Button
            variant="outline"
            onClick={handleNewChat}
            className="flex items-center justify-between w-full p-3 bg-white rounded-lg border-[#eaeaea]"
          >
            <div className="flex items-center gap-2">
              <PlusCircleIcon className="w-5 h-5" />
              <span>New Chat</span>
            </div>
            <ArrowRightIcon className="w-5 h-5" />
          </Button>

          <div className="flex-1 overflow-y-auto">
            <div className="mb-2 text-neutral-400 text-xs uppercase tracking-[0.48px]">
              Current Session
            </div>
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center group">
                <Button
                  variant="ghost"
                  className={`flex-1 text-left p-3 text-sm ${
                    currentSession === session.id ? 'bg-gray-200' : 'text-[#5c5c5c] hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setCurrentSession(session.id);
                    loadMessages(session.id);
                    setIsSidebarOpen(false);
                  }}
                >
                  {session.title}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => removeSessionFromUI(session.id, e)}
                >
                  <Trash2Icon className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 p-2 md:p-[9px] w-full">
        <Card className="h-[calc(100vh-16px)] md:h-[calc(100vh-18px)] bg-white rounded-xl md:rounded-[30px] shadow-[-12px_4px_25.3px_#00000005]">
          <CardContent className="flex flex-col h-full p-4 md:p-8">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 max-w-[560px] mx-auto text-center px-4">
                <img
                  className="w-[67px] h-[60px] mb-[13px]"
                  alt="Logo"
                  src="/subtract.svg"
                />
                <h1 className="text-2xl md:text-[34px] font-semibold text-[#000000d1] tracking-[-1.7px] leading-[1.2] mb-3">
                  Have a Legal Question?
                </h1>
                <p className="text-sm md:text-[14px] text-[#00000099] leading-[1.6]">
                  Ask me below about your situation, and I'll explain what it all
                  means in language that actually makes sense.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 md:space-y-6 mb-4 px-2 md:px-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.is_user ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start gap-2 max-w-[90%] md:max-w-[80%] ${message.is_user ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!message.is_user && (
                        <Avatar className="w-8 h-8 md:w-10 md:h-10 bg-[#f2f2f2] border border-[#00000005] flex items-center justify-center">
                          <img
                            className="w-5 h-5 md:w-[29px] md:h-[26px]"
                            alt="LawPro"
                            src="/frame-2147227290.svg"
                          />
                        </Avatar>
                      )}
                      
                      {message.type === 'lawyerPreview' && selectedLawyer ? (
                        <LawyerPreviewCard 
                          name={selectedLawyer.name || "Attorney Representative"}
                          specialty={selectedLawyer.specialty || "Legal Professional"}
                          profileImageUrl={selectedLawyer.profileImageUrl || "/placeholder-attorney.jpg"}
                          rating={selectedLawyer.rating || 4.8}
                          firm={selectedLawyer.lawFirm || "Law Firm"}
                          location={getDisplayLocation(currentCaseInfo) || "Your Area"}
                          caseType={currentCaseInfo.caseType || "Legal Cases"}
                          onClick={handleOpenLawyerDetail}
                          onConnectClick={(e) => {
                            e.stopPropagation();
                            setIsLawyerDetailedCardOpen(true);
                          }}
                        />
                      ) : message.type === 'viewMoreLawyers' ? (
                        renderViewMoreLawyersCard()
                      ) : (
                      <div className={`flex flex-col ${message.is_user ? 'items-end' : 'items-start'}`}>
                        <div 
                          className={`p-3 md:p-4 rounded-2xl text-sm md:text-base ${
                            message.is_user 
                              ? 'bg-indigo-700 text-white rounded-br-none' 
                              : 'bg-gray-100 text-gray-900 rounded-bl-none'
                          }`}
                        >
                          {message.is_user ? (
                            <span>{message.content}</span>
                          ) : (
                            <div 
                              className="prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: message.content }}
                            />
                          )}
                        </div>
                        <span className="text-[10px] md:text-xs text-gray-500 mt-1">
                          {formatTime(message.created_at)}
                        </span>
                      </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex items-start gap-2 max-w-[90%] md:max-w-[80%]">
                      <Avatar className="w-8 h-8 md:w-10 md:h-10 bg-[#f2f2f2] border border-[#00000005] flex items-center justify-center">
                        <img
                          className="w-5 h-5 md:w-[29px] md:h-[26px]"
                          alt="LawPro"
                          src="/frame-2147227290.svg"
                        />
                      </Avatar>
                      <div className="flex flex-col items-start">
                        <div className="p-3 md:p-4 rounded-2xl bg-gray-100 text-gray-900 rounded-bl-none">
                          <div className="flex items-center gap-2">
                            <div className="animate-pulse w-2 h-2 bg-gray-500 rounded-full"></div>
                            <div className="animate-pulse w-2 h-2 bg-gray-500 rounded-full delay-100"></div>
                            <div className="animate-pulse w-2 h-2 bg-gray-500 rounded-full delay-200"></div>
                          </div>
                          <p className="mt-2 text-xs md:text-sm text-gray-600">{loadingMessage}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            <div className="mt-auto">
              <div className="bg-[#f7f7f7] rounded-2xl p-3 md:p-4">
                <div className="flex items-start gap-3 mb-4">
                  <img
                    className="w-[19px] h-[19px]"
                    alt="Group"
                    src="/group-9.png"
                  />
                  <Textarea
                    className="flex-1 bg-transparent border-none resize-none focus-visible:ring-0 p-0 text-sm md:text-base"
                    placeholder="Ask a legal question..."
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,.pdf,.doc,.docx"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="p-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    <img
                      className="w-5 h-5"
                      alt="Paperclip"
                      src="/paperclip-1.svg"
                    />
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      className={`w-[38px] h-[38px] bg-indigo-700 rounded-[8.51px] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={handleSendMessage}
                      disabled={isLoading}
                    >
                      <SendIcon className="w-5 h-5 text-white" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-center items-center gap-2 md:gap-[18px] mt-4 md:mt-6 px-2">
                <div className="flex items-center gap-[5px]">
                  <ClockIcon className="w-4 h-4 md:w-[17px] md:h-[17px]" />
                  <span className="text-xs md:text-[13px] text-[#000000d1] whitespace-nowrap">Available 24/7</span>
                </div>
                <div className="hidden md:block w-1 h-1 bg-[#e7e7e7] rounded-full" />
                <div className="flex items-center gap-[5px]">
                  <LockIcon className="w-4 h-4 md:w-[17px] md:h-[17px]" />
                  <span className="text-xs md:text-[13px] text-[#000000d1] whitespace-nowrap">Securely Encrypted</span>
                </div>
                <div className="hidden md:block w-1 h-1 bg-[#e7e7e7] rounded-full" />
                <div className="flex items-center gap-[5px]">
                  <UsersIcon className="w-4 h-4 md:w-[17px] md:h-[17px]" />
                  <span className="text-xs md:text-[13px] text-[#000000d1] whitespace-nowrap">For the people</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      

      
      {/* Lawyer Detail Modal */}
      <LawyerDetailModal 
        isOpen={isLawyerDetailOpen}
        onClose={() => setIsLawyerDetailOpen(false)}
        county={selectedLawyer?.county}
        state={selectedLawyer?.state}
        caseType={currentCaseInfo.caseType}
        lawyer={selectedLawyer ?? undefined}
      />
      
      {/* Lawyer List Modal */}
      <LawyerListModal 
        isOpen={isLawyerListOpen}
        onClose={() => setIsLawyerListOpen(false)}
        county={currentCaseInfo.county}
        state={currentCaseInfo.state}
        caseType={currentCaseInfo.caseType}
        lawyers={lawyers}
      />

      {/* Lawyer Detailed Card Modal */}
      {selectedLawyer && (
        <LawyerDetailedCard 
          isOpen={isLawyerDetailedCardOpen}
          onClose={() => setIsLawyerDetailedCardOpen(false)}
          name={selectedLawyer.name || "Attorney Representative"}
          specialty={selectedLawyer.specialty || "Legal Professional"}
          profileImageUrl={selectedLawyer.profileImageUrl || "/placeholder-attorney.jpg"}
          rating={selectedLawyer.rating || 4.8}
          firm={selectedLawyer.lawFirm || "Law Firm"}
          location={getDisplayLocation(currentCaseInfo) || "Your Area"}
          caseType={currentCaseInfo.caseType || "Legal Cases"}
          county={selectedLawyer.county || currentCaseInfo.county || "County"}
          state={selectedLawyer.state || currentCaseInfo.state || "State"}
          phoneNumber={selectedLawyer.phoneNumber || ""}
          email={selectedLawyer.email || ""}
          website={selectedLawyer.website || ""}
          lawyerId={selectedLawyer.id}
          onConnectClick={() => {
            console.log("Connect clicked from detailed card");
          }}
        />
      )}
    </div>
  );
};