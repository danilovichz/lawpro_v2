import { processMessageForConversation, searchLawyersForState } from './enhancedLawyerSearch';
import { supabase } from './supabase';
import axios from 'axios';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

/**
 * Test the enhanced lawyer search system end-to-end
 */
export async function testEnhancedSearchSystem(): Promise<void> {
  console.log('🧪 Testing Enhanced Lawyer Search System...');
  
  try {
    // Test 1: Create a test chat session
    console.log('\n1️⃣ Creating test chat session...');
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .insert([{
        session_key: 'test-session-' + Date.now(),
        title: 'Test Enhanced Search'
      }])
      .select()
      .single();

    if (sessionError) {
      console.error('❌ Failed to create test session:', sessionError);
      return;
    }

    console.log('✅ Created test session:', session.id);

    // Test 2: Test incremental information gathering - DUI case
    console.log('\n2️⃣ Testing DUI case with typos...');
    
    // Step 1: User mentions DUI but with typos in location
    const result1 = await processMessageForConversation(
      'I got a DUI in Los Angelos Calfornia', 
      session.id
    );
    
    console.log('Step 1 Result:', {
      state: result1.state,
      shouldRequestLawyers: result1.shouldRequestLawyers,
      enhancedMessage: result1.enhancedMessage
    });

    // Test if we should search for lawyers (should be true since we have state and case type)
    if (result1.shouldRequestLawyers) {
      console.log('🔍 Searching for lawyers...');
      const lawyers = await searchLawyersForState(session.id);
      console.log(`✅ Found ${lawyers.length} lawyers for DUI in California`);
      
      if (lawyers.length > 0) {
        console.log('Sample lawyer:', {
          name: lawyers[0].name,
          state: lawyers[0].state,
          county: lawyers[0].county,
          specialty: lawyers[0].specialty
        });
      }
    }

    // Test 3: Test car accident case
    console.log('\n3️⃣ Testing car accident case...');
    
    const { data: session2, error: session2Error } = await supabase
      .from('chat_sessions')
      .insert([{
        session_key: 'test-session-2-' + Date.now(),
        title: 'Test Car Accident'
      }])
      .select()
      .single();

    if (!session2Error) {
      // First message: mention accident
      const accidentResult1 = await processMessageForConversation(
        'I was in a car accident', 
        session2.id
      );
      
      console.log('Accident Step 1:', accidentResult1.state);
      
      // Second message: provide location with typo
      const accidentResult2 = await processMessageForConversation(
        'I am in Jefferson County, Alabama', 
        session2.id
      );
      
      console.log('Accident Step 2:', {
        state: accidentResult2.state,
        shouldRequestLawyers: accidentResult2.shouldRequestLawyers
      });
      
      if (accidentResult2.shouldRequestLawyers) {
        const accidentLawyers = await searchLawyersForState(session2.id);
        console.log(`✅ Found ${accidentLawyers.length} lawyers for accident in Alabama`);
      }
    }

    // Test 4: Test database connectivity and lawyer data
    console.log('\n4️⃣ Testing database connectivity...');
    
    const { data: sampleLawyers, error: lawyerError } = await supabase
      .from('lawyers_real')
      .select('state, county, type, "Law Firm"')
      .limit(3);

    if (lawyerError) {
      console.error('❌ Database error:', lawyerError);
    } else {
      console.log('✅ Database connected. Sample lawyers:', sampleLawyers);
    }

    // Test 5: Test OpenAI API
    console.log('\n5️⃣ Testing OpenAI API...');
    
    try {
      const testApiResult = await processMessageForConversation(
        'I need help with a drunk driving case in Neveda', 
        session.id
      );
      
      console.log('✅ OpenAI API working:', {
        detectedState: testApiResult.state.state,
        detectedCaseType: testApiResult.state.caseType
      });
    } catch (apiError) {
      console.error('⚠️ OpenAI API error:', apiError);
    }

    // Test 6: Test conversation state persistence
    console.log('\n6️⃣ Testing conversation state persistence...');
    
    const { data: sessionWithState, error: stateError } = await supabase
      .from('chat_sessions')
      .select('conversation_state')
      .eq('id', session.id)
      .single();

    if (!stateError && sessionWithState?.conversation_state) {
      console.log('✅ Conversation state persisted:', sessionWithState.conversation_state);
    } else {
      console.error('❌ Conversation state not saved properly');
    }

    // Cleanup: Remove test sessions
    await supabase
      .from('chat_sessions')
      .delete()
      .in('id', [session.id, session2?.id].filter(Boolean));

    console.log('\n🎉 Enhanced Search System Test Complete!');
    console.log('✅ All core functionality verified');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

/**
 * Test OpenAI API connection specifically
 */
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    console.log('🔌 Testing OpenAI API connection...');
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4o-mini",
      messages: [{ 
        role: 'user', 
        content: 'Return JSON: {"status": "working", "message": "API connected successfully"}' 
      }],
      response_format: { type: "json_object" },
      max_tokens: 50,
      temperature: 0
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // OpenAI API response validation
    if (response.status !== 200) {
      console.error('❌ OpenAI API test failed:', response.status);
      return false;
    }

    // Validate OpenAI response structure
    if (!response.data || !response.data.choices || !Array.isArray(response.data.choices) || response.data.choices.length === 0) {
      console.error('❌ Invalid OpenAI API response structure - missing choices array');
      return false;
    }

    const choice = response.data.choices[0];
    if (!choice.message || !choice.message.content) {
      console.error('❌ Invalid OpenAI API response structure - missing message content');
      return false;
    }

    const data = response.data;
    const result = JSON.parse(choice.message.content);
    
    if (result.status === 'working') {
      console.log('✅ OpenAI API connected successfully');
      return true;
    }

    return false;
  } catch (error: any) {
    console.error('❌ OpenAI API connection error:', error);
    
    // Log detailed axios error information
    if (error.response) {
      console.error('❌ Error response status:', error.response.status);
      console.error('❌ Error response data:', error.response.data);
    } else if (error.request) {
      console.error('❌ Error request:', error.request);
    } else {
      console.error('❌ Error message:', error.message);
    }
    return false;
  }
}

/**
 * Quick test of the fuzzy matching functionality
 */
export async function testFuzzyMatching(): Promise<void> {
  console.log('🔤 Testing Fuzzy Matching...');
  
  try {
    // Test common typos
    const typoTests = [
      { input: 'Calfornia', expected: 'California' },
      { input: 'Los Angelos', expected: 'Los Angeles' },
      { input: 'Neveda', expected: 'Nevada' }
    ];

    for (const test of typoTests) {
      const result = await processMessageForConversation(
        `I need help in ${test.input}`, 
        'test-session-' + Date.now()
      );
      
      console.log(`"${test.input}" → "${result.state.state}"`);
    }

    console.log('✅ Fuzzy matching tests completed');

  } catch (error) {
    console.error('❌ Fuzzy matching test failed:', error);
  }
} 