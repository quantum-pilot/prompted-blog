import type { 
  Env, 
  StateData, 
  GoogleTokenResponse, 
  GoogleUserInfo,
  OAuthSuccessResponse,
  OAuthErrorResponse 
} from './types';
import { 
  generateRandomString, 
  generateCodeChallenge 
} from './pkce';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    
    // Route handling
    switch (url.pathname) {
      case '/oauth/google/start':
        return handleOAuthStart(env);
        
      case '/oauth/google/callback':
        return handleOAuthCallback(url, env);
        
      default:
        return new Response(
          JSON.stringify({ error: 'not_found', message: 'Route not found' }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }
  },
};

async function handleOAuthStart(env: Env): Promise<Response> {
  try {
    // Generate PKCE parameters
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Store state and verifier in KV (expires in 10 minutes)
    const stateData: StateData = {
      codeVerifier,
      timestamp: Date.now(),
    };
    
    await env.OAUTH_STATE.put(
      `state:${state}`,
      JSON.stringify(stateData),
      { expirationTtl: 600 } // 10 minutes
    );
    
    // Build authorization URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', env.CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('redirect_uri', env.REDIRECT_URI);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('access_type', 'online');
    authUrl.searchParams.set('prompt', 'select_account');
    
    // Redirect to Google OAuth
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': authUrl.toString(),
      },
    });
  } catch (error) {
    console.error('OAuth start error:', error);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: 'Failed to initiate OAuth flow' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

async function handleOAuthCallback(url: URL, env: Env): Promise<Response> {
  try {
    // Check for OAuth errors
    const error = url.searchParams.get('error');
    if (error) {
      return new Response(
        JSON.stringify({
          error,
          error_description: url.searchParams.get('error_description') || 'OAuth error occurred',
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Get code and state from query parameters
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'missing_code', message: 'Authorization code is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (!state) {
      return new Response(
        JSON.stringify({ error: 'missing_state', message: 'State parameter is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Retrieve and validate state
    const stateKey = `state:${state}`;
    const stateDataJson = await env.OAUTH_STATE.get(stateKey);
    
    if (!stateDataJson) {
      return new Response(
        JSON.stringify({ error: 'invalid_state', message: 'Invalid or expired state' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const stateData: StateData = JSON.parse(stateDataJson);
    
    // Exchange code for token
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const tokenBody = new URLSearchParams({
      code,
      client_id: env.CLIENT_ID,
      client_secret: env.CLIENT_SECRET,
      redirect_uri: env.REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: stateData.codeVerifier,
    });
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody.toString(),
    });
    
    const tokenData: GoogleTokenResponse = await tokenResponse.json();
    
    if (!tokenResponse.ok || tokenData.error) {
      console.error('Token exchange failed:', tokenData);
      return new Response(
        JSON.stringify({ 
          error: 'token_exchange_failed',
          message: tokenData.error_description || 'Failed to exchange authorization code'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });
    
    if (!userInfoResponse.ok) {
      console.error('Failed to fetch user info:', await userInfoResponse.text());
      return new Response(
        JSON.stringify({ 
          error: 'user_info_failed',
          message: 'Failed to fetch user information'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const userInfo: GoogleUserInfo = await userInfoResponse.json();
    
    // Delete state from KV after successful authentication
    await env.OAUTH_STATE.delete(stateKey);
    
    // Prepare user data
    const userData = {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      provider: 'google',
    };
    
    // Determine the app URL based on environment
    const appUrl = env.REDIRECT_URI.includes('localhost') 
      ? 'http://localhost:8000'
      : 'https://promptedblog.com';
    
    // Redirect back to app with user data
    const redirectUrl = new URL('/oauth/callback', appUrl);
    redirectUrl.searchParams.set('user', encodeURIComponent(JSON.stringify(userData)));
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl.toString(),
      }
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'internal_error',
        message: 'An unexpected error occurred during authentication'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}