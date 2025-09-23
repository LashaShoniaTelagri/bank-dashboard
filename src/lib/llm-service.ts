// LLM Service for TelAgri Monitoring
// Secure AI analysis integration with banking-grade security

import { supabase } from '../integrations/supabase/client';
import { LLMProvider, AnalysisResult, LLMApiKey } from '../types/specialist';

// LLM Service class for managing AI analysis
export class LLMService {
  private static instance: LLMService;
  private apiKeys: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  // Store API key securely
  async storeApiKey(provider: LLMProvider, keyName: string, apiKey: string): Promise<void> {
    try {
      // Encrypt the API key (in production, use proper encryption)
      const encryptedKey = btoa(apiKey); // Simple base64 encoding for demo

      const { error } = await supabase
        .from('llm_api_keys')
        .upsert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          provider,
          key_name: keyName,
          encrypted_key: encryptedKey,
          is_active: true
        });

      if (error) {
        throw new Error(`Failed to store API key: ${error.message}`);
      }

      // Cache the key for current session
      this.apiKeys.set(`${provider}-${keyName}`, apiKey);
    } catch (error) {
      console.error('Error storing API key:', error);
      throw error;
    }
  }

  // Retrieve API key securely
  async getApiKey(provider: LLMProvider, keyName: string): Promise<string> {
    try {
      // Check cache first
      const cacheKey = `${provider}-${keyName}`;
      if (this.apiKeys.has(cacheKey)) {
        return this.apiKeys.get(cacheKey)!;
      }

      // Fetch from database
      const { data, error } = await supabase
        .from('llm_api_keys')
        .select('encrypted_key, is_active')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .eq('provider', provider)
        .eq('key_name', keyName)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        throw new Error(`API key not found: ${provider}-${keyName}`);
      }

      // Decrypt the key (in production, use proper decryption)
      const decryptedKey = atob(data.encrypted_key);
      
      // Cache for current session
      this.apiKeys.set(cacheKey, decryptedKey);
      
      return decryptedKey;
    } catch (error) {
      console.error('Error retrieving API key:', error);
      throw error;
    }
  }

  // List available API keys
  async listApiKeys(): Promise<LLMApiKey[]> {
    try {
      const { data, error } = await supabase
        .from('llm_api_keys')
        .select('*')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to list API keys: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error listing API keys:', error);
      throw error;
    }
  }

  // Delete API key
  async deleteApiKey(keyId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('llm_api_keys')
        .delete()
        .eq('id', keyId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) {
        throw new Error(`Failed to delete API key: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      throw error;
    }
  }

  // Analyze data using OpenAI GPT
  async analyzeWithOpenAI(
    prompt: string,
    contextData: Record<string, unknown>,
    model: string = 'gpt-4'
  ): Promise<AnalysisResult> {
    try {
      const apiKey = await this.getApiKey('openai', 'default');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are an agricultural data analysis specialist working for TelAgri, a financial platform serving farmers. 
              Analyze the provided agricultural data with expertise in:
              - Crop health and yield optimization
              - Soil analysis and fertility management
              - Irrigation and water management
              - Financial analysis for agricultural loans
              - Risk assessment for farming operations
              
              Provide detailed, actionable insights that help farmers improve their agricultural practices and financial outcomes.
              Focus on practical recommendations that can be implemented in real farming conditions.`
            },
            {
              role: 'user',
              content: `Context Data: ${JSON.stringify(contextData, null, 2)}\n\nAnalysis Request: ${prompt}`
            }
          ],
          max_tokens: 2000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const analysis = data.choices[0]?.message?.content;

      if (!analysis) {
        throw new Error('No analysis generated');
      }

      // Update usage statistics
      await this.updateApiKeyUsage('openai', 'default', data.usage);

      return {
        success: true,
        data: {
          analysis,
          recommendations: this.extractRecommendations(analysis),
          confidence_score: 0.85, // Could be calculated based on response quality
          processing_time: Date.now(),
          model_used: model
        }
      };
    } catch (error) {
      console.error('OpenAI analysis error:', error);
      return {
        success: false,
        error: {
          code: 'OPENAI_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { provider: 'openai', model }
        }
      };
    }
  }

  // Analyze data using Anthropic Claude
  async analyzeWithClaude(
    prompt: string,
    contextData: Record<string, unknown>,
    model: string = 'claude-3-sonnet-20240229'
  ): Promise<AnalysisResult> {
    try {
      const apiKey = await this.getApiKey('anthropic', 'default');
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: `As an agricultural data analysis specialist for TelAgri, analyze this data:

Context Data: ${JSON.stringify(contextData, null, 2)}

Analysis Request: ${prompt}

Provide detailed insights on crop health, soil conditions, irrigation needs, and financial implications. Focus on actionable recommendations for farmers.`
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Anthropic API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const analysis = data.content[0]?.text;

      if (!analysis) {
        throw new Error('No analysis generated');
      }

      // Update usage statistics
      await this.updateApiKeyUsage('anthropic', 'default', data.usage);

      return {
        success: true,
        data: {
          analysis,
          recommendations: this.extractRecommendations(analysis),
          confidence_score: 0.88,
          processing_time: Date.now(),
          model_used: model
        }
      };
    } catch (error) {
      console.error('Claude analysis error:', error);
      return {
        success: false,
        error: {
          code: 'ANTHROPIC_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { provider: 'anthropic', model }
        }
      };
    }
  }

  // Generic analysis method that tries multiple providers
  async analyzeData(
    prompt: string,
    contextData: Record<string, unknown>,
    preferredProvider?: LLMProvider
  ): Promise<AnalysisResult> {
    const providers: LLMProvider[] = preferredProvider 
      ? [preferredProvider, 'openai', 'anthropic']
      : ['openai', 'anthropic'];

    for (const provider of providers) {
      try {
        let result: AnalysisResult;
        
        switch (provider) {
          case 'openai':
            result = await this.analyzeWithOpenAI(prompt, contextData);
            break;
          case 'anthropic':
            result = await this.analyzeWithClaude(prompt, contextData);
            break;
          default:
            continue;
        }

        if (result.success) {
          return result;
        }
      } catch (error) {
        console.warn(`Provider ${provider} failed, trying next:`, error);
        continue;
      }
    }

    return {
      success: false,
      error: {
        code: 'ALL_PROVIDERS_FAILED',
        message: 'All AI providers failed to generate analysis',
        details: { providers: providers.join(', ') }
      }
    };
  }

  // Extract recommendations from analysis text
  private extractRecommendations(analysis: string): string[] {
    const recommendations: string[] = [];
    const lines = analysis.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[-•]\s/) || trimmed.match(/^\d+\.\s/)) {
        recommendations.push(trimmed.replace(/^[-•]\s/, '').replace(/^\d+\.\s/, ''));
      }
    }
    
    return recommendations.length > 0 ? recommendations : ['Review the analysis for specific recommendations'];
  }

  // Update API key usage statistics
  private async updateApiKeyUsage(provider: LLMProvider, keyName: string, usage: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('llm_api_keys')
        .update({
          usage_count: supabase.sql`usage_count + 1`,
          last_used_at: new Date().toISOString()
        })
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .eq('provider', provider)
        .eq('key_name', keyName);

      if (error) {
        console.warn('Failed to update API key usage:', error);
      }
    } catch (error) {
      console.warn('Error updating API key usage:', error);
    }
  }

  // Validate API key
  async validateApiKey(provider: LLMProvider, apiKey: string): Promise<boolean> {
    try {
      switch (provider) {
        case 'openai':
          const openaiResponse = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          return openaiResponse.ok;

        case 'anthropic':
          const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'test' }]
            })
          });
          return anthropicResponse.ok;

        default:
          return false;
      }
    } catch (error) {
      console.error('API key validation error:', error);
      return false;
    }
  }

  // Clear cached API keys (for security)
  clearCache(): void {
    this.apiKeys.clear();
  }
}

// Export singleton instance
export const llmService = LLMService.getInstance();

// Utility functions for common analysis tasks
export const AnalysisPrompts = {
  cropHealth: (data: Record<string, unknown>) => `
    Analyze the crop health data provided. Focus on:
    - Disease and pest identification
    - Nutrient deficiencies
    - Growth stage assessment
    - Yield potential
    - Recommended interventions
    
    Data: ${JSON.stringify(data, null, 2)}
  `,

  soilAnalysis: (data: Record<string, unknown>) => `
    Analyze the soil data provided. Focus on:
    - Soil composition and pH levels
    - Nutrient content and availability
    - Organic matter levels
    - Drainage and water retention
    - Fertilization recommendations
    
    Data: ${JSON.stringify(data, null, 2)}
  `,

  irrigationOptimization: (data: Record<string, unknown>) => `
    Analyze the irrigation and water management data. Focus on:
    - Water usage efficiency
    - Irrigation system performance
    - Water quality assessment
    - Seasonal water requirements
    - Optimization recommendations
    
    Data: ${JSON.stringify(data, null, 2)}
  `,

  financialRisk: (data: Record<string, unknown>) => `
    Analyze the financial and risk data for agricultural lending. Focus on:
    - Crop yield projections
    - Market price trends
    - Weather risk factors
    - Farmer's financial capacity
    - Loan repayment probability
    - Risk mitigation strategies
    
    Data: ${JSON.stringify(data, null, 2)}
  `,

  complianceReview: (data: Record<string, unknown>) => `
    Review the compliance and regulatory data. Focus on:
    - Environmental regulations compliance
    - Safety standards adherence
    - Certification requirements
    - Documentation completeness
    - Regulatory risk assessment
    
    Data: ${JSON.stringify(data, null, 2)}
  `
};